import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const code = url.searchParams.get("code");
    const microsoftError = url.searchParams.get("error");
    const errorDescription =
      url.searchParams.get("error_description");

    /*
     * 1. Revisar si Microsoft devolvió un error
     */
    if (microsoftError) {
      return NextResponse.json(
        {
          success: false,
          error: microsoftError,
          detalle: errorDescription,
        },
        { status: 400 }
      );
    }

    /*
     * 2. Debemos recibir un código de autorización
     */
    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Microsoft no devolvió código de autorización.",
        },
        { status: 400 }
      );
    }

    /*
     * 3. Variables de Microsoft
     */
    const clientId =
      process.env.ONEDRIVE_CLIENT_ID;

    const clientSecret =
      process.env.ONEDRIVE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faltan ONEDRIVE_CLIENT_ID u ONEDRIVE_CLIENT_SECRET.",
        },
        { status: 500 }
      );
    }

    /*
     * 4. Variables de Supabase
     */
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faltan las variables de conexión de Supabase.",
        },
        { status: 500 }
      );
    }

    /*
     * Esta conexión usa SERVICE ROLE.
     * Solamente existe en el servidor.
     */
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

    const redirectUri =
      "https://vipack-envios.com/api/onedrive/callback";

    /*
     * 5. Cambiar el código recibido por tokens.
     *
     * Como estamos conectando un OneDrive
     * PERSONAL de Microsoft, usamos consumers.
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
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          scope:
            "openid profile offline_access User.Read Files.ReadWrite",
        }),

        cache: "no-store",
      }
    );

    const tokenData =
      await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error(
        "Error Microsoft token:",
        tokenData
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Microsoft no pudo intercambiar el código por tokens.",

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

    const refreshToken =
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
     * 6. Probar el token contra OneDrive
     */
    const driveResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me/drive",
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache: "no-store",
      }
    );

    const driveData =
      await driveResponse.json();

    if (!driveResponse.ok) {
      console.error(
        "Error Graph /me/drive:",
        driveData
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "El token se obtuvo, pero no se pudo abrir OneDrive.",
          detalle: driveData,
        },
        { status: 400 }
      );
    }

    const driveId =
      String(
        driveData?.id || ""
      ).trim();

    const driveType =
      String(
        driveData?.driveType || ""
      ).trim();

    const ownerName =
      String(
        driveData?.owner?.user
          ?.displayName || ""
      ).trim();

    if (!driveId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Microsoft Graph no devolvió el ID de OneDrive.",
        },
        { status: 400 }
      );
    }

    /*
     * 7. Ver si esta cuenta ya estaba conectada
     */
    const {
      data: conexiones,
      error: searchError,
    } = await supabase
      .from("onedrive_connections")
      .select(
        "id, drive_id, refresh_token"
      )
      .eq("drive_id", driveId)
      .order("id", {
        ascending: false,
      })
      .limit(1);

    if (searchError) {
      console.error(
        "Error buscando conexión:",
        searchError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo consultar la conexión de OneDrive en Supabase.",
          detalle:
            searchError.message,
        },
        { status: 500 }
      );
    }

    const conexionExistente =
      conexiones &&
      conexiones.length > 0
        ? conexiones[0]
        : null;

    /*
     * 8. Actualizar conexión existente
     */
    if (conexionExistente) {
      const tokenAGuardar =
        refreshToken ||
        conexionExistente.refresh_token;

      if (!tokenAGuardar) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No existe refresh_token para mantener la conexión.",
          },
          { status: 400 }
        );
      }

      const {
        error: updateError,
      } = await supabase
        .from("onedrive_connections")
        .update({
          provider:
            "microsoft",

          drive_type:
            driveType || null,

          owner_name:
            ownerName || null,

          refresh_token:
            tokenAGuardar,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          conexionExistente.id
        );

      if (updateError) {
        console.error(
          "Error actualizando conexión:",
          updateError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "OneDrive se conectó, pero no se pudo actualizar la conexión en Supabase.",
            detalle:
              updateError.message,
          },
          { status: 500 }
        );
      }
    } else {
      /*
       * Primera conexión:
       * necesitamos refresh_token.
       */
      if (!refreshToken) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Microsoft no devolvió refresh_token. Vuelve a autorizar OneDrive.",
          },
          { status: 400 }
        );
      }

      const {
        error: insertError,
      } = await supabase
        .from("onedrive_connections")
        .insert({
          provider:
            "microsoft",

          drive_id:
            driveId,

          drive_type:
            driveType || null,

          owner_name:
            ownerName || null,

          refresh_token:
            refreshToken,

          updated_at:
            new Date().toISOString(),
        });

      if (insertError) {
        console.error(
          "Error guardando conexión:",
          insertError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "OneDrive se conectó, pero no se pudo guardar la conexión en Supabase.",
            detalle:
              insertError.message,
          },
          { status: 500 }
        );
      }
    }

    /*
     * 9. Nunca devolvemos tokens
     */
    return NextResponse.json({
      success: true,

      mensaje:
        "OneDrive conectado y guardado correctamente en VIPACK.",

      drive: {
        id:
          driveId,

        tipo:
          driveType || null,

        propietario:
          ownerName || null,
      },

      conexion_guardada:
        true,

      siguiente_paso:
        "Localizar la carpeta Envios/Recoleccion por cliente.",
    });
  } catch (error: unknown) {
    console.error(
      "Error callback OneDrive:",
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