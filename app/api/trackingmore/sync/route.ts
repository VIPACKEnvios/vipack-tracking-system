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
  if (!data) {
    return null;
  }

  /*
   * Caso:
   * {
   *   tracking_number: "...",
   *   delivery_status: "..."
   * }
   */
  if (
    data.tracking_number ||
    data.tracking_number === 0
  ) {
    return data;
  }

  /*
   * Respuesta habitual:
   * {
   *   meta: {...},
   *   data: {...}
   * }
   */
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

    if (
      Array.isArray(data.data.trackings) &&
      data.data.trackings.length > 0
    ) {
      return data.data.trackings[0];
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
    return String(
      tracking.latest_event
    );
  }

  if (
    tracking?.latest_checkpoint?.message
  ) {
    return String(
      tracking.latest_checkpoint.message
    );
  }

  /*
   * Algunas respuestas de TrackingMore
   * traen los eventos en origin_info.trackinfo.
   */
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
  if (
    tracking?.latest_checkpoint_time
  ) {
    return (
      tracking.latest_checkpoint_time
    );
  }

  if (
    tracking?.latest_checkpoint
      ?.checkpoint_date
  ) {
    return (
      tracking.latest_checkpoint
        .checkpoint_date
    );
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

function obtenerDeliveryStatus(
  tracking: any
) {
  return String(
    tracking?.delivery_status ||
      tracking?.status ||
      tracking
        ?.checkpoint_delivery_status ||
      ""
  )
    .trim()
    .toLowerCase();
}

function obtenerSubstatus(
  tracking: any
) {
  return String(
    tracking?.substatus ||
      tracking
        ?.checkpoint_delivery_substatus ||
      ""
  ).trim();
}

/*
 * CONSULTAR UNA GUÍA YA REGISTRADA EN TRACKINGMORE V4
 *
 * /trackings/get usa los parámetros oficiales:
 * tracking_numbers y courier_code.
 */
async function consultarTrackingMore(
  apiKey: string,
  guia: string,
  courierCode: string
) {
  const trackingUrl = new URL(
    "https://api.trackingmore.com/v4/trackings/get"
  );

  trackingUrl.searchParams.set(
    "tracking_numbers",
    guia
  );

  trackingUrl.searchParams.set(
    "courier_code",
    courierCode
  );

  trackingUrl.searchParams.set(
    "items_amount",
    "10"
  );

  trackingUrl.searchParams.set(
    "pages_amount",
    "1"
  );

  const response = await fetch(
    trackingUrl.toString(),
    {
      method: "GET",

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Tracking-Api-Key": apiKey,
      },

      cache: "no-store",
    }
  );

  const rawText =
    await response.text();

  let data: any = null;

  try {
    data = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      tipo: "json_invalido",
      httpStatus: response.status,
      data: null,
      raw: rawText.slice(0, 500),
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      tipo: "error_trackingmore",
      httpStatus: response.status,
      data,
    };
  }

  const metaCode =
    Number(data?.meta?.code || 0);

  if (
    metaCode &&
    metaCode !== 200
  ) {
    return {
      ok: false,
      tipo: "error_trackingmore",
      httpStatus: response.status,
      data,
    };
  }

  const tracking =
    extraerTracking(data);

  if (!tracking) {
    return {
      ok: false,
      tipo: "sin_tracking",
      httpStatus: response.status,
      data,
    };
  }

  return {
    ok: true,
    tipo: "tracking",
    httpStatus: response.status,
    data,
    tracking,
  };
}

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    /*
     * ==============================
     * SEGURIDAD
     * ==============================
     */

    const secret =
      url.searchParams.get(
        "secret"
      ) || "";

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
          error:
            "No autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ==============================
     * VARIABLES DE ENTORNO
     * ==============================
     */

    const apiKey =
      process.env
        .TRACKINGMORE_API_KEY;

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY;

    const webhookSecret =
      process.env
        .TRACKINGMORE_WEBHOOK_SECRET;

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

    /*
     * ==============================
     * SUPABASE
     * ==============================
     */

    const supabase =
      createClient(
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
     * ==============================
     * MODO PRUEBA
     * ==============================
     *
     * ?guia=2697872914
     *
     * Si viene una guía,
     * solamente revisamos esa.
     */

    const guiaPrueba =
      limpiarGuia(
        url.searchParams.get(
          "guia"
        )
      );

    let consulta =
      supabase
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
      consulta =
        consulta.eq(
          "guia",
          guiaPrueba
        );
    } else {
      /*
       * MODO AUTOMÁTICO
       *
       * Solo revisar envíos
       * que todavía no estén
       * marcados como entregados.
       */
      consulta =
        consulta
          .or(
            "entregado.eq.false,entregado.is.null"
          )
          .order(
            "id",
            {
              ascending: false,
            }
          )
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
          error:
            errorEnvios.message,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ==============================
     * RESULTADOS
     * ==============================
     */

    const resultados: any[] =
      [];

    /*
     * ==============================
     * PROCESAR ENVÍOS
     * ==============================
     */

    for (
      const envio of envios || []
    ) {
      const guias =
        extraerGuias(
          envio.guia
        );

      if (
        guias.length === 0
      ) {
        resultados.push({
          envio_id: envio.id,
          estado: "omitido",
          motivo:
            "Sin guía válida",
        });

        continue;
      }

      /*
       * Obtener courier.
       */

      const courierCode =
        obtenerCourierCode(
          envio.paqueteria,
          envio
            .trackingmore_courier
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

      /*
       * Puede haber más de una
       * guía en el registro.
       */

      for (
        const guia of guias
      ) {
        try {
          /*
           * ==========================
           * TRACKINGMORE
           * ==========================
           */

          const resultadoTracking =
            await consultarTrackingMore(
              apiKey,
              guia,
              courierCode
            );

          /*
           * Error JSON.
           */

          if (
            resultadoTracking.tipo ===
            "json_invalido"
          ) {
            resultados.push({
              envio_id: envio.id,
              guia,
              estado: "error",
              tipo:
                resultadoTracking.tipo,
              http_status:
                resultadoTracking
                  .httpStatus,
              respuesta:
                resultadoTracking.raw,
            });

            continue;
          }

          /*
           * La guía ya estaba registrada
           * pero TrackingMore no devolvió
           * los datos del tracking.
           *
           * Lo mostramos claramente para
           * poder decidir el siguiente
           * endpoint si la cuenta responde
           * de esta manera.
           */

          if (
            resultadoTracking.tipo ===
            "tracking_ya_existia"
          ) {
            resultados.push({
              envio_id: envio.id,
              guia,
              estado:
                "tracking_ya_existia",
              http_status:
                resultadoTracking
                  .httpStatus,
              respuesta:
                resultadoTracking.data,
            });

            continue;
          }

          /*
           * Cualquier otro error.
           */

          if (
            !resultadoTracking.ok
          ) {
            resultados.push({
              envio_id: envio.id,
              guia,
              estado: "error",
              tipo:
                resultadoTracking.tipo,
              http_status:
                resultadoTracking
                  .httpStatus,
              respuesta:
                resultadoTracking.data,
            });

            continue;
          }

          /*
           * ==========================
           * TRACKING ENCONTRADO
           * ==========================
           */

          const tracking =
            resultadoTracking.tracking;

          if (!tracking) {
            resultados.push({
              envio_id: envio.id,
              guia,
              estado:
                "sin_resultado",
              respuesta:
                resultadoTracking.data,
            });

            continue;
          }

          /*
           * Estado TrackingMore.
           */

          const deliveryStatus =
            obtenerDeliveryStatus(
              tracking
            );

          const substatus =
            obtenerSubstatus(
              tracking
            );

          const latestEvent =
            obtenerUltimoEvento(
              tracking
            );

          const checkpoint =
            obtenerCheckpoint(
              tracking
            );

          if (
            !deliveryStatus
          ) {
            resultados.push({
              envio_id: envio.id,
              guia,
              estado:
                "sin_estado_trackingmore",
              respuesta:
                tracking,
            });

            continue;
          }

          /*
           * ==========================
           * REUTILIZAR WEBHOOK VIPACK
           * ==========================
           *
           * El webhook ya contiene
           * nuestra lógica para:
           *
           * - traducir estados
           * - actualizar Supabase
           * - marcar entregado
           * - actualizar fecha
           * - evitar WhatsApp duplicado
           */

          const webhookUrl =
            new URL(
              "/api/trackingmore/webhook",
              url.origin
            );

          webhookUrl
            .searchParams
            .set(
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

                body:
                  JSON.stringify({
                    data: {
                      id:
                        tracking.id ||
                        null,

                      tracking_number:
                        guia,

                      courier_code:
                        tracking
                          .courier_code ||
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

                cache:
                  "no-store",
              }
            );

          /*
           * Leer respuesta webhook.
           */

          const webhookText =
            await webhookResponse
              .text();

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
                  500
                ),
            };
          }

          /*
           * Guardar resultado.
           */

          resultados.push({
            envio_id: envio.id,

            guia,

            courier_code:
              courierCode,

            trackingmore_status:
              deliveryStatus,

            trackingmore_substatus:
              substatus || null,

            trackingmore_event:
              latestEvent || null,

            vipack_estado_anterior:
              envio.estatus_actual,

            webhook_ok:
              webhookResponse.ok,

            webhook_status:
              webhookResponse.status,

            webhook:
              webhookData,
          });

          /*
           * ==========================
           * PAUSA
           * ==========================
           *
           * Create V4 tiene límite
           * predeterminado de 3 req/s.
           *
           * 400 ms deja margen.
           */

          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                400
              )
          );
        } catch (
          error: unknown
        ) {
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
     * ==============================
     * RESUMEN
     * ==============================
     */

    const errores =
      resultados.filter(
        (r) =>
          r.estado === "error"
      ).length;

    const omitidos =
      resultados.filter(
        (r) =>
          r.estado === "omitido"
      ).length;

    const yaExistian =
      resultados.filter(
        (r) =>
          r.estado ===
          "tracking_ya_existia"
      ).length;

    const webhookCorrectos =
      resultados.filter(
        (r) =>
          r.webhook_ok === true
      ).length;

    /*
     * ==============================
     * RESPUESTA
     * ==============================
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
        new Date()
          .toISOString(),

      resumen: {
        envios_revisados:
          envios?.length || 0,

        guias_procesadas:
          resultados.length,

        webhook_correctos:
          webhookCorrectos,

        tracking_ya_existian:
          yaExistian,

        errores,

        omitidos,
      },

      resultados,
    });
  } catch (
    error: unknown
  ) {
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