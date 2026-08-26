import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_EXCEL = "Envios/control_recolecciones_bodega.xlsx";
const HOJA_CLIENTES = "Clientes";

function limpiarTexto(valor: unknown) {
  return String(valor ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function convertirTelefono(valor: unknown) {
  const texto = limpiarTexto(valor);
  if (!texto) return "";

  // Evita notación científica o decimales accidentales.
  const soloDigitos = texto.replace(/\D/g, "");
  return soloDigitos || texto;
}

async function leerJsonSeguro(response: Response) {
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
  const response = await fetch(
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope:
          "openid profile offline_access User.Read Files.ReadWrite",
      }),
      cache: "no-store",
    }
  );

  const data = await leerJsonSeguro(response);

  return {
    response,
    data,
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

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !clientId ||
      !clientSecret ||
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faltan variables de configuración de OneDrive o Supabase.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
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
     * La web NO puede leer directamente:
     * C:\\Users\\USER\\OneDrive\\Envios\\...
     *
     * Esa es una ruta local de Windows.
     * En Vercel debemos leer el mismo archivo desde
     * OneDrive en la nube mediante Microsoft Graph.
     */
    const {
      data: conexion,
      error: conexionError,
    } = await supabase
      .from("onedrive_connections")
      .select("id, refresh_token")
      .order("id", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (conexionError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo consultar la conexión de OneDrive.",
          detalle:
            conexionError.message,
        },
        { status: 500 }
      );
    }

    if (!conexion?.refresh_token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No existe una conexión activa de OneDrive.",
        },
        { status: 400 }
      );
    }

    const token = await renovarTokenOneDrive(
      clientId,
      clientSecret,
      conexion.refresh_token
    );

    if (
      !token.response.ok ||
      !token.data?.access_token
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            token.data?.error_description ||
            token.data?.error ||
            "No se pudo renovar el acceso a OneDrive.",
        },
        { status: 401 }
      );
    }

    const accessToken = String(
      token.data.access_token
    );

    /*
     * Microsoft puede rotar el refresh token.
     * Guardamos el nuevo para evitar que la conexión
     * se pierda en futuras lecturas.
     */
    const nuevoRefreshToken =
      String(
        token.data?.refresh_token || ""
      ).trim();

    if (
      nuevoRefreshToken &&
      nuevoRefreshToken !==
        conexion.refresh_token
    ) {
      await supabase
        .from("onedrive_connections")
        .update({
          refresh_token:
            nuevoRefreshToken,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", conexion.id);
    }

    const excelUrl =
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
        RUTA_EXCEL
      )}:/content`;

    const excelResponse = await fetch(
      excelUrl,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!excelResponse.ok) {
      const detalle =
        await excelResponse
          .text()
          .catch(() => "");

      return NextResponse.json(
        {
          success: false,
          error:
            `No se pudo descargar ${RUTA_EXCEL} desde OneDrive.`,
          detalle:
            detalle ||
            `HTTP ${excelResponse.status}`,
        },
        { status: 500 }
      );
    }

    const arrayBuffer =
      await excelResponse.arrayBuffer();

    const workbook =
      XLSX.read(
        Buffer.from(arrayBuffer),
        {
          type: "buffer",
        }
      );

    const hoja =
      workbook.Sheets[
        HOJA_CLIENTES
      ];

    if (!hoja) {
      return NextResponse.json(
        {
          success: false,
          error:
            `El archivo ${RUTA_EXCEL} no contiene la hoja "${HOJA_CLIENTES}".`,
          hojas:
            workbook.SheetNames,
        },
        { status: 500 }
      );
    }

    const filas =
      XLSX.utils.sheet_to_json<
        Record<string, unknown>
      >(hoja, {
        defval: null,
        raw: false,
      });

    /*
     * IMPORTANTE:
     * No exigimos que el cliente tenga teléfono,
     * carpeta o dirección para aparecer.
     * Con que tenga Nombre, se muestra.
     *
     * Esto evita omitir clientes antiguos del Excel.
     */
    const mapa =
      new Map<
        string,
        {
          id_cliente: string;
          nombre: string;
          telefono: string;
          carpeta_cliente: string;
        }
      >();

    for (const fila of filas) {
      const nombre =
        limpiarTexto(
          fila["Nombre"] ??
            fila["Cliente"]
        );

      if (!nombre) {
        continue;
      }

      const idCliente =
        limpiarTexto(
          fila["ID Cliente"]
        );

      const telefono =
        convertirTelefono(
          fila["TelefonoWhatsApp"] ??
            fila["Telefono"] ??
            fila["Teléfono"]
        );

      const carpeta =
        limpiarTexto(
          fila["CarpetaCliente"]
        );

      /*
       * Usamos ID como llave cuando existe.
       * Si no existe, usamos nombre normalizado.
       * Así no eliminamos accidentalmente dos clientes
       * distintos que pudieran tener nombres similares.
       */
      const llave =
        idCliente
          ? `id:${idCliente}`
          : `nombre:${nombre
              .normalize("NFD")
              .replace(
                /[\u0300-\u036f]/g,
                ""
              )
              .toLocaleLowerCase("es")}`;

      mapa.set(llave, {
        id_cliente:
          idCliente,
        nombre,
        telefono,
        carpeta_cliente:
          carpeta,
      });
    }

    const clientes =
      Array.from(
        mapa.values()
      ).sort((a, b) =>
        a.nombre.localeCompare(
          b.nombre,
          "es",
          {
            sensitivity: "base",
          }
        )
      );

    return NextResponse.json(
      {
        success: true,
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
  } catch (error: unknown) {
    console.error(
      "Error API /api/clientes:",
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
      { status: 500 }
    );
  }
}
