
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { verificarSesionAdmin } from "@/lib/vipack-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { cifrarToken } from "@/lib/hotmail/crypto";
import { intercambiarCodigoPorTokens } from "@/lib/hotmail/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "vipack-hotmail-state";
const VERIFIER_COOKIE = "vipack-hotmail-verifier";

function compararSeguro(a: string, b: string): boolean {
  const primero = Buffer.from(a, "utf8");
  const segundo = Buffer.from(b, "utf8");

  return (
    primero.length === segundo.length &&
    timingSafeEqual(primero, segundo)
  );
}

function limpiarCookies(response: NextResponse) {
  for (const nombre of [STATE_COOKIE, VERIFIER_COOKIE]) {
    response.cookies.set(nombre, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/hotmail",
      maxAge: 0,
    });
  }

  return response;
}

function resultado(
  request: NextRequest,
  estado: string
) {
  const url = new URL("/hotmail", request.url);

  url.searchParams.set("hotmail", estado);

  return limpiarCookies(
    NextResponse.redirect(url)
  );
}

export async function GET(request: NextRequest) {
  if (!verificarSesionAdmin(request)) {
    return limpiarCookies(
      NextResponse.json(
        {
          success: false,
          error: "Sesión no autorizada.",
        },
        {
          status: 401,
        }
      )
    );
  }

  const parametros = request.nextUrl.searchParams;

  const errorMicrosoft = parametros.get("error");

  if (errorMicrosoft) {
    return resultado(
      request,
      "autorizacion_cancelada"
    );
  }

  const code = parametros.get("code");
  const state = parametros.get("state");

  const stateGuardado =
    request.cookies.get(STATE_COOKIE)?.value;

  const verifier =
    request.cookies.get(VERIFIER_COOKIE)?.value;

  if (
    !code ||
    !state ||
    !stateGuardado ||
    !verifier ||
    !compararSeguro(state, stateGuardado)
  ) {
    return resultado(
      request,
      "validacion_fallida"
    );
  }

  try {
    const tokens = await intercambiarCodigoPorTokens(
      code,
      verifier
    );

    const respuestaPerfil = await fetch(
      "https://graph.microsoft.com/v1.0/me",
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!respuestaPerfil.ok) {
      throw new Error(
        "No se pudo consultar el perfil Microsoft."
      );
    }

    const perfil: {
      id?: string;
      mail?: string | null;
      userPrincipalName?: string | null;
    } = await respuestaPerfil.json();

    const microsoftUserId = perfil.id?.trim();

    const correo = (
      perfil.mail ||
      perfil.userPrincipalName ||
      ""
    ).trim();

    if (!microsoftUserId || !correo) {
      throw new Error(
        "Microsoft no devolvió una cuenta válida."
      );
    }

    const fechaExpiracion = new Date(
      Date.now() +
        Math.max(
          60,
          tokens.expiresIn - 300
        ) * 1000
    ).toISOString();

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("hotmail_cuentas")
      .upsert(
        {
          microsoft_user_id: microsoftUserId,
          correo,
          access_token_cifrado: cifrarToken(
            tokens.accessToken
          ),
          refresh_token_cifrado: cifrarToken(
            tokens.refreshToken
          ),
          token_expira_en: fechaExpiracion,
          activo: true,
          ultimo_error: null,
          fecha_actualizacion:
            new Date().toISOString(),
        },
        {
          onConflict: "microsoft_user_id",
        }
      );

    if (error) {
      throw new Error(
        "No se pudo guardar la cuenta."
      );
    }

    return resultado(
      request,
      "conectado"
    );
  } catch {
    // No registrar tokens, códigos OAuth ni secretos.
    return resultado(
      request,
      "error_conexion"
    );
  }
}
