import {
  NextResponse,
} from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContextoRuta = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  contexto: ContextoRuta
) {
  try {
    const { id } = await contexto.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta el identificador del bazar.",
        },
        { status: 400 }
      );
    }

    const {
      data: bazar,
      error: errorBazar,
    } = await supabaseAdmin
      .from("bazares")
      .select(`
        id,
        folio,
        nombre_bazar,
        estado,
        aprobado_por,
        firma_administrador,
        fecha_aprobacion,
        ultimo_movimiento_por
      `)
      .eq("id", id)
      .single();

    if (errorBazar || !bazar) {
      console.error(
        "Error consultando el bazar:",
        errorBazar
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se encontró el bazar.",
        },
        { status: 404 }
      );
    }

    const {
      data: historial,
      error: errorHistorial,
    } = await supabaseAdmin
      .from("bazares_historial")
      .select(`
        id,
        bazar_id,
        folio,
        nombre_bazar,
        estado_anterior,
        estado_nuevo,
        observaciones,
        accion,
        administrador_nombre,
        administrador_firma,
        fecha_movimiento
      `)
      .eq("bazar_id", id)
      .order("fecha_movimiento", {
        ascending: false,
      });

    if (errorHistorial) {
      console.error(
        "Error consultando el historial:",
        errorHistorial
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No fue posible consultar la bitácora.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bazar,
      historial: historial || [],
      total: historial?.length || 0,
    });
  } catch (error) {
    console.error(
      "Error en la API de historial:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar el historial.",
      },
      { status: 500 }
    );
  }
}