
import { NextRequest, NextResponse } from "next/server";

import { verificarAccesoHotmail } from "@/lib/vipack-cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { GET as revisarCorreos } from "../revisar/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TipoEvento = "recoleccion" | "comienzo_viaje";

type EventoDetectado = {
  guia: string | null;
  envio_id: number | null;
  evento: string;
  fecha: string | null;
  resultado: string;
  mensaje_id: string;
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

type Candidato = {
  envio_id: number;
  guia: string;
  tipo_evento: TipoEvento;
  cuenta_origen: string;
  fecha_evento: string;
};

type CandidatoPendiente = {
  guia: string;
  tipo_evento: TipoEvento;
  cuenta_origen: string;
  fecha_evento: string;
  mensaje_id: string;
};

function esTipoEventoValido(
  evento: string
): evento is TipoEvento {
  return (
    evento === "recoleccion" ||
    evento === "comienzo_viaje"
  );
}

export async function POST(request: NextRequest) {
  if (!verificarAccesoHotmail(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Sesión administrativa no autorizada.",
      },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: configuracion, error: errorConfig } =
      await supabase
        .from("configuracion_paquexpress")
        .select("fecha_inicio, registro_eventos_activo")
        .eq("id", 1)
        .single();

    if (errorConfig || !configuracion) {
      return NextResponse.json(
        {
          success: false,
          error: "No se pudo leer la configuración.",
        },
        { status: 500 }
      );
    }

    if (!configuracion.registro_eventos_activo) {
      return NextResponse.json({
        success: true,
        modo: "registro_desactivado",
        registrados: 0,
        pendientesRegistrados: 0,
        modificaEnvios: false,
        enviaWhatsapp: false,
      });
    }

    const fechaInicio = new Date(
      configuracion.fecha_inicio
    ).getTime();

    if (!Number.isFinite(fechaInicio)) {
      throw new Error("Fecha de inicio inválida.");
    }

    const respuestaRevision = await revisarCorreos(request);

    if (!respuestaRevision.ok) {
      throw new Error("No fue posible revisar los correos.");
    }

    const revision: ResultadoRevision =
      await respuestaRevision.json();

    if (
      !revision.success ||
      !revision.resultados ||
      revision.resultados.length === 0
    ) {
      throw new Error("La revisión no fue completa.");
    }

    if (
      revision.resultados.some(
        (cuenta) =>
          !cuenta.success ||
          cuenta.limitePaginasAlcanzado === true
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Lectura incompleta. No se registraron eventos.",
          enviaWhatsapp: false,
        },
        { status: 409 }
      );
    }

    const candidatos = new Map<string, Candidato>();

    const candidatosPendientes =
      new Map<string, CandidatoPendiente>();

    let eventosOmitidos = 0;

    for (const cuenta of revision.resultados) {
      for (const evento of cuenta.eventos || []) {
        if (
          !evento.guia ||
          !/^\d{12}$/.test(evento.guia)
        ) {
          eventosOmitidos++;
          continue;
        }

        if (!esTipoEventoValido(evento.evento)) {
          eventosOmitidos++;
          continue;
        }

        const fechaEvento = evento.fecha
          ? new Date(evento.fecha).getTime()
          : NaN;

        if (
          !Number.isFinite(fechaEvento) ||
          fechaEvento < fechaInicio ||
          fechaEvento > Date.now() + 5 * 60_000
        ) {
          eventosOmitidos++;
          continue;
        }

        const tipoEvento = evento.evento;

        // GUÍAS QUE YA EXISTEN EN VIPACK
        if (evento.resultado === "coincidencia_valida") {
          if (
            evento.envio_id === null ||
            !Number.isSafeInteger(evento.envio_id) ||
            evento.envio_id <= 0
          ) {
            eventosOmitidos++;
            continue;
          }

          const clave =
            `${evento.envio_id}:${tipoEvento}`;

          if (!candidatos.has(clave)) {
            candidatos.set(clave, {
              envio_id: evento.envio_id,
              guia: evento.guia,
              tipo_evento: tipoEvento,
              cuenta_origen: cuenta.cuenta,
              fecha_evento: evento.fecha as string,
            });
          }

          continue;
        }

        // GUÍAS NUEVAS QUE AÚN NO TIENEN CLIENTE
        if (evento.resultado === "sin_coincidencia") {
          if (
            !evento.mensaje_id ||
            typeof evento.mensaje_id !== "string" ||
            !evento.mensaje_id.trim()
          ) {
            eventosOmitidos++;
            continue;
          }

          const clavePendiente = [
            cuenta.cuenta,
            evento.mensaje_id,
            evento.guia,
            tipoEvento,
          ].join(":");

          if (!candidatosPendientes.has(clavePendiente)) {
            candidatosPendientes.set(clavePendiente, {
              guia: evento.guia,
              tipo_evento: tipoEvento,
              cuenta_origen: cuenta.cuenta,
              fecha_evento: evento.fecha as string,
              mensaje_id: evento.mensaje_id,
            });
          }

          continue;
        }

        // GUÍAS ENTREGADAS, BLOQUEADAS,
        // DUPLICADAS O NO IDENTIFICADAS
        eventosOmitidos++;
      }
    }

    let registrados = 0;
    let duplicados = 0;
    let omitidos = eventosOmitidos;

    let pendientesRegistrados = 0;
    let pendientesDuplicados = 0;
    let pendientesOmitidos = 0;

    const errores: string[] = [];

    const resultadosRegistro: Record<string, number> = {};
    const resultadosPendientes: Record<string, number> = {};

    // REGISTRO DE GUÍAS EXISTENTES
    for (const candidato of candidatos.values()) {
      const { data, error } = await supabase.rpc(
        "registrar_evento_paquexpress",
        {
          p_envio_id: candidato.envio_id,
          p_guia: candidato.guia,
          p_tipo_evento: candidato.tipo_evento,
          p_cuenta_origen: candidato.cuenta_origen,
          p_fecha_evento: candidato.fecha_evento,
        }
      );

      if (error || typeof data !== "string") {
        errores.push(
          `No se pudo registrar la guía existente ${candidato.guia}.`
        );
        continue;
      }

      resultadosRegistro[data] =
        (resultadosRegistro[data] || 0) + 1;

      if (data === "registrado") {
        registrados++;
      } else if (data === "duplicado") {
        duplicados++;
      } else {
        omitidos++;
      }
    }

    // REGISTRO DE GUÍAS NUEVAS Y SU HISTORIAL
    for (const candidato of candidatosPendientes.values()) {
      const { data, error } = await supabase.rpc(
        "registrar_guia_paquexpress_pendiente",
        {
          p_guia: candidato.guia,
          p_tipo_evento: candidato.tipo_evento,
          p_fecha_evento: candidato.fecha_evento,
          p_cuenta_origen: candidato.cuenta_origen,
          p_mensaje_id: candidato.mensaje_id,
        }
      );

      if (error || typeof data !== "string") {
        errores.push(
          `No se pudo guardar la guía pendiente ${candidato.guia}.`
        );
        continue;
      }

      resultadosPendientes[data] =
        (resultadosPendientes[data] || 0) + 1;

      if (data === "registrado") {
        pendientesRegistrados++;
      } else if (data === "duplicado") {
        pendientesDuplicados++;
      } else {
        pendientesOmitidos++;
      }
    }

    return NextResponse.json({
      success: errores.length === 0,
      modo: "registro_seguro_sin_whatsapp",

      candidatos: candidatos.size,
      registrados,
      duplicados,
      omitidos,

      candidatosPendientes: candidatosPendientes.size,
      pendientesRegistrados,
      pendientesDuplicados,
      pendientesOmitidos,

      resultadosRegistro,
      resultadosPendientes,
      errores,

      modificaEnvios: false,
      enviaWhatsapp: false,
    });
  } catch (error) {
    console.error(
      "[VIPACK PAQUETEXPRESS] Error en registro:",
      error instanceof Error
        ? error.message
        : "Error desconocido"
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "No se pudo completar el registro de eventos.",
        modificaEnvios: false,
        enviaWhatsapp: false,
      },
      { status: 500 }
    );
  }
}
