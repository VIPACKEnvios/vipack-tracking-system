import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const clientId = process.env.ONEDRIVE_CLIENT_ID;
    const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;

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
     * 2. Usar refresh_token para obtener
     * un access_token nuevo
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
     * Si devuelve uno nuevo, lo guardamos.
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
     * 3. Leer las carpetas/archivos
     * de la raíz de OneDrive
     */
    const foldersResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me/drive/root/children?$select=id,name,folder,file,webUrl,parentReference",
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const foldersData =
      await foldersResponse.json();

    if (!foldersResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudieron leer los archivos de OneDrive.",
          detalle:
            foldersData,
        },
        { status: 400 }
      );
    }

    const items =
      Array.isArray(
        foldersData?.value
      )
        ? foldersData.value
        : [];

    /*
     * 4. Separar solamente carpetas
     */
    const carpetas = items
      .filter(
        (item: any) =>
          Boolean(item?.folder)
      )
      .map((item: any) => ({
        id:
          item.id,
        nombre:
          item.name,
        webUrl:
          item.webUrl || null,
      }));

    return NextResponse.json({
      success: true,
      total:
        carpetas.length,
      carpetas,
    });
  } catch (error: unknown) {
    console.error(
      "Error leyendo carpetas OneDrive:",
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