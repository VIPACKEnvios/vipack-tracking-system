import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function limpiarGuia(valor: unknown) {
  return String(valor || "")
    .replace(/\D/g, "")
    .trim();
}

function obtenerCourierCode(
  paqueteria: unknown,
  trackingmoreCourier: unknown
) {
  const courierGuardado = String(
    trackingmoreCourier || ""
  )
    .trim()
    .toLowerCase();

  if (courierGuardado) {
    return courierGuardado;
  }

  const p = String(paqueteria || "")
    .trim()
    .toUpperCase();

  if (p.includes("ESTAFETA")) {
    return "estafetausa";
  }

  if (p.includes("DHL")) {
    return "dhl";
  }

  return "";
}

function extraerGuias(valor: unknown) {
  const texto = String(valor || "");

  const guias = texto
    .split(/[,;\n\r|]+/)
    .map((g) => limpiarGuia(g))
    .filter(Boolean);

  return [...new Set(guias)];
}

function extraerTracking(data: any) {
  if (!data) return null;

  if (
    data.tracking_number ||
    data.tracking_number === 0
  ) {
    return data;
  }

  if (data.data) {
    if (Array.isArray(data.data)) {
      return data.data[0] || null;
    }

    if (
      data.data.tracking_number ||
      data.data.delivery_status ||
      data.data.status
    ) {
      return data.data;
    }

    if (
      Array.isArray(data.data.items) &&
      data.data.items.length > 0
    ) {
      return data.data.items[0];
    }
  }

  if (
    Array.isArray(data.items) &&
    data.items.length > 0
  ) {
    return data.items[0];
  }

  return null;
}

function obtenerUltimoEvento(tracking: any) {
  if (tracking?.latest_event) {
    return String(tracking.latest_event);
  }

  if (tracking?.latest_checkpoint?.message) {
    return String(
      tracking.latest_checkpoint.message
    );
  }

  const origen =
    tracking?.origin_info?.trackinfo;

  if (
    Array.isArray(origen) &&
    origen.length > 0
  ) {
    const ultimo = origen[0];

    return String(
      ultimo?.tracking_detail ||
        ultimo?.checkpoint_delivery_status ||
        ""
    );
  }

  return "";
}

