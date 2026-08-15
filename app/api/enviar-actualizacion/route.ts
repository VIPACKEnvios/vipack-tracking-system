import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTUALIZACION_TEMPLATE =
  "HX23277e717da845d5b292d5c196900566";

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
  fecha_envio?: string | null;
  fecha_ultima_revision?: string | null;
};

function limpiarTelefono(
  valor: unknown
) {
  const telefono = String(
    valor || ""
  )
    .replace(/\D/g, "")
    .trim();

  if (!telefono) {
    return "";
  }

  /*
   * México:
   * Guardamos/mandamos en formato 521XXXXXXXXXX
   * porque así está trabajando actualmente
   * la base de VIPACK con WhatsApp.
   */
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

  if (
    telefono.length === 10
  ) {
    return `521${telefono}`;
  }

  return telefono;
}

function obtenerEstado(
  envio: Envio
) {
  return String(
    envio.estado_17track ||
      envio.estatus_actual ||
      envio.ultimo_estado_enviado ||
      ""
  ).trim();
}

export async function POST(
  request: Request
) {
  try {
    /*
     * Seguridad:
     * Solo permitir esta acción si existe
     * la sesión del panel VIPACK.
     */
    const cookieStore =
      await cookies();

    const auth =
      cookieStore.get(
        "vipack-auth"
      );

    if (!auth) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const twilioAccountSid =
      process.env
        .TWILIO_ACCOUNT_SID;

    const twilioAuthToken =
      process.env
        .TWILIO_AUTH_TOKEN;

    /*
     * Aceptamos cualquiera de los dos nombres
     * de variable que has usado en el proyecto.
     */
    const fromWhatsApp =
      process.env
        .TWILIO_WHATSAPP_FROM ||
      process.env
        .TWILIO_WHATSAPP_NUMBER;

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const supabaseServiceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar NEXT_PUBLIC_SUPABASE_URL.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !supabaseServiceRoleKey
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar SUPABASE_SERVICE_ROLE_KEY.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !twilioAccountSid
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar TWILIO_ACCOUNT_SID.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !twilioAuthToken
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar TWILIO_AUTH_TOKEN.",
        },
        {
          status: 500,
        }
      );
    }

    if (!fromWhatsApp) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar TWILIO_WHATSAPP_FROM o TWILIO_WHATSAPP_NUMBER.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Supabase y Twilio se crean dentro del POST
     * para evitar problemas durante el build
     * de Vercel.
     */
    const supabase =
      createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken:
              false,
            persistSession:
              false,
          },
        }
      );

    const client =
      twilio(
        twilioAccountSid,
        twilioAuthToken
      );

    let cuerpo: any;

    try {
      cuerpo =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "El cuerpo de la solicitud no es JSON válido.",
        },
        {
          status: 400,
        }
      );
    }

    const id =
      cuerpo?.id;

    if (
      id === undefined ||
      id === null ||
      String(id).trim() === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta el ID del envío.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * IMPORTANTE:
     * Solo consultamos el registro.
     * Nunca hacemos delete().
     */
    const {
      data: envioData,
      error: errorEnvio,
    } =
      await supabase
        .from("envios")
        .select("*")
        .eq("id", id)
        .single();

    if (
      errorEnvio ||
      !envioData
    ) {
      console.error(
        "Error consultando envío:",
        errorEnvio
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se encontró el envío.",
          detalle:
            errorEnvio?.message ||
            null,
          id,
        },
        {
          status: 404,
        }
      );
    }

    const envio =
      envioData as Envio;

    const telefono =
      limpiarTelefono(
        envio
          .telefono_whatsapp
      );

    const estadoActual =
      obtenerEstado(
        envio
      );

    if (
      !telefono ||
      telefono.length !== 13 ||
      !telefono.startsWith(
        "521"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Teléfono inválido para WhatsApp México: ${
              envio
                .telefono_whatsapp ||
              ""
            }`,
          telefono_limpio:
            telefono,
        },
        {
          status: 400,
        }
      );
    }

    if (
      !estadoActual
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El envío no tiene un estado para enviar.",
        },
        {
          status: 400,
        }
      );
    }

    const message =
      await client
        .messages
        .create({
          from:
            fromWhatsApp,

          to:
            `whatsapp:+${telefono}`,

          contentSid:
            ACTUALIZACION_TEMPLATE,

          contentVariables:
            JSON.stringify(
              {
                "1":
                  String(
                    envio.cliente ||
                      "Cliente"
                  ),

                "2":
                  String(
                    envio.pedido ||
                      "Sin pedido"
                  ),

                "3":
                  String(
                    envio.paqueteria ||
                      "Sin paquetería"
                  ),

                "4":
                  String(
                    envio.guia ||
                      "Sin guía"
                  ),

                "5":
                  String(
                    estadoActual ||
                      "Sin estado"
                  ),
              }
            ),
        });

    console.log(
      "TWILIO RESPUESTA:",
      {
        sid:
          message.sid,
        status:
          message.status,
        to:
          message.to,
        from:
          message.from,
        envioId:
          envio.id,
      }
    );

    /*
     * MUY IMPORTANTE:
     *
     * NO modificar fecha_envio.
     *
     * fecha_envio debe conservar la fecha
     * original en que se creó/envió la guía.
     *
     * Antes este endpoint hacía:
     *
     * fecha_envio: new Date().toISOString()
     *
     * y eso destruía el historial cronológico.
     *
     * Solo actualizamos fecha_ultima_revision.
     */
    const ahora =
      new Date()
        .toISOString();

    const {
      error:
        updateError,
    } =
      await supabase
        .from("envios")
        .update({
          ultimo_whatsapp:
            `Actualización enviada: ${estadoActual}`,

          ultimo_estado_enviado:
            estadoActual,

          fecha_ultima_revision:
            ahora,
        })
        .eq("id", id);

    if (
      updateError
    ) {
      console.error(
        "Error actualizando Supabase:",
        updateError
      );

      return NextResponse.json({
        success: true,

        warning:
          "El WhatsApp fue enviado, pero no se pudo guardar la actualización en Supabase.",

        sid:
          message.sid,

        status:
          message.status,

        telefono:
          `whatsapp:+${telefono}`,

        estado:
          estadoActual,

        fecha_envio_original:
          envio.fecha_envio ||
          null,
      });
    }

    return NextResponse.json({
      success: true,

      message:
        "WhatsApp de actualización enviado correctamente.",

      sid:
        message.sid,

      status:
        message.status,

      telefono:
        `whatsapp:+${telefono}`,

      estado:
        estadoActual,

      /*
       * Se devuelve únicamente para confirmar
       * que la fecha histórica fue respetada.
       */
      fecha_envio:
        envio.fecha_envio ||
        null,

      fecha_ultima_revision:
        ahora,
    });
  } catch (
    error: unknown
  ) {
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
        error:
          mensaje,
      },
      {
        status: 500,
      }
    );
  }
}