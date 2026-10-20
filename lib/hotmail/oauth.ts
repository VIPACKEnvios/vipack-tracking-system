// Archivo destino: lib/hotmail/oauth.ts
// Copia todo este contenido en el archivo indicado.
import "server-only";

import { createHash, randomBytes } from "node:crypto";

const MICROSOFT_AUTHORITY =
  "https://login.microsoftonline.com/common/oauth2/v2.0";

export const HOTMAIL_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Mail.Read",
];

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export function obtenerConfiguracionMicrosoft() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Faltan variables de configuración de Microsoft.");
  }

  return { clientId, clientSecret, redirectUri };
}

export function generarState(): string {
  return randomBytes(32).toString("base64url");
}

export function generarCodeVerifier(): string {
  return randomBytes(64).toString("base64url");
}

export function generarCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function crearUrlAutorizacion(
  state: string,
  codeChallenge: string
): string {
  const { clientId, redirectUri } = obtenerConfiguracionMicrosoft();
  const url = new URL(`${MICROSOFT_AUTHORITY}/authorize`);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", HOTMAIL_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");

  return url.toString();
}

export async function intercambiarCodigoPorTokens(
  code: string,
  codeVerifier: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const { clientId, clientSecret, redirectUri } =
    obtenerConfiguracionMicrosoft();

  const response = await fetch(`${MICROSOFT_AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      scope: HOTMAIL_SCOPES.join(" "),
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as MicrosoftTokenResponse;

  if (!response.ok) {
    // No mostrar respuestas completas de Microsoft para evitar filtrar datos.
    throw new Error(
      `Microsoft rechazó la autorización (${data.error ?? response.status}).`
    );
  }

  if (!data.access_token || !data.refresh_token) {
    throw new Error("Microsoft no devolvió los tokens necesarios.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: Number(data.expires_in ?? 3600),
  };
}