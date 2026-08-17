import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se recibió token de inventario.",
        },
        { status: 400 }
      );
    }

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
            "Faltan variables de configuración.",
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
     * 1. Buscar al cliente por su token privado
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
        token_inventario,
        activo
        `
      )
      .eq(
        "token_inventario",
        token
      )
      .eq(
        "activo",
        true
      )
      .maybeSingle();

    if (clienteError) {
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
            "Inventario no encontrado o acceso inactivo.",
        },
        { status: 404 }
      );
    }

    if (!cliente.onedrive_folder_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El cliente todavía no tiene una carpeta de OneDrive vinculada.",
        },
        { status: 400 }
      );
    }

    /*
     * 2. Obtener conexión OneDrive
     */
    const {
      data: conexion,
      error: conexionError,
    } = await supabase
      .from(
        "onedrive_connections"
      )
      .select(
        "id, refresh_token"
      )
      .order(
        "id",
        {
          ascending: false,
        }
      )
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

    if (
      !conexion?.refresh_token
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No existe una conexión activa con OneDrive.",
        },
        { status: 500 }
      );
    }

    /*
     * 3. Renovar access token
     */
    const tokenResponse =
      await fetch(
        "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
        {
          method:
            "POST",

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

    if (
      !tokenResponse.ok
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo renovar el acceso a OneDrive.",
          detalle:
            tokenData?.error_description ||
            tokenData?.error ||
            tokenData,
        },
        { status: 400 }
      );
    }

    const accessToken =
      tokenData?.access_token;

    const newRefreshToken =
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
      newRefreshToken &&
      newRefreshToken !==
        conexion.refresh_token
    ) {
      await supabase
        .from(
          "onedrive_connections"
        )
        .update({
          refresh_token:
            newRefreshToken,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          conexion.id
        );
    }

    /*
     * 4. Leer únicamente la carpeta
     * asociada a este cliente
     */
    const graphUrl =
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
        cliente.onedrive_folder_id
      )}/children?$select=id,name,file,folder,size,lastModifiedDateTime,webUrl,thumbnails&$top=999`;

    const archivosResponse =
      await fetch(
        graphUrl,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache:
            "no-store",
        }
      );

    const archivosData =
      await archivosResponse.json();

    if (
      !archivosResponse.ok
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo leer el inventario del cliente.",
          detalle:
            archivosData,
        },
        { status: 400 }
      );
    }

    const items =
      Array.isArray(
        archivosData?.value
      )
        ? archivosData.value
        : [];

    /*
     * 5. Preparar respuesta segura
     *
     * Por ahora mostramos archivos y carpetas.
     * No entregamos refresh_token ni access_token.
     */
    const inventario =
      items.map(
        (item: any) => ({
          id:
            item.id,

          nombre:
            item.name,

          tipo:
            item.folder
              ? "carpeta"
              : item.file
              ? "archivo"
              : "otro",

          mime_type:
            item.file?.mimeType ||
            null,

          tamaño:
            item.size || 0,

          modificado:
            item.lastModifiedDateTime ||
            null,

          webUrl:
            item.webUrl ||
            null,
        })
      );

    return NextResponse.json({
      success: true,

      cliente: {
        id_cliente:
          cliente.id_cliente,

        nombre:
          cliente.nombre,

        carpeta:
          cliente.carpeta_cliente,
      },

      total:
        inventario.length,

      inventario,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error inventario cliente:",
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