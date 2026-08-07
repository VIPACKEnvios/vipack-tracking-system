import { NextResponse } from "next/server";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Envio = {
  id: string | number;
  cliente?: string | null;
  telefono_whatsapp?: string | null;
  pedido?: string | null;
  guia?: string | null;
  paqueteria?: string | null;
  estado_17track?: string | null;
  estatus_actual?: string | null;
  ultimo_estado_enviado?: string | null;
};

function limpiarTelefono(valor: unknown) {
  const telefono = String(valor || "")
    .replace(/\D/g, "")
    .trim();

  if (!telefono) {
    return "";
  }

  if (
    telefono.startsWith("521") &&
    telefono.length === 13
  ) {
    return telefono;
  }

  if (
    telefono.startsWith("52") &&
    telefono.length === 12
  ) {
    return `521${telefono.slice(2)}`;
  }

  if (telefono.length === 10) {
    return `521${telefono}`;
  }

  return telefono;
}

function obtenerEstado(envio: Envio) {
  return String(
    envio.estado_17track ||
      envio.estatus_actual ||
      envio.ultimo_estado_enviado ||
      ""
  ).trim();
}

export async function POST(request: Request) {
  try {
    const twilioAccountSid =
      process.env.TWILIO_ACCOUNT_SID;

    const twilioAuthToken =
      process.env.TWILIO_AUTH_TOKEN;

    const fromWhatsApp =
      process.env.TWILIO_WHATSAPP_FROM;

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar NEXT_PUBLIC_SUPABASE_URL.",
        },
        { status: 500 }
      );
    }

    if (!supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    if (!twilioAccountSid) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar TWILIO_ACCOUNT_SID.",
        },
        { status: 500 }
      );
    }

    if (!twilioAuthToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar TWILIO_AUTH_TOKEN.",
        },
        { status: 500 }
      );
    }

    if (!fromWhatsApp) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar TWILIO_WHATSAPP_FROM.",
        },
        { status: 500 }
      );
    }

    // IMPORTANTE:
    // Supabase y Twilio se crean dentro del POST,
    // no cuando Vercel carga el archivo.
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const client = twilio(
      twilioAccountSid,
      twilioAuthToken
    );

    const cuerpo = await request.json();

    const id = cuerpo?.id;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Falta el ID del envío.",
        },
        { status: 400 }
      );
    }

    const {
      data: envioData,
      error: errorEnvio,
    } = await supabase
      .from("envios")
      .select("*")
      .eq("id", id)
      .single();

    if (errorEnvio || !envioData) {
      console.error(
        "Error consultando envío:",
        errorEnvio
      );

      return NextResponse.json(
        {
          success: false,
          error: "No se encontró el envío.",
          detalle:
            errorEnvio?.message || null,
          id,
        },
        { status: 404 }
      );
    }

    const envio = envioData as Envio;

    const telefono = limpiarTelefono(
      envio.telefono_whatsapp
    );

    const estadoActual =
      obtenerEstado(envio);

    if (
      !telefono ||
      telefono.length !== 13 ||
      !telefono.startsWith("521")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Teléfono inválido para WhatsApp México: ${
            envio.telefono_whatsapp || ""
          }`,
          telefono_limpio: telefono,
        },
        { status: 400 }
      );
    }

    if (!estadoActual) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El envío no tiene un estado para enviar.",
        },
        { status: 400 }
      );
    }

    const message =
      await client.messages.create({
        from: fromWhatsApp,

        to: `whatsapp:+${telefono}`,

        contentSid:
          "HX23277e717da845d5b292d5c196900566",

        contentVariables:
          JSON.stringify({
            "1": String(
              envio.cliente || "Cliente"
            ),

            "2": String(
              envio.pedido || "Sin pedido"
            ),

            "3": String(
              envio.paqueteria ||
                "Sin paquetería"
            ),

            "4": String(
              envio.guia || "Sin guía"
            ),

            "5": String(
              estadoActual || "Sin estado"
            ),
          }),
      });

    console.log("TWILIO RESPUESTA:", {
      sid: message.sid,
      status: message.status,
      to: message.to,
      from: message.from,
    });

    const {
      error: updateError,
    } = await supabase
      .from("envios")
      .update({
        ultimo_whatsapp:
          `Actualización enviada: ${estadoActual}`,

        ultimo_estado_enviado:
          estadoActual,

        fecha_envio:
          new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error(
        "Error actualizando Supabase:",
        updateError
      );

      return NextResponse.json({
        success: true,

        warning:
          "El WhatsApp fue enviado, pero no se pudo guardar la actualización en Supabase.",

        sid: message.sid,
        status: message.status,

        telefono:
          `whatsapp:+${telefono}`,

        estado: estadoActual,
      });
    }

    return NextResponse.json({
      success: true,

      message:
        "WhatsApp de actualización enviado correctamente.",

      sid: message.sid,
      status: message.status,

      telefono:
        `whatsapp:+${telefono}`,

      estado: estadoActual,
    });
  } catch (error: unknown) {
    console.error(
      "Error enviar actualización:",
      error
    );

    const mensaje =
      error instanceof Error
        ? error.message
        : "Error desconocido.";

    return NextResponse.json(
      {
        success: false,
        error: mensaje,
      },
      { status: 500 }
    );
  }
}