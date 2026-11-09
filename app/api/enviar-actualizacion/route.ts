// Archivo: app/api/enviar-actualizacion/route.ts
// VIPACK: envío manual con sesión firmada y reserva atómica contra duplicados.
// IMPORTANTE: No hace reintentos automáticos; un resultado incierto requiere revisión en Twilio.
import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";
import { verificarSesionAdmin } from "@/lib/vipack-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTUALIZACION_TEMPLATE = "HX23277e717da845d5b292d5c196900566";

type Envio = {
  id: number | string;
  cliente?: string | null;
  telefono_whatsapp?: string | null;
  pedido?: string | null;
  guia?: string | null;
  paqueteria?: string | null;
  estado_17track?: string | null;
  estatus_actual?: string | null;
  ultimo_estado_enviado?: string | null;
  fecha_envio?: string | null;
};

function normalizarTelefono(valor: unknown): string | null {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (/^\d{10}$/.test(digitos)) return `521${digitos}`;
  if (/^52\d{10}$/.test(digitos)) return `521${digitos.slice(2)}`;
  if (/^521\d{10}$/.test(digitos)) return digitos;
  return null;
}

function respuestaError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: NextRequest) {
  if (!verificarSesionAdmin(request)) {
    return respuestaError("Sesión administrativa no válida o caducada.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respuestaError("El cuerpo debe ser JSON válido.", 400);
  }

  const id = (body as { id?: unknown } | null)?.id;
  if (typeof id !== "number" && typeof id !== "string") {
    return respuestaError("Falta el ID del envío.", 400);
  }
  if (!/^\d+$/.test(String(id)) || Number(id) <= 0 || !Number.isSafeInteger(Number(id))) {
    return respuestaError("ID de envío inválido.", 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_WHATSAPP_NUMBER;

  if (!supabaseUrl || !serviceKey || !accountSid || !authToken || !fromWhatsApp) {
    console.error("VIPACK: falta configuración de Supabase o Twilio");
    return respuestaError("Falta configuración del servidor para enviar WhatsApp.", 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error: errorConsulta } = await supabase
    .from("envios")
    .select("*")
    .eq("id", Number(id))
    .single();

  if (errorConsulta || !data) return respuestaError("No se encontró el envío.", 404);

  const envio = data as Envio;
  const telefono = normalizarTelefono(envio.telefono_whatsapp);
  const estado = String(
    envio.estatus_actual || envio.estado_17track || envio.ultimo_estado_enviado || ""
  ).trim();
  const guia = String(envio.guia || "").trim();
  const paqueteria = String(envio.paqueteria || "").trim();

  if (!telefono) return respuestaError("Teléfono mexicano inválido para WhatsApp.", 400);
  if (!estado || !guia || !paqueteria) {
    return respuestaError("El envío necesita guía, paquetería y estado.", 400);
  }

  // La restricción UNIQUE(canal, clave_evento) de Supabase es el bloqueo atómico.
  // No repetir automáticamente el mismo estado para la misma guía y envío.
  const claveEvento = `manual:${envio.id}:${paqueteria.toUpperCase()}:${guia}:${estado.toLowerCase()}`;

  const { data: reserva, error: errorReserva } = await supabase
    .from("notificaciones_envios")
    .insert({
      envio_id: Number(envio.id),
      guia,
      paqueteria,
      canal: "whatsapp",
      estado_envio: estado,
      clave_evento: claveEvento,
      telefono_destino: telefono,
      estado_notificacion: "procesando",
      intentos: 1,
    })
    .select("id")
    .single();

  if (errorReserva) {
    if (errorReserva.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          duplicate: true,
          error: "Este estado ya tiene un intento de notificación. Revisa el historial antes de reenviar.",
        },
        { status: 409 }
      );
    }
    console.error("VIPACK error reservando notificación:", errorReserva);
    return respuestaError("No se pudo reservar la notificación; no se envió WhatsApp.", 500);
  }

  const notificacionId = reserva.id as number;

  try {
    const client = twilio(accountSid, authToken);
    const mensaje = await client.messages.create({
      from: fromWhatsApp,
      to: `whatsapp:+${telefono}`,
      contentSid: ACTUALIZACION_TEMPLATE,
      contentVariables: JSON.stringify({
        "1": String(envio.cliente || "Cliente"),
        "2": String(envio.pedido || "Sin pedido"),
        "3": paqueteria,
        "4": guia,
        "5": estado,
      }),
    });

    const ahora = new Date().toISOString();
    const { error: errorHistorial } = await supabase
      .from("notificaciones_envios")
      .update({
        twilio_sid: mensaje.sid,
        estado_notificacion: "enviado",
        fecha_envio: ahora,
        fecha_actualizacion: ahora,
      })
      .eq("id", notificacionId);

    const { error: errorEnvio } = await supabase
      .from("envios")
      .update({
        ultimo_whatsapp: `Solicitado a Twilio: ${estado}`,
        ultimo_estado_enviado: estado,
        fecha_ultima_revision: ahora,
      })
      .eq("id", envio.id);

    if (errorHistorial || errorEnvio) {
      console.error("VIPACK: Twilio aceptó, pero falló registro", {
        notificacionId,
        sid: mensaje.sid,
        errorHistorial,
        errorEnvio,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Twilio aceptó la solicitud; entrega al cliente aún no confirmada.",
      sid: mensaje.sid,
      status: mensaje.status,
      notificacion_id: notificacionId,
      warning: errorHistorial || errorEnvio
        ? "Revisar registros en Supabase antes de intentar reenviar."
        : undefined,
    });
  } catch (error: unknown) {
    const descripcion = error instanceof Error ? error.message : "Error desconocido";
    const ahora = new Date().toISOString();
    // Con errores de red puede existir un envío aceptado por Twilio sin respuesta.
    // Mantener la reserva bloqueada hasta revisión manual para evitar duplicados.
    const { error: errorRegistro } = await supabase
      .from("notificaciones_envios")
      .update({
        estado_notificacion: "fallido",
        ultimo_error: descripcion.slice(0, 1000),
        fecha_actualizacion: ahora,
      })
      .eq("id", notificacionId);
    if (errorRegistro) console.error("VIPACK: no se pudo registrar fallo", errorRegistro);
    console.error("VIPACK: fallo o resultado incierto en Twilio", { notificacionId, error });
    return NextResponse.json(
      {
        success: false,
        error: "No se pudo confirmar el envío con Twilio. Revisa el historial antes de reintentar.",
        notificacion_id: notificacionId,
      },
      { status: 502 }
    );
  }
}