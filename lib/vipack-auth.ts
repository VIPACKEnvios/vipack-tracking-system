
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

const COOKIE_NAME = "vipack-auth";

export function verificarSesionAdmin(
  request: NextRequest
): boolean {
  const secret = process.env.VIPACK_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    return false;
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return false;
  }

  const partes = token.split(".");

  if (partes.length !== 3 || partes[0] !== "v1") {
    return false;
  }

  const [, expiresTexto, firmaRecibida] = partes;

  if (!/^\d+$/.test(expiresTexto)) {
    return false;
  }

  const expires = Number(expiresTexto);

  if (
    !Number.isSafeInteger(expires) ||
    expires <= Math.floor(Date.now() / 1000)
  ) {
    return false;
  }

  if (!/^[a-f0-9]{64}$/.test(firmaRecibida)) {
    return false;
  }

  const payload = `v1.${expiresTexto}`;

  const firmaEsperada = createHmac("sha256", secret)
    .update(payload)
    .digest();

  const firmaActual = Buffer.from(
    firmaRecibida,
    "hex"
  );

  return (
    firmaActual.length === firmaEsperada.length &&
    timingSafeEqual(firmaActual, firmaEsperada)
  );
}
