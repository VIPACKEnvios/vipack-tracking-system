
import { NextRequest, NextResponse } from "next/server";

import { verificarAccesoHotmail } from "@/lib/vipack-cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { GET as revisarCorreos } from "../revisar/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EventoDetectado = {
  guia: string | null;
  envio_id: number | null;
  evento: string;
  fecha: string | null;
  resultado: string;
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
  tipo_evento: "recoleccion" | "comienzo_viaje";
  cuenta_origen: string;
  fecha_evento: string;
};

export async function POST(request: NextRequest) {
  if (!verificarAccesoHotmail(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Acceso no autorizado.",
        enviaWhatsapp: false,
      },
      { status: 401 }
    );
  }

  try {
    console.log(
      "[VIPACK PAQUETEXPRESS] Iniciando registro de eventos."
    );

    const supabase = getSupabaseAdmin();

    const { data: configuracion, error: errorConfig } =
      await supabase
        .from("configuracion_paquexpress")
        .select("fecha_inicio, registro_eventos_activo")
        .eq("id", 1)
        .single();

    if (errorConfig || !configuracion) {
      console.error(
        "[VIPACK PAQUETEXPRESS] No se pudo leer la configuración:",
        errorConfig?.message || "Configuración inexistente"
      );

      return NextResponse.json(
        {
          success: false,
          error: "No se pudo leer la configuración.",
          enviaWhatsapp: false,
        },
        { status: 500 }
      );
    }

    if (!configuracion.registro_eventos_activo) {
      console.log(
        "[VIPACK PAQUETEXPRESS] Registro de eventos desactivado."
      );

      return NextResponse.json({
        success: true,
        modo: "registro_desactivado",
        registrados: 0,
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

    console.log(
      "[VIPACK PAQUETEXPRESS] Consultando correos."
    );

    const respuestaRevision = await revisarCorreos(request);

    if (!respuestaRevision.ok) {
      console.error(
        "[VIPACK PAQUETEXPRESS] Falló la revisión. HTTP:",
        respuestaRevision.status
      );

      throw new Error(
        `La revisión de correos respondió HTTP ${respuestaRevision.status}.`
      );
    }

    const revision: ResultadoRevision =
      await respuestaRevision.json();

    if (
      !revision.success ||
      !revision.resultados ||
      revision.resultados.length === 0
    ) {
      throw new Error(
        "La revisión de correos no fue completa."
      );
    }

    if (
      revision.resultados.some(
        (cuenta) =>
          !cuenta.success ||
          cuenta.limitePaginasAlcanzado === true
      )
    ) {
      console.error(
        "[VIPACK PAQUETEXPRESS] Lectura incompleta de Hotmail."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Lectura incompleta. No se registraron eventos.",
          modificaEnvios: false,
          enviaWhatsapp: false,
        },
        { status: 409 }
      );
    }

    const candidatos = new Map<string, Candidato>();

    for (const cuenta of revision.resultados) {
      for (const evento of cuenta.eventos || []) {
        if (
          evento.resultado !== "coincidencia_valida" ||
          !evento.guia ||
          evento.envio_id === null ||
          !Number.isSafeInteger(evento.envio_id)
        ) {
          continue;
        }

        if (
          evento.evento !== "recoleccion" &&
          evento.evento !== "comienzo_viaje"
        ) {
          continue;
        }

        if (!/^\d{12}$/.test(evento.guia)) {
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
          continue;
        }

        const clave =
          `${evento.envio_id}:${evento.evento}`;

        if (!candidatos.has(clave)) {
          candidatos.set(clave, {
            envio_id: evento.envio_id,
            guia: evento.guia,
            tipo_evento: evento.evento,
            cuenta_origen: cuenta.cuenta,
            fecha_evento: evento.fecha as string,
          });
        }
      }
    }

    console.log(
      "[VIPACK PAQUETEXPRESS] Candidatos encontrados:",
      candidatos.size
    );

    let registrados = 0;
    let duplicados = 0;
    let omitidos = 0;

    const errores: string[] = [];
    const resultadosRegistro: Record<string, number> = {};

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
        console.error(
          "[VIPACK PAQUETEXPRESS] Error al registrar evento:",
          error?.message || "Respuesta inválida de Supabase"
        );

        errores.push(
          `No se pudo registrar la guía ${candidato.guia}.`
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

    console.log(
      "[VIPACK PAQUETEXPRESS] Registro finalizado:",
      {
        candidatos: candidatos.size,
        registrados,
        duplicados,
        omitidos,
        errores: errores.length,
      }
    );

    return NextResponse.json({
      success: errores.length === 0,
      modo: "registro_seguro_sin_whatsapp",
      candidatos: candidatos.size,
      registrados,
      duplicados,
      omitidos,
      resultadosRegistro,
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
