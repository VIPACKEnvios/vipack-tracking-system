import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clientId =
      process.env.ONEDRIVE_CLIENT_ID;

    if (!clientId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta ONEDRIVE_CLIENT_ID.",
        },
        { status: 500 }
      );
    }

    const redirectUri =
      "https://vipack-envios.com/api/onedrive/callback";

    const scopes = [
      "openid",
      "profile",
      "offline_access",
      "User.Read",
      "Files.ReadWrite",
    ].join(" ");

    const params =
      new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        response_mode: "query",
        scope: scopes,
        prompt: "consent",
      });

    const authorizeUrl =
      `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params.toString()}`;

    return NextResponse.redirect(
      authorizeUrl
    );
  } catch (error: unknown) {
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