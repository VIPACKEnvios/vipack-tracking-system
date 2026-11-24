import { NextRequest, NextResponse } from "next/server";
import { autorizarEvidenciaRecolector } from "@/lib/recolector-autorizacion";
import { actualizarEstadoRecolectorEnMatriz } from "@/lib/recolecciones-estado-interno";

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

    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { success: false, error: "Datos invalidos." },
        { status: 400 }
      );
    }

    const datos = body as Record<string, unknown>;
    const campos = Object.keys(datos);

    if (
      campos.length !== 1 ||
      campos[0] !== "estado" ||
      typeof datos.estado !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Solo se permite modificar el estado.",
        },
        { status: 400 }
      );
    }

    const estado = datos.estado.trim();

    if (!ESTADOS_MOVIL.has(estado)) {
      return NextResponse.json(
        {
          success: false,
          error: "Estado no permitido para el recolector.",
        },
        { status: 400 }
      );
    }

    return actualizarEstadoRecolectorEnMatriz(
      autorizacion.folio,
      estado
    );
  } catch (error) {
    console.error("Error actualizando estado del recolector:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo procesar la actualizacion.",
      },
      { status: 500 }
    );
  }
}