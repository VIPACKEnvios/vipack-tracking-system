
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { POST as registrarEventos } from "../../hotmail/registrar/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verificarCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret || secret.length < 32) {
    return false;
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const recibido = Buffer.from(
    authorization.slice(7),
    "utf8"
  );

  const esperado = Buffer.from(secret, "utf8");

  return (
    recibido.length === esperado.length &&
    timingSafeEqual(recibido, esperado)
  );
}

export async function GET(request: NextRequest) {
  if (!verificarCron(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Cron no autorizado.",
      },
      { status: 401 }
    );
  }

  const solicitudInterna = new NextRequest(
    new URL("/api/hotmail/registrar", request.url),
    {
      method: "POST",
      headers: {
        authorization:
          request.headers.get("authorization") || "",
      },
    }
  );

  return registrarEventos(solicitudInterna);
}
