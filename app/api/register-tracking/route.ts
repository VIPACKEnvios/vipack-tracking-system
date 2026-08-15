import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function obtenerCarrier(
  paqueteria: string
) {
  const p = String(
    paqueteria || ""
  )
    .trim()
    .toUpperCase();

  if (p.includes("DHL")) {
    return 100001;
  }

  /*
   * En tu código anterior ESTAFETA devolvía undefined,
   * por lo que todas sus guías eran descartadas.
   *
   * Dejamos carrier sin especificar para Estafeta
   * y permitimos que 17TRACK intente autodetectarlo.
   */
  if (
    p.includes("ESTAFETA")
  ) {
    return undefined;
  }

  if (p.includes("FEDEX")) {
    return 100003;
  }

  /*
   * Para otras paqueterías dejamos que
   * 17TRACK intente detectar el carrier.
   */
  return undefined;
}

function limpiarGuia(
  valor: unknown
) {
  return String(
    valor || ""
  )
    .replace(/\D/g, "")
    .trim();
}

/*
 * Soporta una o varias guías:
 *
 * 123456789
 * 123456789, 987654321
 * 123456789; 987654321
 * guías separadas por salto de línea
 */
function extraerGuias(
  valor: unknown
): string[] {
  const texto = String(
    valor || ""
  ).trim();

  if (!texto) {
    return [];
  }

  const partes =
    texto
      .split(/[,;\n\r|]+/)
      .map(
        (parte) =>
          limpiarGuia(
            parte
          )
      )
      .filter(Boolean);

  if (
    partes.length === 0
  ) {
    const unica =
      limpiarGuia(
        texto
      );

    return unica
      ? [unica]
      : [];
  }

  return [
    ...new Set(partes),
  ];
}

export async function GET() {
  try {
    /*
     * Seguridad:
     * solo permitir registro desde
     * una sesión activa de VIPACK.
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

    if (
      !process.env
        .TRACK17_API_KEY
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar TRACK17_API_KEY.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * IMPORTANTE:
     * No eliminamos ni modificamos registros.
     *
     * Incluimos:
     * - entregado = false
     * - entregado = null
     *
     * Esto evita ignorar registros viejos
     * cuyo campo entregado estuviera vacío.
     */
    const {
      data: envios,
      error,
    } =
      await supabase
        .from("envios")
        .select(
          "id, guia, paqueteria, entregado"
        )
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
        enviado_a_17track: [],
        respuesta: null,
        mensaje:
          "No hay envíos pendientes para registrar.",
      });
    }

    /*
     * Convertimos cada fila en una o varias guías.
     *
     * Ejemplo:
     * "123, 456"
     *
     * ahora genera:
     * 123
     * 456
     *
     * y NO "123456".
     */
    const guias =
      envios.flatMap(
        (envio: any) => {
          const numeros =
            extraerGuias(
              envio.guia
            );

          const carrier =
            obtenerCarrier(
              envio.paqueteria
            );

          return numeros.map(
            (number) => {
              /*
               * Si conocemos carrier,
               * lo mandamos.
               *
               * Si no, mandamos solo number
               * para permitir autodetección.
               */
              if (carrier) {
                return {
                  number,
                  carrier,
                };
              }

              return {
                number,
              };
            }
          );
        }
      );

    /*
     * Quitar guías duplicadas.
     */
    const mapaGuias =
      new Map<
        string,
        {
          number: string;
          carrier?: number;
        }
      >();

    for (
      const item of guias
    ) {
      if (
        !item.number
      ) {
        continue;
      }

      const clave =
        `${item.number}-${item.carrier || "AUTO"}`;

      if (
        !mapaGuias.has(
          clave
        )
      ) {
        mapaGuias.set(
          clave,
          item
        );
      }
    }

    const guiasUnicas =
      Array.from(
        mapaGuias.values()
      );

    if (
      guiasUnicas.length ===
      0
    ) {
      return NextResponse.json({
        success: true,
        total: 0,
        enviado_a_17track: [],
        respuesta: null,
        mensaje:
          "No hay guías válidas para registrar en 17TRACK.",
      });
    }

    const response =
      await fetch(
        "https://api.17track.net/track/v2/register",
        {
          method: "POST",
          headers: {
            "17token":
              process.env
                .TRACK17_API_KEY,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              guiasUnicas
            ),

          cache:
            "no-store",
        }
      );

    const rawText =
      await response.text();

    let data: any;

    try {
      data =
        JSON.parse(
          rawText
        );
    } catch {
      return NextResponse.json(
        {
          success: false,

          error:
            "17TRACK respondió con un formato inválido.",

          respuesta:
            rawText.slice(
              0,
              500
            ),
        },
        {
          status: 502,
        }
      );
    }

    if (
      !response.ok
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            `17TRACK respondió HTTP ${response.status}.`,

          enviado_a_17track:
            guiasUnicas,

          respuesta:
            data,
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json({
      success: true,

      total:
        guiasUnicas.length,

      enviado_a_17track:
        guiasUnicas,

      respuesta:
        data,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error register-tracking:",
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