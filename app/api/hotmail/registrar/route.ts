import { procesarWhatsappPaquetexpressAutomatico } from "@/lib/paquetexpress-whatsapp-automatico";

import { NextRequest, NextResponse } from "next/server";
import { verificarAccesoHotmail } from "@/lib/vipack-cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { GET as revisarCorreos } from "../revisar/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const whatsappAutomaticoHabilitado =
  process.env.VIPACK_WHATSAPP_PAQUEXPRESS_AUTOMATICO === "true" &&
  process.env.VIPACK_ENVIAR_WHATSAPP_PAQUEXPRESS === "true" &&
  process.env.VIPACK_RESERVAR_WHATSAPP_PAQUEXPRESS === "true";


type EventoDetectado = {
  guia: string | null;
  envio_id: number | null;
  evento: string;
  fecha: string | null;
  resultado: string;
  mensaje_id: string;
  destinatario_nombre?: string | null;
};

type ResultadoCuenta = {
  cuenta: string;
  success: boolean;
  limitePaginasAlcanzado?: boolean;
  eventos?: EventoDetectado[];
};

type ResultadoRevision = {
  success: boolean;
  resultados?: ResultadoCuenta[];
};

export async function POST(request: NextRequest) {
  if (!verificarAccesoHotmail(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "No autorizado.",
        enviaWhatsapp: false,
      },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: config, error: configError } =
      await supabase
        .from("configuracion_paquexpress")
        .select("fecha_inicio, registro_eventos_activo")
        .eq("id", 1)
        .single();

    if (configError || !config) {
      throw new Error("No se pudo leer la configuración.");
    }

    if (!config.registro_eventos_activo) {
      return NextResponse.json({
        success: true,
        modo: "registro_desactivado",
        registrados: 0,
        modificaEnvios: false,
        enviaWhatsapp: false,
      });
    }

    const inicio = new Date(config.fecha_inicio).getTime();

    if (!Number.isFinite(inicio)) {
      throw new Error("Fecha inicial inválida.");
    }

    const respuesta = await revisarCorreos(request);

    if (!respuesta.ok) {
      throw new Error("Error al revisar los correos.");
    }

    const revision: ResultadoRevision =
      await respuesta.json();

    if (
      !revision.success ||
      !revision.resultados?.length ||
      revision.resultados.some(
        (cuenta) =>
          !cuenta.success ||
          cuenta.limitePaginasAlcanzado
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Lectura incompleta. No se guardaron eventos.",
          enviaWhatsapp: false,
        },
        { status: 409 }
      );
    }

    const guiasConEventosNuevos = new Set<string>();
    const eventosNuevosPorGuia = new Map<string, Set<string>>();
    let registrados = 0;
    let duplicados = 0;
    let omitidos = 0;

    const errores: string[] = [];
    const vistos = new Set<string>();
    const ambiguas = new Set<string>();

    // Identificar guías ambiguas o bloqueadas.
    for (const cuenta of revision.resultados) {
      for (const evento of cuenta.eventos || []) {
        if (
          evento.guia &&
          [
            "guia_duplicada",
            "omitido_bloqueo_manual",
          ].includes(evento.resultado)
        ) {
          ambiguas.add(evento.guia);
        }
      }
    }

    // Registrar únicamente el historial.
    for (const cuenta of revision.resultados) {
      for (const evento of cuenta.eventos || []) {
        const fecha = evento.fecha
          ? new Date(evento.fecha).getTime()
          : NaN;

        if (
          !evento.guia ||
          !/^\d{12}$/.test(evento.guia) ||
          ![
            "recoleccion",
            "comienzo_viaje",
            "entregado",
          ].includes(evento.evento) ||
          ![
            "coincidencia_valida",
            "sin_coincidencia",
            "omitido_entregado",
          ].includes(evento.resultado) ||
          ambiguas.has(evento.guia) ||
          !Number.isFinite(fecha) ||
          fecha < inicio ||
          fecha > Date.now() + 300000 ||
          !evento.mensaje_id?.trim()
        ) {
          omitidos++;
          continue;
        }

        const clave = [
          cuenta.cuenta,
          evento.mensaje_id,
          evento.guia,
          evento.evento,
        ].join(":");

        if (vistos.has(clave)) {
          continue;
        }

        vistos.add(clave);

        const { data, error } = await supabase.rpc(
          "registrar_historial_paquexpress_seguro",
          {
            p_guia: evento.guia,
            p_tipo_evento: evento.evento,
            p_fecha_evento: evento.fecha,
            p_cuenta_origen: cuenta.cuenta,
            p_mensaje_id: evento.mensaje_id,
            p_destinatario_nombre:
              evento.destinatario_nombre || null,
          }
        );

        if (error || typeof data !== "string") {
          errores.push(
            `Error al guardar ${evento.guia}: ${
              error?.message || "respuesta inválida"
            }`
          );
        } else if (data === "registrado") {
          registrados++;
          guiasConEventosNuevos.add(evento.guia);
          const clavesNuevas =
            eventosNuevosPorGuia.get(evento.guia) ?? new Set<string>();
          clavesNuevas.add(`${cuenta.cuenta}:${evento.mensaje_id}:${evento.evento}`);
          eventosNuevosPorGuia.set(evento.guia, clavesNuevas);
        } else if (data === "duplicado") {
          duplicados++;
        } else if (data === "registro_desactivado") {
          errores.push(
            "Registro desactivado durante la ejecución."
          );
        } else {
          omitidos++;
        }
      }
    }

    let resultadoWhatsapp: {
      modo: string;
      guiasDetectadas: number;
      guiasElegibles?: number;
      mensajesEnviados: number;
    };

    try {
      resultadoWhatsapp =
        await procesarWhatsappPaquetexpressAutomatico(
          errores.length === 0
            ? guiasConEventosNuevos
            : new Set<string>(),
          errores.length === 0
            ? eventosNuevosPorGuia
            : new Map<string, Set<string>>()
        );
    } catch (error) {
      console.error("VIPACK: error en procesador WhatsApp:", error);
      resultadoWhatsapp = {
        modo: "error_procesador_sin_envio_confirmado",
        guiasDetectadas: guiasConEventosNuevos.size,
        mensajesEnviados: 0,
      };
    }

    return NextResponse.json(
      {
        success: errores.length === 0,
        modo: resultadoWhatsapp.modo,
        whatsappAutomaticoConfigurado: whatsappAutomaticoHabilitado,
        guiasNuevasDetectadas: guiasConEventosNuevos.size,
        resultadoWhatsapp,
        registrados,
        duplicados,
        omitidos,
        errores,
        modificaEnvios: false,
        enviaWhatsapp: resultadoWhatsapp.mensajesEnviados > 0,
      },
      {
        status: errores.length ? 409 : 200,
      }
    );
  } catch (error) {
    console.error(
      "[VIPACK PAQUETEXPRESS] Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo registrar el historial.",
        enviaWhatsapp: false,
      },
      { status: 500 }
    );
  }
}
