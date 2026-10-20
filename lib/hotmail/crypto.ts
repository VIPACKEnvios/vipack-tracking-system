
import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITMO = "aes-256-gcm";
const VERSION = "v1";

function obtenerClave(): Buffer {
  const claveBase64 =
    process.env.HOTMAIL_TOKEN_ENCRYPTION_KEY;

  if (!claveBase64) {
    throw new Error(
      "Falta HOTMAIL_TOKEN_ENCRYPTION_KEY."
    );
  }

  const clave = Buffer.from(claveBase64, "base64");

  if (clave.length !== 32) {
    throw new Error(
      "La clave de cifrado debe contener 32 bytes."
    );
  }

  return clave;
}

export function cifrarToken(token: string): string {
  if (!token) {
    throw new Error("No se puede cifrar un token vacío.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(
    ALGORITMO,
    obtenerClave(),
    iv
  );

  const cifrado = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  const etiqueta = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    etiqueta.toString("base64url"),
    cifrado.toString("base64url"),
  ].join(".");
}

export function descifrarToken(valor: string): string {
  const partes = valor.split(".");

  if (partes.length !== 4 || partes[0] !== VERSION) {
    throw new Error("Formato de token cifrado inválido.");
  }

  const [, ivBase64, etiquetaBase64, cifradoBase64] =
    partes;

  const iv = Buffer.from(ivBase64, "base64url");
  const etiqueta = Buffer.from(
    etiquetaBase64,
    "base64url"
  );
  const cifrado = Buffer.from(
    cifradoBase64,
    "base64url"
  );

  if (iv.length !== 12 || etiqueta.length !== 16) {
    throw new Error("Datos de cifrado inválidos.");
  }

  const decipher = createDecipheriv(
    ALGORITMO,
    obtenerClave(),
    iv
  );

  decipher.setAuthTag(etiqueta);

  const original = Buffer.concat([
    decipher.update(cifrado),
    decipher.final(),
  ]);

  return original.toString("utf8");
}
