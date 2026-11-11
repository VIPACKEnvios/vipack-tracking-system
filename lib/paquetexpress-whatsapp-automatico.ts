import {
  consentimientoWhatsappVigente,
  normalizarTelefonoWhatsapp,
  limpiarVariableWhatsapp,
  enviarMensajePaquetexpress,
  ESTADOS_PAQUETEXPRESS,
} from "@/lib/paquetexpress-whatsapp";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ReservaWhatsappPaquetexpress = {
  notificacion_id: number;
  telefono_destino: string;
  nombre_destinatario: string;
  estado_evento: string;
};

export async function procesarWhatsappPaquetexpressAutomatico(
  guiasNuevas: Set<string>,
  eventosNuevosPorGuia: Map<string, Set<string>>
) {
  const habilitado =
    process.env.VIPACK_WHATSAPP_PAQUEXPRESS_AUTOMATICO === "true" &&
    process.env.VIPACK_ENVIAR_WHATSAPP_PAQUEXPRESS === "true" &&
    process.env.VIPACK_RESERVAR_WHATSAPP_PAQUEXPRESS === "true";

  if (!habilitado) {
    return {
      modo: "desactivado",
      guiasDetectadas: guiasNuevas.size,
      mensajesEnviados: 0,
    };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const remitente =
    process.env.TWILIO_WHATSAPP_FROM ||
    process.env.TWILIO_WHATSAPP_NUMBER;

  if (!sid || !token || !remitente) {
    return {
      modo: "configuracion_twilio_incompleta",
      guiasDetectadas: guiasNuevas.size,
      mensajesEnviados: 0,
    };
  }

  const supabase = getSupabaseAdmin();
  let guiasElegibles = 0;
  let mensajesEnviados = 0;

  const guiaPrueba =
    process.env.VIPACK_GUIA_PRUEBA_PAQUEXPRESS?.trim();

  for (const guia of guiasNuevas) {
    if (guiaPrueba && guia !== guiaPrueba) continue;

    let reservaPendienteId: number | null = null;

    try {
      const { data: registros, error: errorGuia } = await supabase
        .from("guias_paquexpress_pendientes")
        .select(
          "id,destinatario_nombre,referencia,telefono_whatsapp,whatsapp_autorizado,fecha_autorizacion,origen_autorizacion,evidencia_autorizacion"
        )
        .eq("guia", guia)
        .limit(2);

      if (errorGuia || registros?.length !== 1) continue;

      const registro = registros[0];
      const telefono = normalizarTelefonoWhatsapp(
        registro.telefono_whatsapp
      );

      if (
        !telefono ||
        !consentimientoWhatsappVigente(registro, telefono)
      ) continue;

      const { data: eventos, error: errorEventos } = await supabase
        .from("eventos_paquexpress_historial")
        .select(
          "id,tipo_evento,fecha_evento,cuenta_origen,mensaje_id"
        )
        .eq("guia", guia)
        .order("fecha_evento", { ascending: false })
        .order("id", { ascending: false })
        .limit(1);

      if (errorEventos || !eventos?.length) continue;

      const evento = eventos[0];
      const claveMovimiento =
        `${evento.cuenta_origen}:${evento.mensaje_id}:${evento.tipo_evento}`;

      if (
        !eventosNuevosPorGuia.get(guia)?.has(claveMovimiento)
      ) continue;

      const estado = ESTADOS_PAQUETEXPRESS[evento.tipo_evento];
      if (!estado) continue;

      const claveEvento = `paquetexpress:${guia}:${evento.id}`;

      const { data: existentes, error: errorDuplicado } =
        await supabase
          .from("notificaciones_envios")
          .select("id")
          .eq("canal", "whatsapp")
          .eq("clave_evento", claveEvento)
          .limit(1);

      if (errorDuplicado || existentes?.length) continue;

      guiasElegibles++;

      const { data: reservas, error: errorReserva } =
        await supabase.rpc(
          "reservar_whatsapp_paquexpress",
          {
            p_guia: guia,
            p_evento_id: evento.id,
          }
        );

      if (errorReserva) {
        console.error(
          "VIPACK: reserva automatica rechazada:",
          errorReserva.code
        );
        continue;
      }

      const reserva = reservas?.[0] as
        | ReservaWhatsappPaquetexpress
        | undefined;

      if (!reserva?.notificacion_id) continue;

      reservaPendienteId = reserva.notificacion_id;

      const cerrarReserva = async (motivo: string) => {
        const { error } = await supabase
          .from("notificaciones_envios")
          .update({
            estado_notificacion: "fallido",
            ultimo_error: motivo.slice(0, 1000),
            fecha_actualizacion: new Date().toISOString(),
          })
          .eq("id", reserva.notificacion_id)
          .eq("estado_notificacion", "procesando");

        if (error) {
          console.error(
            "VIPACK: no se pudo cerrar reserva:",
            error
          );
        }
      };

      const consentimientoValido = async () => {
        const { data, error } = await supabase
          .from("guias_paquexpress_pendientes")
          .select(
            "telefono_whatsapp,whatsapp_autorizado,fecha_autorizacion,origen_autorizacion,evidencia_autorizacion"
          )
          .eq("id", registro.id)
          .single();

        return (
          !error &&
          !!data &&
          consentimientoWhatsappVigente(
            data,
            reserva.telefono_destino
          )
        );
      };

      if (!(await consentimientoValido())) {
        await cerrarReserva(
          "Consentimiento revocado o telefono modificado."
        );
        continue;
      }

      const variablesTwilio = {
        "1": limpiarVariableWhatsapp(
          reserva.nombre_destinatario,
          "Cliente"
        ),
        "2": limpiarVariableWhatsapp(
          registro.referencia,
          "Sin pedido"
        ),
        "3": "Paquetexpress",
        "4": guia,
        "5": limpiarVariableWhatsapp(
          reserva.estado_evento,
          estado
        ),
      };

      if (!(await consentimientoValido())) {
        await cerrarReserva(
          "Autorizacion no vigente antes de contactar Twilio."
        );
        continue;
      }

      try {
        const mensaje = await enviarMensajePaquetexpress({
          sid,
          token,
          remitente,
          telefonoDestino: reserva.telefono_destino,
          variables: variablesTwilio,
        });

        const { data: confirmado, error: errorRegistro } =
          await supabase
            .from("notificaciones_envios")
            .update({
              estado_notificacion: "enviado",
              twilio_sid: mensaje.sid,
              intentos: 1,
              fecha_envio: new Date().toISOString(),
              fecha_actualizacion: new Date().toISOString(),
              ultimo_error: null,
            })
            .eq("id", reserva.notificacion_id)
            .eq("estado_notificacion", "procesando")
            .select("id");

        if (errorRegistro || confirmado?.length !== 1) {
          console.error(
            "VIPACK: Twilio acepto el mensaje, pero fallo el registro. Revision manual obligatoria.",
            mensaje.sid
          );
          continue;
        }

        mensajesEnviados++;
      } catch (error) {
        const detalle =
          error instanceof Error
            ? error.message
            : "Resultado desconocido";

        await cerrarReserva(
          "REVISION MANUAL OBLIGATORIA: resultado de Twilio no confirmado. No reenviar automaticamente. " +
          detalle
        );
      }
    } catch (error) {
      console.error(
        "VIPACK: error procesando guia automatica:",
        error
      );

      if (reservaPendienteId !== null) {
        const { error: errorCierre } = await supabase
          .from("notificaciones_envios")
          .update({
            estado_notificacion: "fallido",
            ultimo_error:
              "REVISION MANUAL OBLIGATORIA: error inesperado. No reenviar automaticamente.",
            fecha_actualizacion: new Date().toISOString(),
          })
          .eq("id", reservaPendienteId)
          .eq("estado_notificacion", "procesando");

        if (errorCierre) {
          console.error(
            "VIPACK: no se pudo cerrar reserva inesperada:",
            errorCierre.code
          );
        }
      }
    }
  }

  return {
    modo: "procesamiento_automatico",
    guiasDetectadas: guiasNuevas.size,
    guiasElegibles,
    mensajesEnviados,
  };
}
