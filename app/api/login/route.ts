
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const COOKIE_NAME = "vipack-auth";
const SESSION_SECONDS = 60 * 60 * 8;

export async function POST(req: Request) {
  try {
    const { usuario, password } = await req.json();

    const userOk = process.env.VIPACK_USER;
    const passOk = process.env.VIPACK_PASSWORD;
    const secret = process.env.VIPACK_SESSION_SECRET;

    if (!userOk || !passOk || !secret || secret.length < 32) {
      console.error("Configuración de autenticación incompleta.");

      return NextResponse.json(
        {
          success: false,
          error: "Error de configuración del servidor.",
        },
        { status: 500 }
      );
    }

    const usuarioValido =
      typeof usuario === "string" && usuario === userOk;

    const passwordValido =
      typeof password === "string" && password === passOk;

    if (!usuarioValido || !passwordValido) {
      return NextResponse.json(
        { success: false, error: "Credenciales incorrectas." },
        { status: 401 }
      );
    }

    const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const payload = `v1.${expires}`;

    const signature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const sessionToken = `${payload}.${signature}`;

    const response = NextResponse.json({ success: true });

    response.cookies.set(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_SECONDS,
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Error en login." },
      { status: 500 }
    );
  }
}
