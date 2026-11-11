export const ESTADOS_PAQUETEXPRESS: Record<string, string> = {
  recoleccion: "Recolectado",
  comienzo_viaje: "En tránsito",
  entregado: "Entregado",
};

export function normalizarTelefonoWhatsapp(
  valor: unknown
): string | null {
  const digitos = String(valor ?? "").replace(/\D/g, "");

  if (/^\d{10}$/.test(digitos)) return `521${digitos}`;
  if (/^52\d{10}$/.test(digitos)) {
    return `521${digitos.slice(2)}`;
  }
  if (/^521\d{10}$/.test(digitos)) return digitos;

  return null;
}

export function limpiarVariableWhatsapp(
  valor: unknown,
  respaldo: string
): string {
  const texto = String(valor ?? "")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return texto || respaldo;
}

export function consentimientoWhatsappVigente(
  registro: {
    telefono_whatsapp?: unknown;
    whatsapp_autorizado?: unknown;
    fecha_autorizacion?: unknown;
    origen_autorizacion?: unknown;
    evidencia_autorizacion?: unknown;
  },
  telefonoReservado: string
): boolean {
  return (
    registro.whatsapp_autorizado === true &&
    Boolean(registro.fecha_autorizacion) &&
    Boolean(String(registro.origen_autorizacion ?? "").trim()) &&
    Boolean(String(registro.evidencia_autorizacion ?? "").trim()) &&
    normalizarTelefonoWhatsapp(registro.telefono_whatsapp) ===
      telefonoReservado
  );
}

export const ACTUALIZACION_TEMPLATE_PAQUETEXPRESS = "HX23277e717da845d5b292d5c196900566";

export async function enviarMensajePaquetexpress(
  parametros: {
    sid: string;
    token: string;
    remitente: string;
    telefonoDestino: string;
    variables: Record<string, string>;
  }
) {
  const twilio = (await import("twilio")).default;

  const cliente = twilio(
    parametros.sid,
    parametros.token
  );

  return cliente.messages.create({
    from: parametros.remitente.startsWith("whatsapp:")
      ? parametros.remitente
      : `whatsapp:${parametros.remitente}`,
    to: `whatsapp:+${parametros.telefonoDestino}`,
    contentSid: ACTUALIZACION_TEMPLATE_PAQUETEXPRESS,
    contentVariables: JSON.stringify(parametros.variables),
  });
}
