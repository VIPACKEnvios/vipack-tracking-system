
import { NextRequest, NextResponse } from "next/server";

import { verificarSesionAdmin } from "@/lib/vipack-auth";
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
  if (!verificarSesionAdmin(request)) {
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

        const tipoEvento = evento.evento;
        const clave = `${evento.envio_id}:${tipoEvento}`;

        if (!candidatos.has(clave)) {
          candidatos.set(clave, {
            envio_id: evento.envio_id,
            guia: evento.guia,
            tipo_evento: tipoEvento,
            cuenta_origen: cuenta.cuenta,
            fecha_evento: evento.fecha as string,
          });
        }
      }
    }

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
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "No se pudo completar el registro de eventos.",
        enviaWhatsapp: false,
      },
      { status: 500 }
    );
  }
}
