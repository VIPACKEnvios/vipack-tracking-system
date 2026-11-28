import { NextRequest, NextResponse } from "next/server";
import { autorizarEvidenciaRecolector } from "@/lib/recolector-autorizacion";
import { actualizarEstadoRecolectorEnMatriz } from "@/lib/recolecciones-estado-interno";
import {
  validarOperacionOffline,
  type OperacionOffline,
} from "@/lib/recolecciones-operaciones-offline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexto = {
  params: Promise<{ folio: string }>;
};

const ESTADOS_MOVIL = new Set([
  "En ruta",
  "Recolectada",
  "No lista",
  "Reprogramada",
]);

function datosInvalidos(error: string) {
  return NextResponse.json(
    {
      success: false,
      codigo: "OPERACION_INVALIDA",
      error,
    },
    { status: 400 }
  );
}

export async function PATCH(
  request: NextRequest,
  contexto: Contexto
) {
  try {
    const { folio } = await contexto.params;

    const autorizacion = await autorizarEvidenciaRecolector(
      request.headers.get("authorization") || "",
      folio
    );

    if (!autorizacion.autorizado) {
      return NextResponse.json(
        {
          success: false,
          error: autorizacion.error,
        },
        { status: autorizacion.status }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return datosInvalidos("JSON invalido.");
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return datosInvalidos("Datos invalidos.");
    }

    const datos = body as Record<string, unknown>;
    const campos = Object.keys(datos);

    const tradicional =
      campos.length === 1 &&
      campos[0] === "estado";

    const offline =
      campos.length === 3 &&
      campos.includes("estado") &&
      campos.includes("estadoAnterior") &&
      campos.includes("operationId");

    if (!tradicional && !offline) {
      return datosInvalidos(
        "Campos de actualizacion no permitidos."
      );
    }

    if (typeof datos.estado !== "string") {
      return datosInvalidos("Estado invalido.");
    }

    const estado = datos.estado.trim();

    if (!ESTADOS_MOVIL.has(estado)) {
      return datosInvalidos(
        "Estado no permitido para el recolector."
      );
    }

    if (tradicional) {
      return await actualizarEstadoRecolectorEnMatriz(
        autorizacion.folio,
        estado
      );
    }

    if (
      typeof datos.operationId !== "string" ||
      typeof datos.estadoAnterior !== "string"
    ) {
      return datosInvalidos(
        "Identificador o estado anterior invalido."
      );
    }

    const operacion: OperacionOffline = {
      operationId: datos.operationId,
      recolectorId: autorizacion.recolectorId,
      folio: autorizacion.folio,
      estadoAnterior: datos.estadoAnterior,
      estado,
    };

    if (!validarOperacionOffline(operacion)) {
      return datosInvalidos(
        "Operacion offline invalida."
      );
    }

    return await actualizarEstadoRecolectorEnMatriz(
      autorizacion.folio,
      estado,
      operacion
    );

  } catch (error) {
    console.error(
      "Error actualizando estado del recolector:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo procesar la actualizacion.",
      },
      { status: 500 }
    );
  }
}
