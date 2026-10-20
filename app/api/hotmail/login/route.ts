


import { NextRequest, NextResponse } from "next/server";
import { verificarSesionAdmin } from "@/lib/vipack-auth";

import {
  crearUrlAutorizacion,
  generarCodeChallenge,
  generarCodeVerifier,
  generarState,
} from "@/lib/hotmail/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // 1. Verificar sesión administrativa
  if (!verificarSesionAdmin(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Sesión administrativa no autorizada.",
      },
      { status: 401 }
    );
  }

  // 2. Verificar que la solicitud provenga de VIPACK
  const origen = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (
    origen !== request.nextUrl.origin ||
    (fetchSite !== null && fetchSite !== "same-origin")
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Origen de solicitud no autorizado.",
      },
      { status: 403 }
    );
  }

  try {
    // 3. Generar protección OAuth
    const state = generarState();
    const verifier = generarCodeVerifier();
    const challenge = generarCodeChallenge(verifier);

    // 4. Crear URL de autorización de Microsoft
    const url = crearUrlAutorizacion(
      state,
      challenge
    );

    // 5. Devolver URL para navegar desde el botón
    const response = NextResponse.json({
      success: true,
      authorizationUrl: url,
    });

    // 6. Configurar cookies temporales
    const opcionesCookie = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/api/hotmail",
      maxAge: 600,
    };

    // 7. Guardar state
    response.cookies.set(
      "vipack-hotmail-state",
      state,
      opcionesCookie
    );

    // 8. Guardar verificador PKCE
    response.cookies.set(
      "vipack-hotmail-verifier",
      verifier,
      opcionesCookie
    );

    return response;
  } catch {
    // No mostrar tokens ni secretos
    return NextResponse.json(
      {
        success: false,
        error: "No se pudo iniciar la conexión con Microsoft.",
      },
      { status: 500 }
    );
  }
}
