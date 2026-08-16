import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTUALIZACION_TEMPLATE =
  "HX23277e717da845d5b292d5c196900566";

type TrackingMorePayload = {
  id?: string | null;
  tracking_number?: string | null;
  courier_code?: string | null;
  delivery_status?: string | null;
  substatus?: string | null;
  latest_event?: string | null;
  latest_checkpoint_time?: string | null;
  [key: string]: any;
};

function limpiarGuia(valor: unknown) {
  return String(valor || "").replace(/\D/g, "").trim();
}

function limpiarTelefono(valor: unknown) {
  const telefono = String(valor || "").replace(/\D/g, "").trim();

  if (!telefono) return "";
  if (telefono.startsWith("521") && telefono.length === 13) return telefono;
  if (telefono.startsWith("52") && telefono.length === 12) {
    return `521${telefono.slice(2)}`;
  }
  if (telefono.length === 10) return `521${telefono}`;

  return telefono;
}

function traducirEstadoTrackingMore(
  deliveryStatus: unknown,
  substatus: unknown,
  latestEvent: unknown
) {
  const estado = String(deliveryStatus || "").trim().toLowerCase();
  const sub = String(substatus || "").trim().toLowerCase();
  const evento = String(latestEvent || "").trim().toLowerCase();

  if (
    evento.includes("intento de entrega") ||
    evento.includes("delivery failure") ||
    evento.includes("failed attempt")
  ) {
    return "Intento de entrega";
  }

  if (
    evento.includes("reparto") ||
    evento.includes("ruta de entrega") ||
    evento.includes("out for delivery")
  ) {
    return "En reparto";
  }

  if (estado === "delivered" || sub.startsWith("delivered")) return "Entregado";

  if (
    estado === "outfordelivery" ||
    estado === "out_for_delivery" ||
    sub.startsWith("outfordelivery")
  ) {
    return "En reparto";
  }

  if (
    estado === "transit" ||
    estado === "intransit" ||
    estado === "in_transit" ||
    sub.startsWith("transit")
  ) {
    return "En tránsito";
  }

  if (
    estado === "pickup" ||
    estado === "pickedup" ||
    estado === "picked_up" ||
    sub.startsWith("pickup")
  ) {
    return "Recolectado";
  }

  if (
    estado === "exception" ||
    estado === "failedattempt" ||
    estado === "failed_attempt"
  ) {
    return "Reporte";
  }

  if (
    estado === "pending" ||
    estado === "notfound" ||
    estado === "not_found" ||
    estado === "inforeceived" ||
    estado === "info_received" ||
    estado === "expired" ||
    !estado
  ) {
    return "En espera";
  }

  return String(deliveryStatus || "En espera");
}

