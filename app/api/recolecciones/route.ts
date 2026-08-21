import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_EXCEL =
  "Envios/control_recolecciones_bodega.xlsx";

const HOJA_SOLICITUDES =
  "Solicitudes";

async function leerJsonSeguro(
  response: Response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function renovarTokenOneDrive(
  clientId: string,
  clientSecret: string,
  refreshToken: string
) {
  const tokenResponse =
    await fetch(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            client_id:
              clientId,

            client_secret:
              clientSecret,

            grant_type:
              "refresh_token",

            refresh_token:
              refreshToken,

            scope:
              "openid profile offline_access User.Read Files.ReadWrite",
          }),

        cache:
          "no-store",
      }
    );

  const tokenData =
    await leerJsonSeguro(
      tokenResponse
    );

  return {
    response:
      tokenResponse,

    data:
      tokenData,
  };
}

export async function GET() {
  try {
    const clientId =
      process.env.ONEDRIVE_CLIENT_ID;

    const clientSecret =
      process.env.ONEDRIVE_CLIENT_SECRET;

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !clientId ||
      !clientSecret ||
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Faltan variables de configuración de OneDrive.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Supabase solamente se usa aquí
     * para recuperar el refresh_token
     * de la conexión existente.
     *
     * Las recolecciones NO se guardan
     * en Supabase.
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

    /*
     * 1. Obtener conexión actual
     * de OneDrive.
     */
    const {
      data:
        conexion,

      error:
        connectionError,
    } = await supabase
      .from(
        "onedrive_connections"
      )
      .select(
        "id, drive_id, refresh_token"
      )
      .order(
        "id",
        {
          ascending:
            false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (
      connectionError
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No se pudo consultar la conexión de OneDrive.",

          detalle:
            connectionError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !conexion
        ?.refresh_token
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No existe una conexión activa de OneDrive.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 2. Renovar token de Microsoft.
     */
    const {
      response:
        tokenResponse,

      data:
        tokenData,
    } =
      await renovarTokenOneDrive(
        clientId,
        clientSecret,
        conexion.refresh_token
      );

    if (
      !tokenResponse.ok
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No se pudo renovar el acceso a OneDrive.",

          detalle:
            tokenData
              ?.error_description ||
            tokenData?.error ||
            tokenData,
        },
        {
          status: 400,
        }
      );
    }

    const accessToken =
      tokenData
        ?.access_token;

    const newRefreshToken =
      tokenData
        ?.refresh_token;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Microsoft no devolvió access_token.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Microsoft puede cambiar
     * el refresh_token.
     */
    if (
      newRefreshToken &&
      newRefreshToken !==
        conexion.refresh_token
    ) {
      const {
        error:
          updateTokenError,
      } = await supabase
        .from(
          "onedrive_connections"
        )
        .update({
          refresh_token:
            newRefreshToken,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          conexion.id
        );

      if (
        updateTokenError
      ) {
        console.error(
          "No se pudo actualizar refresh_token:",
          updateTokenError
        );
      }
    }

    /*
     * 3. Descargar el Excel
     * directamente desde OneDrive.
     */
    const excelUrl =
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
        RUTA_EXCEL
      )}:/content`;

    const excelResponse =
      await fetch(
        excelUrl,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache:
            "no-store",
        }
      );

    if (
      !excelResponse.ok
    ) {
      const detalle =
        await excelResponse.text();

      return NextResponse.json(
        {
          success: false,

          error:
            "No se pudo descargar el Excel de recolecciones.",

          detalle,

          archivo:
            RUTA_EXCEL,
        },
        {
          status: 400,
        }
      );
    }

    const arrayBuffer =
      await excelResponse
        .arrayBuffer();

    /*
     * 4. Abrir el Excel.
     */
    const workbook =
      XLSX.read(
        Buffer.from(
          arrayBuffer
        ),
        {
          type:
            "buffer",
        }
      );

    const hoja =
      workbook.Sheets[
        HOJA_SOLICITUDES
      ];

    if (!hoja) {
      return NextResponse.json(
        {
          success: false,

          error:
            `El Excel no contiene la hoja "${HOJA_SOLICITUDES}".`,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 5. Convertir filas
     * de Solicitudes a JSON.
     */
    const filas =
      XLSX.utils
        .sheet_to_json<
          Record<
            string,
            unknown
          >
        >(
          hoja,
          {
            defval:
              "",

            raw:
              false,
          }
        );

    /*
     * 6. Limpiar filas vacías.
     */
    const registros =
      filas.filter(
        (fila) => {
          return Object
            .values(
              fila
            )
            .some(
              (valor) =>
                String(
                  valor ?? ""
                )
                  .trim() !==
                ""
            );
        }
      );

    /*
     * 7. Resumen por estado.
     */
    const contarEstado =
      (
        estado:
          string
      ) =>
        registros.filter(
          (fila) =>
            String(
              fila[
                "Estatus"
              ] || ""
            )
              .trim()
              .toLowerCase() ===
            estado
              .trim()
              .toLowerCase()
        ).length;

    const resumen = {
      total:
        registros.length,

      pendientes:
        contarEstado(
          "Pendiente"
        ),

      en_ruta:
        contarEstado(
          "En ruta"
        ),

      recolectadas:
        contarEstado(
          "Recolectada"
        ),

      no_lista:
        contarEstado(
          "No lista"
        ),

      reprogramadas:
        contarEstado(
          "Reprogramada"
        ),

      canceladas:
        contarEstado(
          "Cancelada"
        ),
    };

    return NextResponse.json({
      success: true,

      archivo:
        RUTA_EXCEL,

      hoja:
        HOJA_SOLICITUDES,

      resumen,

      registros,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error leyendo Excel de recolecciones:",
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