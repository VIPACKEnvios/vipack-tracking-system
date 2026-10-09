
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const encoder = new TextEncoder();

function convertirHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function validarSesion(token: string | undefined) {
  const secret = process.env.VIPACK_SESSION_SECRET;

  if (!token || !secret || secret.length < 32) {
    return false;
  }

  const partes = token.split(".");

  if (partes.length !== 3 || partes[0] !== "v1") {
    return false;
  }

  const [, expiresTexto, firma] = partes;

  if (!/^\d+$/.test(expiresTexto) || !/^[a-f0-9]{64}$/.test(firma)) {
    return false;
  }

  const expires = Number(expiresTexto);

  if (
    !Number.isSafeInteger(expires) ||
    expires <= Math.floor(Date.now() / 1000)
  ) {
    return false;
  }

  const payload = `v1.${expiresTexto}`;

  const clave = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const firmaCalculada = await crypto.subtle.sign(
    "HMAC",
    clave,
    encoder.encode(payload)
  );

  const firmaEsperada = convertirHex(
    new Uint8Array(firmaCalculada)
  );

  // Comparamos todos los caracteres sin salir
  // anticipadamente al encontrar una diferencia.
  let diferencia = 0;

  for (let i = 0; i < firmaEsperada.length; i++) {
    diferencia |=
      firmaEsperada.charCodeAt(i) ^ firma.charCodeAt(i);
  }

  return diferencia === 0;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isPublicPage =
    path === "/login" ||
    path === "/registro-bazar" ||
    path === "/registro-cliente" ||
    path === "/consulta-bazares" ||
    path === "/informacion" ||
    path.startsWith("/informacion/") ||
    path.startsWith("/inventario/");

  const isPublicApi =
    path === "/api/login" ||
    path.startsWith("/api/registro-bazar") ||
    path.startsWith("/api/registro-cliente") ||
    path.startsWith("/api/consulta-bazares") ||
    path.startsWith("/api/trackingmore/") ||
    path === "/api/onedrive/login" ||
    path === "/api/onedrive/callback" ||
    path.startsWith("/api/inventario/");

  if (isPublicPage || isPublicApi) {
    return NextResponse.next();
  }

  const token = request.cookies.get("vipack-auth")?.value;

  const autorizado = await validarSesion(token);

  if (!autorizado) {
    if (path.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          error: "Sesión no válida o caducada.",
        },
        { status: 401 }
      );
    }

    const response = NextResponse.redirect(
      new URL("/login", request.url)
    );

    response.cookies.delete("vipack-auth");

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
