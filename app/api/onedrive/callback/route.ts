import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const errorDescription =
      url.searchParams.get("error_description");

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error,
          detalle: errorDescription,
        },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: "Microsoft no devolvió código de autorización.",
        },
        { status: 400 }
      );
    }

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

    const redirectUri =
      "https://vipack-envios.com/api/onedrive/callback";

    const tokenResponse = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
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
      return NextResponse.json(
        {
          success: false,
          error:
            "Microsoft no pudo intercambiar el código por tokens.",
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
     * Probamos inmediatamente que el token
     * pueda leer el OneDrive conectado.
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

    /*
     * POR SEGURIDAD:
     * No mostramos los tokens completos en pantalla.
     *
     * En el siguiente paso los guardaremos
     * correctamente en Supabase.
     */
    return NextResponse.json({
      success: true,
      mensaje:
        "OneDrive conectado correctamente con VIPACK.",
      drive: {
        id:
          driveData?.id || null,
        tipo:
          driveData?.driveType || null,
        propietario:
          driveData?.owner?.user
            ?.displayName || null,
      },
      refresh_token_recibido:
        Boolean(refreshToken),
      siguiente_paso:
        "Guardar la conexión de OneDrive en Supabase.",
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