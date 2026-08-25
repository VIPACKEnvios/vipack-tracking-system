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

async function leerJsonSeguro(
  response: Response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      token,
      itemId,
    } = await context.params;

    if (
      !token ||
      !itemId
    ) {
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
     * 1. Buscar cliente por token.
     */
    const {
      data: cliente,
      error: clienteError,
    } = await supabase
      .from(
        "clientes_inventario"
      )
      .select(
        `
        id,
        id_cliente,
        nombre,
        onedrive_folder_id,
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

    if (
      !cliente.onedrive_folder_id
    ) {
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
     * 2. Obtener conexión OneDrive.
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
            "No existe conexión activa con OneDrive.",
        },
        { status: 500 }
      );
    }

    /*
     * 3. Renovar access_token.
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
      await leerJsonSeguro(
        tokenResponse
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
     * Guardar refresh_token rotado.
     */
    if (
      newRefreshToken &&
      newRefreshToken !==
        conexion.refresh_token
    ) {
      const {
        error: updateTokenError,
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

      if (updateTokenError) {
        console.error(
          "No se pudo guardar refresh_token rotado:",
          updateTokenError
        );
      }
    }

    /*
     * 4. Validar que itemId pertenezca
     * realmente a la carpeta del cliente.
     *
     * También obtenemos mimeType para
     * distinguir videos de imágenes.
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
      await leerJsonSeguro(
        childrenResponse
      );

    if (
      !childrenResponse.ok
    ) {
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
          item?.id ===
            itemId &&
          Boolean(
            item?.file
          )
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

    const mimeType =
      String(
        archivo?.file?.mimeType ||
          ""
      ).toLowerCase();

    const esVideo =
      mimeType.startsWith(
        "video/"
      );

    /*
     * 5A. VIDEOS
     *
     * Para videos NO usamos thumbnail.
     *
     * Tampoco descargamos el video completo
     * a Vercel porque puede pesar cientos
     * de MB.
     *
     * Pedimos /content a Microsoft Graph
     * con redirect:"manual". Graph devuelve
     * una URL temporal preautorizada.
     *
     * Redirigimos el navegador directamente
     * a esa URL para que el <video> pueda:
     *
     * - reproducir;
     * - pausar;
     * - adelantar;
     * - retroceder;
     * - usar byte ranges;
     * - abrir pantalla completa.
     */
    if (esVideo) {
      const contentUrl =
        `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
          itemId
        )}/content`;

      const contentResponse =
        await fetch(
          contentUrl,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },

            redirect:
              "manual",

            cache:
              "no-store",
          }
        );

      if (
        contentResponse.status >=
          300 &&
        contentResponse.status <
          400
      ) {
        const location =
          contentResponse.headers.get(
            "location"
          );

        if (!location) {
          return NextResponse.json(
            {
              success: false,
              error:
                "OneDrive no devolvió la URL temporal del video.",
            },
            { status: 502 }
          );
        }

        return NextResponse.redirect(
          location,
          {
            status: 302,

            headers: {
              "Cache-Control":
                "private, no-store, max-age=0",
            },
          }
        );
      }

      /*
       * Respaldo por si Microsoft
       * devuelve contenido directamente.
       */
      if (
        contentResponse.ok &&
        contentResponse.body
      ) {
        const headers =
          new Headers();

        headers.set(
          "Content-Type",
          contentResponse.headers.get(
            "content-type"
          ) ||
            mimeType ||
            "video/mp4"
        );

        const contentLength =
          contentResponse.headers.get(
            "content-length"
          );

        if (contentLength) {
          headers.set(
            "Content-Length",
            contentLength
          );
        }

        const acceptRanges =
          contentResponse.headers.get(
            "accept-ranges"
          );

        if (acceptRanges) {
          headers.set(
            "Accept-Ranges",
            acceptRanges
          );
        }

        headers.set(
          "Cache-Control",
          "private, no-store, max-age=0"
        );

        headers.set(
          "Content-Disposition",
          `inline; filename*=UTF-8''${encodeURIComponent(
            archivo.name
          )}`
        );

        return new Response(
          contentResponse.body,
          {
            status:
              contentResponse.status,
            headers,
          }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo obtener el video desde OneDrive.",
        },
        {
          status:
            contentResponse.status >=
              400 &&
            contentResponse.status <
              600
              ? contentResponse.status
              : 502,
        }
      );
    }

    /*
     * 5B. IMÁGENES
     *
     * Conservamos exactamente el comportamiento
     * que ya tenías para HEIC y otras fotos:
     * primero intentamos thumbnail generado
     * por OneDrive.
     */
    const thumbnailUrl =
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
        itemId
      )}/thumbnails/0/large/content`;

    const thumbnailResponse =
      await fetch(
        thumbnailUrl,
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

    /*
     * Si Microsoft sí generó thumbnail,
     * lo usamos.
     */
    if (
      thumbnailResponse.ok
    ) {
      const thumbnailBuffer =
        await thumbnailResponse.arrayBuffer();

      const thumbnailContentType =
        thumbnailResponse.headers.get(
          "content-type"
        ) ||
        "image/jpeg";

      return new NextResponse(
        thumbnailBuffer,
        {
          status: 200,

          headers: {
            "Content-Type":
              thumbnailContentType,

            "Content-Length":
              String(
                thumbnailBuffer.byteLength
              ),

            "Cache-Control":
              "private, max-age=300",

            "Content-Disposition":
              `inline; filename*=UTF-8''${encodeURIComponent(
                `${archivo.name}.preview`
              )}`,
          },
        }
      );
    }

    /*
     * 6. Respaldo para imágenes/documentos:
     * si Microsoft no tiene thumbnail,
     * devolvemos el archivo original.
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

    if (
      !contentResponse.ok
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo obtener la vista previa ni el archivo original de OneDrive.",
        },
        { status: 400 }
      );
    }

    const originalBuffer =
      await contentResponse.arrayBuffer();

    const originalContentType =
      contentResponse.headers.get(
        "content-type"
      ) ||
      archivo?.file?.mimeType ||
      "application/octet-stream";

    return new NextResponse(
      originalBuffer,
      {
        status: 200,

        headers: {
          "Content-Type":
            originalContentType,

          "Content-Length":
            String(
              originalBuffer.byteLength
            ),

          "Cache-Control":
            "private, max-age=300",

          "Content-Disposition":
            `inline; filename*=UTF-8''${encodeURIComponent(
              archivo.name
            )}`,
        },
      }
    );
  } catch (
    error: unknown
  ) {
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