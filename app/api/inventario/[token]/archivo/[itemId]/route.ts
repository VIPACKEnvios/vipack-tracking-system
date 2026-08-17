import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    token: string;
    itemId: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { token, itemId } = await context.params;

    if (!token || !itemId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta token de inventario o ID de archivo.",
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
     * 1. Buscar cliente por token
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
        onedrive_folder_id,
        activo
        `
      )
      .eq("token_inventario", token)
      .eq("activo", true)
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
            "El cliente no tiene carpeta de OneDrive vinculada.",
        },
        { status: 400 }
      );
    }

    /*
     * 2. Obtener conexión de OneDrive
     */
    const {
      data: conexion,
      error: conexionError,
    } = await supabase
      .from("onedrive_connections")
      .select(
        "id, refresh_token"
      )
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
            "No existe conexión activa con OneDrive.",
        },
        { status: 500 }
      );
    }

    /*
     * 3. Renovar access_token
     */
    const tokenResponse = await fetch(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body: new URLSearchParams({
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

        cache: "no-store",
      }
    );

    const tokenData =
      await tokenResponse.json();

    if (!tokenResponse.ok) {
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
     * Guardar refresh_token nuevo si Microsoft
     * lo rotó.
     */
    if (
      newRefreshToken &&
      newRefreshToken !==
        conexion.refresh_token
    ) {
      await supabase
        .from("onedrive_connections")
        .update({
          refresh_token:
            newRefreshToken,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", conexion.id);
    }

    /*
     * 4. Validar que el archivo realmente
     * pertenece a la carpeta del cliente.
     *
     * Leemos los hijos de SU carpeta y
     * buscamos exclusivamente itemId.
     */
    const childrenUrl =
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
        cliente.onedrive_folder_id
      )}/children?$select=id,name,file,folder,size`;

    const childrenResponse =
      await fetch(
        childrenUrl,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache:
            "no-store",
        }
      );

    const childrenData =
      await childrenResponse.json();

    if (!childrenResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo validar la carpeta del cliente.",
          detalle:
            childrenData,
        },
        { status: 400 }
      );
    }

    const items =
      Array.isArray(
        childrenData?.value
      )
        ? childrenData.value
        : [];

    const archivo =
      items.find(
        (item: any) =>
          item?.id === itemId &&
          Boolean(item?.file)
      );

    if (!archivo) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El archivo solicitado no pertenece al inventario de este cliente.",
        },
        { status: 404 }
      );
    }

    /*
     * 5. Descargar contenido real desde Graph.
     *
     * /content puede devolver redirección hacia
     * una URL temporal de descarga.
     */
    const contentUrl =
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
        itemId
      )}/content`;

    const contentResponse =
      await fetch(
        contentUrl,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          redirect:
            "follow",

          cache:
            "no-store",
        }
      );

    if (!contentResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo obtener el archivo de OneDrive.",
        },
        { status: 400 }
      );
    }

    const contentType =
      contentResponse.headers.get(
        "content-type"
      ) ||
      archivo?.file?.mimeType ||
      "application/octet-stream";

    const buffer =
      await contentResponse.arrayBuffer();

    /*
     * 6. Entregar archivo al navegador.
     *
     * No revelamos access_token,
     * refresh_token ni URL privada de Microsoft.
     */
    return new NextResponse(buffer, {
      status: 200,

      headers: {
        "Content-Type":
          contentType,

        "Content-Length":
          String(
            buffer.byteLength
          ),

        "Cache-Control":
          "private, max-age=300",

        "Content-Disposition":
          `inline; filename*=UTF-8''${encodeURIComponent(
            archivo.name
          )}`,
      },
    });
  } catch (error: unknown) {
    console.error(
      "Error archivo inventario:",
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