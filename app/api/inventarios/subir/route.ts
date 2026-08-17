import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CrearSesionBody = {
  id_cliente?: number | string;
  nombre_archivo?: string;
  tamaño?: number;
};

function limpiarNombreArchivo(nombre: string) {
  return nombre
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: Request) {
  try {
    /*
     * IMPORTANTE:
     * Esta API NO recibe el archivo completo.
     *
     * Vercel limita el cuerpo de una Function,
     * por eso aquí únicamente creamos una sesión
     * temporal de carga en Microsoft OneDrive.
     *
     * Después, el navegador subirá directamente
     * los bytes del archivo al uploadUrl de Microsoft.
     */

    const body =
      (await request.json()) as CrearSesionBody;

    const idCliente =
      Number(body?.id_cliente);

    const nombreOriginal =
      String(
        body?.nombre_archivo || ""
      ).trim();

    const tamaño =
      Number(body?.tamaño);

    if (
      !Number.isInteger(idCliente) ||
      idCliente <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El id_cliente no es válido.",
        },
        { status: 400 }
      );
    }

    if (!nombreOriginal) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta el nombre del archivo.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(tamaño) ||
      tamaño <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El tamaño del archivo no es válido.",
        },
        { status: 400 }
      );
    }

    const nombreArchivo =
      limpiarNombreArchivo(
        nombreOriginal
      );

    if (!nombreArchivo) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El nombre del archivo no es válido.",
        },
        { status: 400 }
      );
    }

    /*
     * 1. Variables de entorno.
     */
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
            "Faltan variables de configuración de OneDrive o Supabase.",
        },
        { status: 500 }
      );
    }

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

    /*
     * 2. Buscar al cliente activo.
     *
     * Nunca confiamos en un folder_id recibido
     * desde el navegador.
     */
    const {
      data: cliente,
      error: clienteError,
    } = await supabase
      .from("clientes_inventario")
      .select(
        `
        id,
        id_cliente,
        nombre,
        carpeta_cliente,
        onedrive_folder_id,
        activo
        `
      )
      .eq("id_cliente", idCliente)
      .eq("activo", true)
      .maybeSingle();

    if (clienteError) {
      console.error(
        "Error buscando cliente:",
        clienteError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo consultar el cliente.",
          detalle:
            clienteError.message,
        },
        { status: 500 }
      );
    }

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cliente no encontrado o inactivo.",
        },
        { status: 404 }
      );
    }

    const folderId =
      String(
        cliente.onedrive_folder_id ||
          ""
      ).trim();

    if (!folderId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El cliente no tiene una carpeta de OneDrive vinculada.",
        },
        { status: 400 }
      );
    }

    /*
     * 3. Obtener la conexión de OneDrive.
     */
    const {
      data: conexion,
      error: conexionError,
    } = await supabase
      .from("onedrive_connections")
      .select(
        `
        id,
        drive_id,
        refresh_token
        `
      )
      .order("id", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (conexionError) {
      console.error(
        "Error consultando conexión OneDrive:",
        conexionError
      );

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

    if (
      !conexion?.refresh_token
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No existe una conexión activa de OneDrive.",
        },
        { status: 500 }
      );
    }

    /*
     * 4. Renovar access_token.
     *
     * Esta conexión corresponde a una cuenta
     * personal de Microsoft.
     */
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
                conexion.refresh_token,

              scope:
                "openid profile offline_access User.Read Files.ReadWrite",
            }),

          cache:
            "no-store",
        }
      );

    const tokenData =
      await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error(
        "Error renovando token Microsoft:",
        tokenData
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo renovar el acceso a OneDrive.",
          detalle:
            tokenData?.error_description ||
            tokenData?.error ||
            "Error desconocido.",
        },
        { status: 400 }
      );
    }

    const accessToken =
      tokenData?.access_token;

    const nuevoRefreshToken =
      tokenData?.refresh_token;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Microsoft no devolvió access_token.",
        },
        { status: 400 }
      );
    }

    /*
     * Microsoft puede rotar el refresh token.
     */
    if (
      nuevoRefreshToken &&
      nuevoRefreshToken !==
        conexion.refresh_token
    ) {
      const {
        error: updateTokenError,
      } = await supabase
        .from("onedrive_connections")
        .update({
          refresh_token:
            nuevoRefreshToken,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          conexion.id
        );

      if (updateTokenError) {
        console.error(
          "No se pudo guardar refresh_token rotado:",
          updateTokenError
        );
      }
    }

    /*
     * 5. Crear una sesión de carga.
     *
     * Usamos drive_id cuando existe.
     * Si por alguna razón no está guardado,
     * usamos /me/drive.
     */
    const driveId =
      String(
        conexion.drive_id || ""
      ).trim();

    const nombreCodificado =
      encodeURIComponent(
        nombreArchivo
      );

    const folderCodificado =
      encodeURIComponent(
        folderId
      );

    const crearSesionUrl =
      driveId
        ? `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
            driveId
          )}/items/${folderCodificado}:/${nombreCodificado}:/createUploadSession`
        : `https://graph.microsoft.com/v1.0/me/drive/items/${folderCodificado}:/${nombreCodificado}:/createUploadSession`;

    const sessionResponse =
      await fetch(
        crearSesionUrl,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              item: {
                "@microsoft.graph.conflictBehavior":
                  "rename",

                name:
                  nombreArchivo,

                fileSize:
                  tamaño,
              },
            }),

          cache:
            "no-store",
        }
      );

    const sessionData =
      await sessionResponse.json();

    if (
      !sessionResponse.ok
    ) {
      console.error(
        "Error creando upload session:",
        sessionData
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo preparar la subida del archivo en OneDrive.",
          detalle:
            sessionData?.error
              ?.message ||
            sessionData?.error ||
            sessionData,
        },
        { status: 400 }
      );
    }

    const uploadUrl =
      String(
        sessionData?.uploadUrl ||
          ""
      ).trim();

    if (!uploadUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Microsoft no devolvió uploadUrl.",
        },
        { status: 400 }
      );
    }

    /*
     * 6. Respuesta.
     *
     * uploadUrl es temporal y preautorizado.
     * NO devolvemos:
     * - access_token
     * - refresh_token
     * - client_secret
     */
    return NextResponse.json({
      success: true,

      cliente: {
        id_cliente:
          cliente.id_cliente,

        nombre:
          cliente.nombre,
      },

      archivo: {
        nombre:
          nombreArchivo,

        tamaño,
      },

      uploadUrl,

      expirationDateTime:
        sessionData
          ?.expirationDateTime ||
        null,
    });
  } catch (error: unknown) {
    console.error(
      "Error API inventarios/subir:",
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