function extraerPayload(body: any): TrackingMorePayload {
  if (
    body &&
    typeof body === "object" &&
    body.data &&
    typeof body.data === "object"
  ) {
    return body.data as TrackingMorePayload;
  }

  return (body || {}) as TrackingMorePayload;
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const secretRecibido = url.searchParams.get("secret") || "";
    const secretEsperado = process.env.TRACKINGMORE_WEBHOOK_SECRET || "";

    if (!secretEsperado) {
      return NextResponse.json(
        { success: false, error: "Falta TRACKINGMORE_WEBHOOK_SECRET." },
        { status: 500 }
      );
    }

    if (secretRecibido !== secretEsperado) {
      return NextResponse.json(
        { success: false, error: "Webhook no autorizado." },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: "Faltan variables de Supabase." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let body: any;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Payload JSON inválido." },
        { status: 400 }
      );
    }

    const payload = extraerPayload(body);
    const numeroGuia = limpiarGuia(payload.tracking_number);

    if (!numeroGuia) {
      return NextResponse.json({
        success: true,
        ignored: true,
        motivo: "Webhook sin tracking_number válido.",
      });
    }

    let { data: envio, error: errorEnvio } = await supabase
      .from("envios")
      .select("*")
      .eq("guia", numeroGuia)
      .maybeSingle();

    if (!envio && !errorEnvio) {
      const { data: candidatos, error: errorCandidatos } = await supabase
        .from("envios")
        .select("*")
        .order("id", { ascending: false })
        .limit(500);

      if (!errorCandidatos && candidatos) {
        envio =
          candidatos.find((item: any) => {
            const guias = String(item.guia || "")
              .split(/[,;\n\r|]+/)
              .map((g) => limpiarGuia(g))
              .filter(Boolean);

            return guias.includes(numeroGuia);
          }) || null;
      }
    }

    if (errorEnvio) {
      return NextResponse.json(
        { success: false, error: errorEnvio.message },
        { status: 500 }
      );
    }

    if (!envio) {
      return NextResponse.json({
        success: true,
        ignored: true,
        tracking_number: numeroGuia,
        motivo: "La guía no existe en la tabla envios.",
      });
    }

    const estadoNuevo = traducirEstadoTrackingMore(
      payload.delivery_status,
      payload.substatus,
      payload.latest_event
    );

    const estadoAnterior = String(envio.estatus_actual || "").trim();
    const cambioEstado = estadoNuevo !== estadoAnterior;
    const ahora = new Date().toISOString();
    const esEntregado = estadoNuevo === "Entregado";

    const { error: errorUpdate } = await supabase
      .from("envios")
      .update({
        estatus_actual: estadoNuevo,
        entregado: esEntregado,
        fecha_ultima_revision: ahora,
        trackingmore_id: payload.id || null,
        trackingmore_courier: payload.courier_code || null,
        trackingmore_status: payload.delivery_status || null,
        trackingmore_substatus: payload.substatus || null,
        trackingmore_event: payload.latest_event || null,
        trackingmore_checkpoint: payload.latest_checkpoint_time || null,
      })
      .eq("id", envio.id);

    if (errorUpdate) {
      return NextResponse.json(
        { success: false, error: errorUpdate.message },
        { status: 500 }
      );
    }

    if (!cambioEstado) {
      return NextResponse.json({
        success: true,
        tracking_number: numeroGuia,
        envio_id: envio.id,
        estado: estadoNuevo,
        cambio_estado: false,
        whatsapp_enviado: false,
      });
    }

    const ultimoEstadoEnviado = String(envio.ultimo_estado_enviado || "").trim();

    if (ultimoEstadoEnviado === estadoNuevo) {
      return NextResponse.json({
        success: true,
        tracking_number: numeroGuia,
        envio_id: envio.id,
        estado: estadoNuevo,
        cambio_estado: true,
        whatsapp_enviado: false,
        motivo: "Ese estado ya había sido enviado por WhatsApp.",
      });
    }

    const telefono = limpiarTelefono(envio.telefono_whatsapp);

    if (
      !telefono ||
      telefono.length !== 13 ||
      !telefono.startsWith("521")
    ) {
      await supabase
        .from("envios")
        .update({
          ultimo_whatsapp: "Error WhatsApp: teléfono inválido",
        })
        .eq("id", envio.id);

      return NextResponse.json({
        success: true,
        tracking_number: numeroGuia,
        envio_id: envio.id,
        estado: estadoNuevo,
        cambio_estado: true,
        whatsapp_enviado: false,
        motivo: "Teléfono inválido.",
      });
    }

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const fromWhatsApp =
      process.env.TWILIO_WHATSAPP_FROM ||
      process.env.TWILIO_WHATSAPP_NUMBER;

    if (!twilioSid || !twilioToken || !fromWhatsApp) {
      return NextResponse.json(
        { success: false, error: "Faltan variables de Twilio." },
        { status: 500 }
      );
    }

    const client = twilio(twilioSid, twilioToken);

    try {
      const message = await client.messages.create({
        from: fromWhatsApp,
        to: `whatsapp:+${telefono}`,
        contentSid: ACTUALIZACION_TEMPLATE,
        contentVariables: JSON.stringify({
          "1": String(envio.cliente || "Cliente"),
          "2": String(envio.pedido || "Sin pedido"),
          "3": String(
            envio.paqueteria ||
              payload.courier_code ||
              "Paquetería"
          ),
          "4": String(envio.guia || numeroGuia),
          "5": String(estadoNuevo),
        }),
      });

      await supabase
        .from("envios")
        .update({
          ultimo_estado_enviado: estadoNuevo,
          ultimo_whatsapp: `Actualización enviada: ${estadoNuevo}`,
          whatsapp_entregado: esEntregado
            ? true
            : Boolean(envio.whatsapp_entregado),
        })
        .eq("id", envio.id);

      return NextResponse.json({
        success: true,
        tracking_number: numeroGuia,
        envio_id: envio.id,
        estado_anterior: estadoAnterior,
        estado_nuevo: estadoNuevo,
        evento: payload.latest_event || null,
        checkpoint: payload.latest_checkpoint_time || null,
        whatsapp_enviado: true,
        twilio_sid: message.sid,
      });
    } catch (twilioError: any) {
      await supabase
        .from("envios")
        .update({
          ultimo_whatsapp: `Error WhatsApp: ${
            twilioError?.message || "Error desconocido"
          }`,
        })
        .eq("id", envio.id);

      return NextResponse.json({
        success: true,
        tracking_number: numeroGuia,
        envio_id: envio.id,
        estado: estadoNuevo,
        whatsapp_enviado: false,
        whatsapp_error: twilioError?.message || "Error desconocido",
      });
    }
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    servicio: "VIPACK TrackingMore Webhook",
    estado: "activo",
  });
}