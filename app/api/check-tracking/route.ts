import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import twilio from "twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const ACTUALIZACION_TEMPLATE =
  "HX23277e717da845d5b292d5c196900566";

/*
 * 17TRACK funciona mejor si no mandamos
 * demasiadas guías en una sola petición.
 */
const TAMANO_LOTE_17TRACK = 40;

function traducirEstado(status: string) {
  const estados: Record<string, string> = {
    InfoReceived: "Información recibida por paquetería",
    PickUp: "Recolectado por paquetería",
    AvailableForPickup: "Disponible para recoger en oficinas",
    InTransit: "En tránsito",
    OutForDelivery: "En ruta de entrega a tu domicilio",
    DeliveryFailure: "Intento de entrega fallido",
    Delivered: "Entregado",
    Exception: "Envío en espera del siguiente proceso.",
    NotFound: "Envío en espera de ser registrado por la paquetería",
    Expired: "Caducado",
  };

  return estados[status] || status || "Sin actualización";
}

function limpiarGuia(valor: unknown) {
  return String(valor || "")
    .replace(/\D/g, "")
    .trim();
}

/*
 * Soporta:
 * 1234567890
 * 1234567890, 0987654321
 * 1234567890; 0987654321
 * varias guías en líneas separadas
 */
function extraerGuias(valor: unknown): string[] {
  const texto = String(valor || "").trim();

  if (!texto) {
    return [];
  }

  const partes = texto
    .split(/[,;\n\r|]+/)
    .map((parte) => limpiarGuia(parte))
    .filter(Boolean);

  /*
   * Si no había separadores, usamos el valor completo.
   */
  const guias =
    partes.length > 0
      ? partes
      : [limpiarGuia(texto)].filter(Boolean);

  /*
   * Quitar duplicados.
   */
  return [...new Set(guias)];
}

function limpiarTelefono(valor: unknown) {
  return String(valor || "")
    .replace(/\D/g, "")
    .trim();
}

function dividirEnLotes<T>(
  elementos: T[],
  tamano: number
): T[][] {
  const lotes: T[][] = [];

  for (
    let i = 0;
    i < elementos.length;
    i += tamano
  ) {
    lotes.push(
      elementos.slice(
        i,
        i + tamano
      )
    );
  }

  return lotes;
}

function coincideGuia(
  guia17Track: unknown,
  guiaLocal: string
) {
  const guia17 =
    limpiarGuia(guia17Track);

  if (
    !guia17 ||
    !guiaLocal
  ) {
    return false;
  }

  return (
    guia17 === guiaLocal ||
    guia17.endsWith(guiaLocal) ||
    guiaLocal.endsWith(guia17)
  );
}

/*
 * Si una fila tiene varias guías y 17TRACK devuelve
 * diferentes estados, usamos el estado más avanzado.
 */
function prioridadEstado(
  status: string
) {
  const prioridades:
    Record<string, number> = {
      SinActualizacion: 0,
      NotFound: 1,
      InfoReceived: 2,
      PickUp: 3,
      InTransit: 4,
      Exception: 5,
      DeliveryFailure: 6,
      AvailableForPickup: 7,
      OutForDelivery: 8,
      Delivered: 9,
    };

  return prioridades[status] ?? 0;
}

function obtenerStatusOriginal(
  aceptado: any
) {
  const ultimoEvento =
    aceptado?.track_info
      ?.latest_event
      ?.description ||
    aceptado?.track_info
      ?.latest_event
      ?.location ||
    "";

  let statusOriginal =
    aceptado?.track_info
      ?.latest_status
      ?.status ||
    aceptado?.track_info
      ?.latest_event
      ?.stage ||
    "SinActualizacion";

  const eventoTexto =
    String(
      ultimoEvento
    ).toLowerCase();

  if (
    eventoTexto.includes(
      "mensajero"
    ) ||
    eventoTexto.includes(
      "reparto"
    ) ||
    eventoTexto.includes(
      "ruta"
    ) ||
    eventoTexto.includes(
      "out for delivery"
    )
  ) {
    statusOriginal =
      "OutForDelivery";
  }

  return {
    statusOriginal,
    ultimoEvento,
  };
}

