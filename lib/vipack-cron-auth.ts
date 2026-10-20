
import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

import { verificarSesionAdmin } from "@/lib/vipack-auth";

function verificarCronSecret(
  request: NextRequest
): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret || secret.length < 32) {
    return false;
  }

  const authorization =
    request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const token = authorization.slice(7);

  const esperado = Buffer.from(secret, "utf8");
  const recibido = Buffer.from(token, "utf8");

  if (esperado.length !== recibido.length) {
    return false;
  }

  return timingSafeEqual(esperado, recibido);
}

export function verificarAccesoHotmail(
  request: NextRequest
): boolean {
  return (
    verificarSesionAdmin(request) ||
    verificarCronSecret(request)
  );
}
