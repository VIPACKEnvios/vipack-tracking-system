import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

const ACTUALIZACION_TEMPLATE = "HX23277e717da845d5b292d5c196900566";
import { verificarSesionAdmin } from "@/lib/vipack-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorJson(error: string, status: number) {
  return NextResponse.json(
    { success: false, error },
    { status }
  );
}

function normalizarTelefono(valor: unknown): string | null {
  const digitos = String(valor ?? "").replace(/\D/g, "");

  if (/^\d{10}$/.test(digitos)) return `521${digitos}`;
  if (/^52\d{10}$/.test(digitos)) return `521${digitos.slice(2)}`;
  if (/^521\d{10}$/.test(digitos)) return digitos;

  return null;
}

function limpiarVariable(valor: unknown, respaldo: string): string {
  const texto = String(valor ?? "")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return texto || respaldo;
}
function consentimientoVigente(
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
    normalizarTelefono(registro.telefono_whatsapp) === telefonoReservado
  );
}
const ESTADOS: Record<string, string> = {
  recoleccion: "Recolectado",
  comienzo_viaje: "En tránsito",
  entregado: "Entregado",
};

export async function POST(request: NextRequest) {
  if (!verificarSesionAdmin(request)) {
    return errorJson("Sesión administrativa no válida", 401);
  }

  const origen = request.headers.get("origin");

  if (origen && origen !== request.nextUrl.origin) {
    return errorJson("Origen no permitido", 403);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorJson("JSON inválido", 400);
  }

  const guia = String(
    (body as { guia?: unknown } | null)?.guia ?? ""
  ).trim();

  if (!/^\d{12}$/.test(guia)) {
    return errorJson("Guía inválida", 400);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return errorJson("Configuración de Supabase incompleta", 500);
  }

  try {
    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: guias, error: errorGuia } = await supabase
      .from("guias_paquexpress_pendientes")
      .select(
        "id,guia,destinatario_nombre,telefono_whatsapp,whatsapp_autorizado,fecha_autorizacion,origen_autorizacion,evidencia_autorizacion"
      )
      .eq("guia", guia)
      .limit(2);

    if (errorGuia) throw errorGuia;

    if (!guias || guias.length !== 1) {
      return errorJson("Guía inexistente o duplicada", 404);
    }

    const registro = guias[0];
    const telefono = normalizarTelefono(registro.telefono_whatsapp);

    if (!telefono) {
      return errorJson("Teléfono de WhatsApp inválido", 400);
    }

    if (
      registro.whatsapp_autorizado !== true ||
      !registro.fecha_autorizacion ||
      !String(registro.origen_autorizacion ?? "").trim() ||
      !String(registro.evidencia_autorizacion ?? "").trim()
    ) {
      return errorJson(
        "El destinatario no tiene autorización de WhatsApp registrada",
        403
      );
    }

    const { data: eventos, error: errorEventos } = await supabase
      .from("eventos_paquexpress_historial")
      .select("id,tipo_evento,fecha_evento")
      .eq("guia", guia)
      .order("fecha_evento", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);

    if (errorEventos) throw errorEventos;

    if (!eventos || eventos.length === 0) {
      return errorJson("La guía no tiene eventos registrados", 404);
    }

    const evento = eventos[0];
    const estado = ESTADOS[evento.tipo_evento];

    if (!estado) {
      return errorJson("Tipo de evento no permitido", 400);
    }

    const { data: datosPedido, error: errorPedido } = await supabase
      .from("guias_paquexpress_pendientes")
      .select("referencia")
      .eq("id", registro.id)
      .single();

    if (errorPedido) throw errorPedido;

    const variablesTwilio = {
      "1": limpiarVariable(registro.destinatario_nombre, "Cliente"),
      "2": limpiarVariable(datosPedido?.referencia, "Sin pedido"),
      "3": "Paquetexpress",
      "4": guia,
      "5": estado,
    };

    const configuracionTwilioLista = Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (
        process.env.TWILIO_WHATSAPP_FROM ||
        process.env.TWILIO_WHATSAPP_NUMBER
      )
    );
    const claveEvento = `paquetexpress:${guia}:${evento.id}`;

    const { data: existente, error: errorDuplicado } = await supabase
      .from("notificaciones_envios")
      .select("id,estado_notificacion")
      .eq("canal", "whatsapp")
      .eq("clave_evento", claveEvento)
      .limit(1);

    if (errorDuplicado) throw errorDuplicado;

    if (existente && existente.length > 0) {
      return errorJson(
        "Este evento ya tiene un intento de WhatsApp registrado",
        409
      );
    }
    const envioRealHabilitado =
      process.env.VIPACK_ENVIAR_WHATSAPP_PAQUEXPRESS === "true";

    if (
      envioRealHabilitado &&
      process.env.VIPACK_RESERVAR_WHATSAPP_PAQUEXPRESS !== "true"
    ) {
      return errorJson(
        "El envío requiere habilitar primero la reserva segura.",
        503
      );
    }

    if (process.env.VIPACK_RESERVAR_WHATSAPP_PAQUEXPRESS === "true") {
      const { data: reserva, error: errorReserva } = await supabase.rpc(
        "reservar_whatsapp_paquexpress",
        {
          p_guia: guia,
          p_evento_id: evento.id,
        }
      );

      if (errorReserva) {
        if (errorReserva.code === "23505") {
          return errorJson("Este evento ya fue reservado", 409);
        }

        console.error("VIPACK: error de reserva:", errorReserva);
        return errorJson("No se pudo reservar la notificación", 409);
      }

      const reservaActual = reserva?.[0];

      if (!reservaActual?.notificacion_id) {
        return errorJson("La reserva no devolvió un identificador", 500);
      }

      const { data: consentimientoActual, error: errorConsentimiento } =
        await supabase
          .from("guias_paquexpress_pendientes")
          .select("telefono_whatsapp,whatsapp_autorizado,fecha_autorizacion,origen_autorizacion,evidencia_autorizacion")
          .eq("id", registro.id)
          .single();

      if (
        errorConsentimiento ||
        !consentimientoActual ||
        !consentimientoVigente(
          consentimientoActual,
          reservaActual.telefono_destino
        )
      ) {
        const { error: errorCierre } = await supabase
          .from("notificaciones_envios")
          .update({
            estado_notificacion: "fallido",
            ultimo_error: "Consentimiento ausente, revocado o teléfono modificado antes del envío.",
            fecha_actualizacion: new Date().toISOString(),
          })
          .eq("id", reservaActual.notificacion_id)
          .eq("estado_notificacion", "procesando");

        if (errorCierre) {
          console.error("VIPACK: error cerrando reserva:", errorCierre);
        }

        return errorJson(
          "El consentimiento ya no está vigente. No se envió WhatsApp.",
          403
        );
      }
      if (envioRealHabilitado) {
        const idNotificacion = reservaActual.notificacion_id;
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        const remitente =
          process.env.TWILIO_WHATSAPP_FROM ||
          process.env.TWILIO_WHATSAPP_NUMBER;

        if (!sid || !token || !remitente) {
          await supabase
            .from("notificaciones_envios")
            .update({
              estado_notificacion: "fallido",
              ultimo_error: "Configuración de Twilio incompleta.",
              fecha_actualizacion: new Date().toISOString(),
            })
            .eq("id", idNotificacion)
            .eq("estado_notificacion", "procesando");

          return errorJson("Configuración de Twilio incompleta", 503);
        }

        const { data: autorizacionFinal, error: errorAutorizacionFinal } =
          await supabase
            .from("guias_paquexpress_pendientes")
            .select("telefono_whatsapp,whatsapp_autorizado,fecha_autorizacion,origen_autorizacion,evidencia_autorizacion")
            .eq("id", registro.id)
            .single();

        if (
          errorAutorizacionFinal ||
          !autorizacionFinal ||
          !consentimientoVigente(
            autorizacionFinal,
            reservaActual.telefono_destino
          )
        ) {
          const { error: errorCierreFinal } = await supabase
            .from("notificaciones_envios")
            .update({
              estado_notificacion: "fallido",
              ultimo_error: "Autorización revocada o teléfono modificado antes de contactar a Twilio.",
              fecha_actualizacion: new Date().toISOString(),
            })
            .eq("id", idNotificacion)
            .eq("estado_notificacion", "procesando");

          if (errorCierreFinal) {
            console.error("VIPACK: error cerrando reserva:", errorCierreFinal);
          }

          return errorJson(
            "La autorización de WhatsApp ya no está vigente. No se envió el mensaje.",
            403
          );
        }
        let mensajeAceptadoPorTwilio = false;

        try {
          const clienteTwilio = twilio(sid, token);
          const mensaje = await clienteTwilio.messages.create({
            from: remitente.startsWith("whatsapp:")
              ? remitente
              : `whatsapp:${remitente}`,
            to: `whatsapp:+${reservaActual.telefono_destino}`,
            contentSid: ACTUALIZACION_TEMPLATE,
            contentVariables: JSON.stringify(variablesTwilio),
          });

          mensajeAceptadoPorTwilio = true;

          const { data: registroConfirmado, error: errorRegistro } = await supabase
            .from("notificaciones_envios")
            .update({
              estado_notificacion: "enviado",
              twilio_sid: mensaje.sid,
              intentos: 1,
              fecha_envio: new Date().toISOString(),
              fecha_actualizacion: new Date().toISOString(),
              ultimo_error: null,
            })
            .eq("id", idNotificacion)
            .eq("estado_notificacion", "procesando")
            .select("id");

          if (errorRegistro || registroConfirmado?.length !== 1) {
            console.error(
              "VIPACK: Twilio aceptó el mensaje, pero falló el registro:",
              errorRegistro,
              "SID:", mensaje.sid
            );

            return NextResponse.json({
              success: false,
              requiere_revision_manual: true,
              mensaje: "Twilio aceptó el mensaje, pero Supabase no confirmó el registro. No reenviar.",
              guia,
              notificacion_id: idNotificacion,
              twilio_sid: mensaje.sid,
            }, { status: 202 });
          }

          return NextResponse.json({
            success: true,
            modo: "envio_manual",
            mensaje: "Twilio aceptó el mensaje de WhatsApp.",
            guia,
            notificacion_id: idNotificacion,
            twilio_sid: mensaje.sid,
            estado_twilio: mensaje.status,
          });
        } catch (error) {
          const detalle =
            error instanceof Error ? error.message : String(error);

          if (mensajeAceptadoPorTwilio) {
            console.error(
              "VIPACK: error posterior a la aceptación de Twilio:",
              error
            );

            return errorJson(
              "Twilio aceptó el mensaje. Revisar el registro antes de cualquier reintento.",
              500
            );
          }

          const { error: errorRegistro } = await supabase
            .from("notificaciones_envios")
            .update({
              estado_notificacion: "fallido",
              intentos: 1,
              ultimo_error: (
                "REVISIÓN MANUAL OBLIGATORIA: resultado de Twilio no confirmado. " +
                "No reenviar sin consultar el historial de Twilio. " +
                detalle
              ).slice(0, 1000),
              fecha_actualizacion: new Date().toISOString(),
            })
            .eq("id", idNotificacion)
            .eq("estado_notificacion", "procesando");

          if (errorRegistro) {
            console.error(
              "VIPACK: no se pudo registrar el error de Twilio:",
              errorRegistro
            );
          }

          console.error("VIPACK: error de Twilio:", error);

          return errorJson(
            "No se confirmó el envío. Revisar Twilio antes de reintentar.",
            502
          );
        }
      }
      return NextResponse.json({
        success: true,
        modo: "reserva_sin_envio",
        mensaje: "Notificación reservada. No se envió WhatsApp.",
        guia,
        reserva,
      });
    }

    return NextResponse.json({
      success: true,
      modo: "validacion_sin_envio",
      mensaje: "Validaciones correctas. No se envió WhatsApp.",
      guia,
      destinatario: registro.destinatario_nombre,
      evento_id: evento.id,
      estado,
      fecha_evento: evento.fecha_evento,
      telefono_confirmado: true,
      consentimiento_confirmado: true,
    });
  } catch (error) {
    console.error("VIPACK: error preparando WhatsApp:", error);

    return errorJson(
      "No se pudo preparar la notificación",
      500
    );
  }
}