async function actualizarEnvio(
  id: number,
  cambios: Record<
    string,
    unknown
  >
) {
  const {
    error,
  } =
    await supabase
      .from("envios")
      .update(cambios)
      .eq("id", id);

  if (error) {
    throw new Error(
      `Error actualizando envío ${id}: ${error.message}`
    );
  }
}

async function consultar17Track(
  numeros: string[]
) {
  const accepted: any[] = [];
  const rejected: any[] = [];

  const numerosUnicos =
    [...new Set(
      numeros.filter(Boolean)
    )];

  const lotes =
    dividirEnLotes(
      numerosUnicos,
      TAMANO_LOTE_17TRACK
    );

  for (
    const lote of lotes
  ) {
    const response17 =
      await fetch(
        "https://api.17track.net/track/v2.2/gettrackinfo",
        {
          method: "POST",
          headers: {
            "17token":
              process.env
                .TRACK17_API_KEY!,
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify(
              lote.map(
                (number) => ({
                  number,
                })
              )
            ),
          cache: "no-store",
        }
      );

    const rawText =
      await response17.text();

    let data17: any;

    try {
      data17 =
        JSON.parse(
          rawText
        );
    } catch {
      throw new Error(
        `17TRACK respondió formato inválido: ${rawText.slice(
          0,
          300
        )}`
      );
    }

    if (!response17.ok) {
      throw new Error(
        data17?.message ||
          data17?.error ||
          `17TRACK respondió HTTP ${response17.status}`
      );
    }

    accepted.push(
      ...(
        data17?.data
          ?.accepted ||
        []
      )
    );

    rejected.push(
      ...(
        data17?.data
          ?.rejected ||
        []
      )
    );
  }

  return {
    accepted,
    rejected,
  };
}

export async function GET() {
  try {
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
            "No autorizado",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * IMPORTANTE:
     * Aquí NO se elimina ningún envío.
     *
     * Revisamos:
     * - entregado = false
     * - entregado = null
     *
     * Esto evita dejar fuera registros antiguos
     * que pudieran tener el booleano vacío.
     */
    const {
      data: envios,
      error,
    } =
      await supabase
        .from("envios")
        .select("*")
        .or(
          "entregado.eq.false,entregado.is.null"
        )
        .order(
          "id",
          {
            ascending: true,
          }
        );

    if (error) {
      throw error;
    }

    if (
      !envios ||
      envios.length === 0
    ) {
      return NextResponse.json({
        success: true,
        total: 0,
        resultados: [],
        mensaje:
          "No hay envíos pendientes de revisar.",
      });
    }

    /*
     * Sacamos TODAS las guías.
     * Una misma fila puede contener 2 o más.
     */
    const todasLasGuias =
      envios.flatMap(
        (envio: any) =>
          extraerGuias(
            envio.guia
          )
      );

    if (
      todasLasGuias.length ===
      0
    ) {
      return NextResponse.json({
        success: true,
        total: 0,
        resultados: [],
        mensaje:
          "No hay guías válidas para revisar.",
      });
    }

    const {
      accepted:
        acceptedList,
      rejected:
        rejectedList,
    } =
      await consultar17Track(
        todasLasGuias
      );

    const resultados:
      any[] = [];

    for (
      const envio of envios
    ) {
      try {
        const guiasEnvio =
          extraerGuias(
            envio.guia
          );

        if (
          guiasEnvio.length ===
          0
        ) {
          resultados.push({
            id: envio.id,
            guia: envio.guia,
            cliente:
              envio.cliente,
            actualizado: false,
            motivo:
              "Guía inválida",
          });

          continue;
        }

        /*
         * Buscar todas las guías de esta fila
         * dentro de las respuestas aceptadas.
         */
        const aceptadosEnvio =
          acceptedList.filter(
            (item: any) =>
              guiasEnvio.some(
                (guiaLocal) =>
                  coincideGuia(
                    item.number,
                    guiaLocal
                  )
              )
          );

        if (
          aceptadosEnvio.length ===
          0
        ) {
          const rechazadosEnvio =
            rejectedList.filter(
              (item: any) =>
                guiasEnvio.some(
                  (guiaLocal) =>
                    coincideGuia(
                      item.number,
                      guiaLocal
                    )
                )
            );

          await actualizarEnvio(
            envio.id,
            {
              fecha_ultima_revision:
                new Date()
                  .toISOString(),
            }
          );

          resultados.push({
            id: envio.id,
            guia: envio.guia,
            guias:
              guiasEnvio,
            cliente:
              envio.cliente,
            actualizado: false,
            motivo:
              rechazadosEnvio?.[0]
                ?.error
                ?.message ||
              "Sin información de 17TRACK",
          });

          continue;
        }

        /*
         * Convertimos cada respuesta a un estado
         * y elegimos el más avanzado.
         */
        const estados =
          aceptadosEnvio.map(
            (aceptado: any) => {
              const {
                statusOriginal,
                ultimoEvento,
              } =
                obtenerStatusOriginal(
                  aceptado
                );

              return {
                aceptado,
                statusOriginal,
                ultimoEvento,
              };
            }
          );

        estados.sort(
          (a, b) =>
            prioridadEstado(
              b.statusOriginal
            ) -
            prioridadEstado(
              a.statusOriginal
            )
        );

        const estadoElegido =
          estados[0];

        const statusOriginal =
          estadoElegido
            ?.statusOriginal ||
          "SinActualizacion";

        const statusTraducido =
          traducirEstado(
            statusOriginal
          );

        const yaSeEnvioEseEstado =
          String(
            envio
              .ultimo_estado_enviado ||
              ""
          ).trim() ===
          String(
            statusTraducido
          ).trim();

        const esEntregado =
          statusOriginal ===
          "Delivered";

        /*
         * Solo actualizamos.
         * NUNCA hacemos delete().
         */
        await actualizarEnvio(
          envio.id,
          {
            estatus_actual:
              statusTraducido,

            entregado:
              esEntregado,

            fecha_ultima_revision:
              new Date()
                .toISOString(),
          }
        );

        let whatsappEnviado =
          false;

        if (
          !yaSeEnvioEseEstado &&
          statusTraducido !==
            "Sin actualización"
        ) {
          const telefono =
            limpiarTelefono(
              envio
                .telefono_whatsapp
            );

          if (!telefono) {
            await actualizarEnvio(
              envio.id,
              {
                ultimo_whatsapp:
                  "Error WhatsApp: teléfono vacío",
              }
            );
          } else {
            try {
              await client
                .messages
                .create({
                  from:
                    process.env
                      .TWILIO_WHATSAPP_NUMBER!,

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
                              "Paquetería"
                          ),

                        "4":
                          String(
                            envio.guia ||
                              "Sin guía"
                          ),

                        "5":
                          String(
                            statusTraducido ||
                              "Sin actualización"
                          ),
                      }
                    ),
                });

              whatsappEnviado =
                true;

              await actualizarEnvio(
                envio.id,
                {
                  ultimo_estado_enviado:
                    statusTraducido,

                  ultimo_whatsapp:
                    `Actualización enviada: ${statusTraducido}`,

                  whatsapp_entregado:
                    esEntregado
                      ? true
                      : Boolean(
                          envio
                            .whatsapp_entregado
                        ),
                }
              );
            } catch (
              twilioError: any
            ) {
              console.error(
                `Error Twilio envío ${envio.id}:`,
                twilioError
              );

              await actualizarEnvio(
                envio.id,
                {
                  ultimo_whatsapp:
                    `Error WhatsApp: ${
                      twilioError
                        ?.message ||
                      "Error desconocido"
                    }`,
                }
              );
            }
          }
        }

        resultados.push({
          id: envio.id,
          guia: envio.guia,
          guias:
            guiasEnvio,

          cliente:
            envio.cliente,

          statusOriginal,
          statusTraducido,

          entregado:
            esEntregado,

          whatsapp_enviado:
            whatsappEnviado,
        });
      } catch (
        errorEnvio: any
      ) {
        console.error(
          `Error procesando envío ${envio.id}:`,
          errorEnvio
        );

        resultados.push({
          id: envio.id,
          guia: envio.guia,
          cliente:
            envio.cliente,
          actualizado: false,
          error:
            errorEnvio
              ?.message ||
            "Error procesando envío",
        });
      }
    }

    return NextResponse.json({
      success: true,
      total:
        resultados.length,
      resultados,
    });
  } catch (
    error: any
  ) {
    console.error(
      "Error check-tracking:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Error desconocido al revisar tracking",
      },
      {
        status: 500,
      }
    );
  }
}