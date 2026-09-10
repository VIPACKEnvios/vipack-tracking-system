import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_EXCEL =
  "Envios/control_recolecciones_bodega.xlsx";

const HOJA_CLIENTES =
  "Clientes";

/* =========================================================
   LIMPIAR TEXTO
========================================================= */

function limpiarTexto(valor: unknown) {
  return String(valor ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   NORMALIZAR TELÉFONO DE WHATSAPP

   Acepta:
   9611978818
   529611978818
   5219611978818
   5.219611978818E+12
   números guardados directamente por Excel

   Resultado esperado:
   5219611978818
========================================================= */

function convertirTelefono(
  valor: unknown
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "";
  }

  let texto = "";

  /*
   * Si SheetJS recupera el valor
   * directamente como número.
   */
  if (
    typeof valor === "number" &&
    Number.isFinite(valor)
  ) {
    texto =
      Math.trunc(valor).toString();
  } else {
    texto =
      limpiarTexto(valor);

    /*
     * Si por algún motivo sigue llegando
     * como notación científica.
     *
     * Ejemplo:
     * 5.219611978818E+12
     */
    if (
      /^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(
        texto
      )
    ) {
      const numero =
        Number(texto);

      if (
        Number.isFinite(numero)
      ) {
        texto =
          Math.trunc(
            numero
          ).toString();
      }
    }
  }

  let telefono =
    texto.replace(
      /\D/g,
      ""
    );

  if (!telefono) {
    return "";
  }

  /*
   * 10 dígitos mexicanos:
   * 9611978818
   *
   * ↓
   *
   * 5219611978818
   */
  if (
    telefono.length === 10
  ) {
    return `521${telefono}`;
  }

  /*
   * 52 + 10 dígitos:
   * 529611978818
   *
   * ↓
   *
   * 5219611978818
   */
  if (
    telefono.length === 12 &&
    telefono.startsWith("52")
  ) {
    return `521${telefono.slice(
      2
    )}`;
  }

  /*
   * Ya está correcto:
   * 521 + 10 dígitos.
   */
  if (
    telefono.length === 13 &&
    telefono.startsWith("521")
  ) {
    return telefono;
  }

  /*
   * Si es un teléfono antiguo,
   * extranjero o irregular,
   * no lo desaparecemos.
   */
  return telefono;
}

/* =========================================================
   LEER JSON DE FORMA SEGURA
========================================================= */

async function leerJsonSeguro(
  response: Response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/* =========================================================
   RENOVAR TOKEN DE ONEDRIVE
========================================================= */

async function renovarTokenOneDrive(
  clientId: string,
  clientSecret: string,
  refreshToken: string
) {
  const response =
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

  const data =
    await leerJsonSeguro(
      response
    );

  return {
    response,
    data,
  };
}

/* =========================================================
   GET /api/clientes
========================================================= */

export async function GET() {
  try {
    /* =====================================================
       1. VARIABLES DE ENTORNO
    ===================================================== */

    const clientId =
      process.env
        .ONEDRIVE_CLIENT_ID;

    const clientSecret =
      process.env
        .ONEDRIVE_CLIENT_SECRET;

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY;

    if (
      !clientId ||
      !clientSecret ||
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Faltan variables de configuración de OneDrive o Supabase.",
        },
        {
          status:
            500,

          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    /* =====================================================
       2. CREAR CLIENTE SUPABASE
    ===================================================== */

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken:
              false,

            persistSession:
              false,
          },
        }
      );

    /* =====================================================
       3. OBTENER CONEXIÓN ONEDRIVE
    ===================================================== */

    const {
      data:
        conexion,

      error:
        conexionError,
    } =
      await supabase
        .from(
          "onedrive_connections"
        )
        .select(
          "id, refresh_token"
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
      conexionError
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "No se pudo consultar la conexión de OneDrive.",

          detalle:
            conexionError.message,
        },
        {
          status:
            500,
        }
      );
    }

    if (
      !conexion
        ?.refresh_token
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "No existe una conexión activa de OneDrive.",
        },
        {
          status:
            400,
        }
      );
    }

    /* =====================================================
       4. RENOVAR TOKEN ONEDRIVE
    ===================================================== */

    const token =
      await renovarTokenOneDrive(
        clientId,
        clientSecret,
        conexion.refresh_token
      );

    if (
      !token.response.ok ||
      !token.data
        ?.access_token
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            token.data
              ?.error_description ||
            token.data
              ?.error ||
            "No se pudo renovar el acceso a OneDrive.",
        },
        {
          status:
            401,
        }
      );
    }

    const accessToken =
      String(
        token.data
          .access_token
      );

    /* =====================================================
       5. GUARDAR REFRESH TOKEN NUEVO SI MICROSOFT LO ROTÓ
    ===================================================== */

    const nuevoRefreshToken =
      String(
        token.data
          ?.refresh_token ||
          ""
      ).trim();

    if (
      nuevoRefreshToken &&
      nuevoRefreshToken !==
        conexion.refresh_token
    ) {
      const {
        error:
          actualizarTokenError,
      } =
        await supabase
          .from(
            "onedrive_connections"
          )
          .update({
            refresh_token:
              nuevoRefreshToken,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            conexion.id
          );

      if (
        actualizarTokenError
      ) {
        console.error(
          "No se pudo guardar el refresh token renovado:",
          actualizarTokenError
        );
      }
    }

    /* =====================================================
       6. DESCARGAR EXCEL
    ===================================================== */

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
        await excelResponse
          .text()
          .catch(
            () => ""
          );

      return NextResponse.json(
        {
          success:
            false,

          error:
            `No se pudo descargar ${RUTA_EXCEL} desde OneDrive.`,

          detalle:
            detalle ||
            `HTTP ${excelResponse.status}`,
        },
        {
          status:
            500,
        }
      );
    }

    /* =====================================================
       7. LEER ARCHIVO XLSX
    ===================================================== */

    const arrayBuffer =
      await excelResponse
        .arrayBuffer();

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
        HOJA_CLIENTES
      ];

    if (!hoja) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            `El archivo ${RUTA_EXCEL} no contiene la hoja "${HOJA_CLIENTES}".`,

          hojas:
            workbook.SheetNames,
        },
        {
          status:
            500,
        }
      );
    }

    /* =====================================================
       8. CONVERTIR EXCEL A JSON

       IMPORTANTE:
       raw: true

       Esto hace que SheetJS use el valor REAL de la
       celda, no el texto visual mostrado por Excel.

       Ejemplo:

       Excel puede mostrar:
       5.21961E+12

       Pero internamente puede contener:
       5219611978818
    ===================================================== */

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
              null,

            raw:
              true,
          }
        );

    /* =====================================================
       9. CREAR MAPA DE CLIENTES
    ===================================================== */

    const mapa =
      new Map<
        string,
        {
          id_cliente:
            string;

          nombre:
            string;

          telefono:
            string;

          carpeta_cliente:
            string;
        }
      >();

    /* =====================================================
       10. RECORRER FILAS
    ===================================================== */

    for (
      const fila of filas
    ) {
      const nombre =
        limpiarTexto(
          fila[
            "Nombre"
          ] ??
            fila[
              "Cliente"
            ]
        );

      /*
       * Para aparecer en clientes
       * solamente exigimos nombre.
       */
      if (!nombre) {
        continue;
      }

      const idCliente =
        limpiarTexto(
          fila[
            "ID Cliente"
          ]
        );

      /*
       * IMPORTANTE:
       *
       * El teléfono puede venir:
       *
       * como number:
       * 5219611978818
       *
       * como string:
       * "5219611978818"
       *
       * o como notación científica.
       */
      const telefono =
        convertirTelefono(
          fila[
            "TelefonoWhatsApp"
          ] ??
            fila[
              "Telefono"
            ] ??
            fila[
              "Teléfono"
            ]
        );

      const carpeta =
        limpiarTexto(
          fila[
            "CarpetaCliente"
          ]
        );

      /*
       * Usamos ID como llave
       * cuando existe.
       *
       * Si no existe,
       * usamos el nombre normalizado.
       */
      const llave =
        idCliente
          ? `id:${idCliente}`
          : `nombre:${nombre
              .normalize(
                "NFD"
              )
              .replace(
                /[\u0300-\u036f]/g,
                ""
              )
              .toLocaleLowerCase(
                "es"
              )}`;

      mapa.set(
        llave,
        {
          id_cliente:
            idCliente,

          nombre,

          telefono,

          carpeta_cliente:
            carpeta,
        }
      );
    }

    /* =====================================================
       11. ORDENAR CLIENTES ALFABÉTICAMENTE
    ===================================================== */

    const clientes =
      Array.from(
        mapa.values()
      ).sort(
        (
          a,
          b
        ) =>
          a.nombre
            .localeCompare(
              b.nombre,
              "es",
              {
                sensitivity:
                  "base",
              }
            )
      );

    /* =====================================================
       12. RESPUESTA
    ===================================================== */

    return NextResponse.json(
      {
        success:
          true,

        total:
          clientes.length,

        archivo:
          RUTA_EXCEL,

        hoja:
          HOJA_CLIENTES,

        clientes,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (
    error: unknown
  ) {
    console.error(
      "Error API /api/clientes:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido.",
      },
      {
        status:
          500,
      }
    );
  }
}