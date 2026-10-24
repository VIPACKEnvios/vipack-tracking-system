
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verificarAccesoHotmail } from "@/lib/vipack-cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const autorizado = await verificarAccesoHotmail(req);

    if (!autorizado) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { success: false, error: "Configuración incompleta" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: guias, error: errorGuias } = await supabase
      .from("guias_paquexpress_pendientes")
      .select(
        "id,guia,tipo_evento,fecha_evento,estado,envio_id"
      )
      .eq("estado", "pendiente")
      .order("fecha_evento", { ascending: false })
      .limit(1000);

    if (errorGuias) {
      throw new Error(errorGuias.message);
    }

    const numeros = (guias ?? []).map((item) => item.guia);

    let eventos: {
      id: number;
      guia: string;
      tipo_evento: string;
      fecha_evento: string;
    }[] = [];

    if (numeros.length > 0) {
      const { data, error } = await supabase
        .from("eventos_paquexpress_historial")
        .select("id,guia,tipo_evento,fecha_evento")
        .in("guia", numeros)
        .order("fecha_evento", { ascending: true })
        .limit(5000);

      if (error) {
        throw new Error(error.message);
      }

      eventos = data ?? [];
    }

    return NextResponse.json(
      {
        success: true,
        guias: guias ?? [],
        eventos,
        total: guias?.length ?? 0,
        modificaEnvios: false,
        enviaWhatsapp: false,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Error consultando guías pendientes:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudieron consultar las guías pendientes.",
      },
      { status: 500 }
    );
  }
}