function obtenerCheckpoint(tracking: any) {
  if (tracking?.latest_checkpoint_time) {
    return tracking.latest_checkpoint_time;
  }

  if (
    tracking?.latest_checkpoint?.checkpoint_date
  ) {
    return tracking.latest_checkpoint
      .checkpoint_date;
  }

  const origen =
    tracking?.origin_info?.trackinfo;

  if (
    Array.isArray(origen) &&
    origen.length > 0
  ) {
    return (
      origen[0]?.checkpoint_date ||
      origen[0]?.Date ||
      null
    );
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    /*
     * SEGURIDAD
     */
    const secret =
      url.searchParams.get("secret") || "";

    const syncSecret =
      process.env.SYNC_SECRET || "";

    if (!syncSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar SYNC_SECRET.",
        },
        {
          status: 500,
        }
      );
    }

    if (secret !== syncSecret) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * VARIABLES
     */
    const apiKey =
      process.env.TRACKINGMORE_API_KEY;

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    const webhookSecret =
      process.env.TRACKINGMORE_WEBHOOK_SECRET;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta TRACKINGMORE_API_KEY.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faltan variables de Supabase.",
        },
        {
          status: 500,
        }
      );
    }

    if (!webhookSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta TRACKINGMORE_WEBHOOK_SECRET.",
        },
        {
          status: 500,
        }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    /*
     * MODO DE PRUEBA
     *
     * Si recibimos ?guia=XXXXXXXXXX,
     * solamente revisamos esa guía.
     */
    const guiaPrueba =
      limpiarGuia(
        url.searchParams.get("guia")
      );

    let consulta = supabase
      .from("envios")
      .select(
        `
          id,
          guia,
          paqueteria,
          estatus_actual,
          entregado,
          trackingmore_courier
        `
      );

    if (guiaPrueba) {
      consulta = consulta.eq(
        "guia",
        guiaPrueba
      );
    } else {
      /*
       * MODO AUTOMÁTICO
       *
       * Solamente revisamos envíos
       * que todavía NO estén entregados.
       */
      consulta = consulta
        .or(
          "entregado.eq.false,entregado.is.null"
        )
        .order("id", {
          ascending: false,
        })
        .limit(300);
    }

    const {
      data: envios,
      error: errorEnvios,
    } = await consulta;

    if (errorEnvios) {
      return NextResponse.json(
        {
          success: false,
          error: errorEnvios.message,
        },
        {
          status: 500,
        }
      );
    }

    const resultados: any[] = [];

    /*
     * PROCESAR ENVÍOS
     */
    for (const envio of envios || []) {
      const guias =
        extraerGuias(envio.guia);

      if (guias.length === 0) {
        resultados.push({
          envio_id: envio.id,
          estado: "omitido",
          motivo: "Sin guía válida",
        });

        continue;
      }

      const courierCode =
        obtenerCourierCode(
          envio.paqueteria,
          envio.trackingmore_courier
        );

      if (!courierCode) {
        resultados.push({
          envio_id: envio.id,
          guia: envio.guia,
          estado: "omitido",
          motivo:
            "Paquetería no configurada",
        });

        continue;
      }

      for (const guia of guias) {
        try {
          /*
           * CONSULTAR TRACKINGMORE
           */
          const trackingUrl =
            new URL(
              "https://api.trackingmore.com/v4/trackings/get"
            );

          trackingUrl.searchParams.set(
            "tracknumber",
            guia
          );

          trackingUrl.searchParams.set(
            "express",
            courierCode
          );

          const response =
            await fetch(
              trackingUrl.toString(),
              {
                method: "GET",

                headers: {
                  Accept:
                    "application/json",

                  "Content-Type":
                    "application/json",

                  "Tracking-Api-Key":
                    apiKey,
                },

                cache: "no-store",
              }
            );

          const rawText =
            await response.text();

          let data: any;

          try {
            data =
              JSON.parse(rawText);
          } catch {
            resultados.push({
              envio_id: envio.id,
              guia,
              estado: "error",
              error:
                "TrackingMore respondió con JSON inválido",
              respuesta:
                rawText.slice(0, 300),
            });

            continue;
          }

          if (!response.ok) {
            resultados.push({
              envio_id: envio.id,
              guia,
              estado: "error",
              http_status:
                response.status,
              respuesta: data,
            });

            continue;
          }

          /*
           * EXTRAER TRACKING
           */
          const tracking =
            extraerTracking(data);

          if (!tracking) {
            resultados.push({
              envio_id: envio.id,
              guia,
              estado: "sin_resultado",
              respuesta: data,
            });

            continue;
          }

          const deliveryStatus =
            String(
              tracking.delivery_status ||
                tracking.status ||
                tracking
                  .checkpoint_delivery_status ||
                ""
            )
              .trim()
              .toLowerCase();

          const substatus =
            String(
              tracking.substatus ||
                tracking
                  .checkpoint_delivery_substatus ||
                ""
            ).trim();

          const latestEvent =
            obtenerUltimoEvento(
              tracking
            );

          const checkpoint =
            obtenerCheckpoint(
              tracking
            );

          if (!deliveryStatus) {
            resultados.push({
              envio_id: envio.id,
              guia,
              estado:
                "sin_estado_trackingmore",
              respuesta: tracking,
            });

            continue;
          }

          /*
           * ENVIAR LA INFORMACIÓN AL WEBHOOK
           *
           * Así reutilizamos la lógica que ya
           * actualiza Supabase y WhatsApp.
           */
          const webhookUrl =
            new URL(
              "/api/trackingmore/webhook",
              url.origin
            );

          webhookUrl.searchParams.set(
            "secret",
            webhookSecret
          );

          const webhookResponse =
            await fetch(
              webhookUrl.toString(),
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify({
                  data: {
                    id:
                      tracking.id ||
                      null,

                    tracking_number:
                      guia,

                    courier_code:
                      tracking.courier_code ||
                      courierCode,

                    delivery_status:
                      deliveryStatus,

                    substatus:
                      substatus ||
                      null,

                    latest_event:
                      latestEvent ||
                      null,

                    latest_checkpoint_time:
                      checkpoint ||
                      null,
                  },
                }),

                cache: "no-store",
              }
            );

          const webhookText =
            await webhookResponse.text();

          let webhookData: any;

          try {
            webhookData =
              JSON.parse(
                webhookText
              );
          } catch {
            webhookData = {
              raw:
                webhookText.slice(
                  0,
                  300
                ),
            };
          }

          resultados.push({
            envio_id: envio.id,
            guia,

            trackingmore_status:
              deliveryStatus,

            vipack_estado_anterior:
              envio.estatus_actual,

            webhook_ok:
              webhookResponse.ok,

            webhook:
              webhookData,
          });

          /*
           * PAUSA PARA NO SATURAR API
           */
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                150
              )
          );
        } catch (error: unknown) {
          resultados.push({
            envio_id: envio.id,
            guia,
            estado: "error",
            error:
              error instanceof Error
                ? error.message
                : "Error desconocido",
          });
        }
      }
    }

    /*
     * RESULTADO
     */
    return NextResponse.json({
      success: true,

      modo:
        guiaPrueba
          ? "prueba"
          : "automatico",

      guia_prueba:
        guiaPrueba || null,

      fecha:
        new Date().toISOString(),

      resumen: {
        envios_revisados:
          envios?.length || 0,

        guias_procesadas:
          resultados.length,

        errores:
          resultados.filter(
            (r) =>
              r.estado === "error"
          ).length,

        omitidos:
          resultados.filter(
            (r) =>
              r.estado === "omitido"
          ).length,

        webhook_correctos:
          resultados.filter(
            (r) =>
              r.webhook_ok === true
          ).length,
      },

      resultados,
    });
  } catch (error: unknown) {
    console.error(
      "Error TrackingMore sync:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido.",
      },
      {
        status: 500,
      }
    );
  }
}