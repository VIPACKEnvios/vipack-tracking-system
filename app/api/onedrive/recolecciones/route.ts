import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
     * 1. Obtener la conexión guardada
     */
    const {
      data: conexion,
      error: connectionError,
    } = await supabase
      .from("onedrive_connections")
      .select(
        "id, drive_id, refresh_token"
      )
      .order("id", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (connectionError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo consultar la conexión de OneDrive.",
          detalle:
            connectionError.message,
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

    /*
     * 2. Renovar access_token
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
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
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
     * Microsoft puede rotar el refresh_token.
     * Si entrega uno nuevo, lo guardamos.
     */
    if (
      newRefreshToken &&
      newRefreshToken !==
        conexion.refresh_token
    ) {
      const {
        error: refreshUpdateError,
      } = await supabase
        .from("onedrive_connections")
        .update({
          refresh_token:
            newRefreshToken,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", conexion.id);

      if (refreshUpdateError) {
        console.error(
          "No se pudo actualizar refresh_token:",
          refreshUpdateError
        );
      }
    }

    /*
     * 3. Abrir:
     *
     * OneDrive
     *   └── Envios
     *       └── Recoleccion por cliente
     */
    const ruta =
      "Envios/Recoleccion por cliente";

    const graphUrl =
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
        ruta
      )}:/children?$select=id,name,folder,file,webUrl,size,lastModifiedDateTime,parentReference&$top=999`;

    const response = await fetch(
      graphUrl,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo abrir la carpeta Recoleccion por cliente.",
          detalle:
            data,
        },
        { status: 400 }
      );
    }

    const items =
      Array.isArray(
        data?.value
      )
        ? data.value
        : [];

    /*
     * 4. Queremos principalmente
     * las carpetas de clientes.
     */
    const clientes =
      items
        .filter(
          (item: any) =>
            Boolean(item?.folder)
        )
        .map((item: any) => ({
          onedrive_folder_id:
            item.id,

          carpeta_cliente:
            item.name,

          webUrl:
            item.webUrl || null,

          archivos:
            item.folder?.childCount ??
            null,

          modificado:
            item.lastModifiedDateTime ||
            null,
        }))
        .sort(
          (
            a: any,
            b: any
          ) =>
            String(
              a.carpeta_cliente
            ).localeCompare(
              String(
                b.carpeta_cliente
              ),
              "es",
              {
                numeric: true,
              }
            )
        );

    return NextResponse.json({
      success: true,

      carpeta:
        "Envios/Recoleccion por cliente",

      total_clientes:
        clientes.length,

      clientes,
    });
  } catch (error: unknown) {
    console.error(
      "Error leyendo recolecciones OneDrive:",
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