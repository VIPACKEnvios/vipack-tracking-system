
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verificarAccesoHotmail } from "@/lib/vipack-cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GuiaPaquetexpress = {
  id: number;
  guia: string;
  tipo_evento: string;
  fecha_evento: string;
  estado: string;
  envio_id: number | null;
  destinatario_nombre: string | null;
};

type EventoHistorial = {
  id: number;
  guia: string;
  tipo_evento: string;
  fecha_evento: string;
};

export async function GET(req: NextRequest) {
  try {
    const autorizado = await verificarAccesoHotmail(req);

    if (!autorizado) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado",
        },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        {
          success: false,
          error: "Configuración incompleta",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Consultar guías pendientes y asignadas.
    const { data: guias, error: errorGuias } = await supabase
      .from("guias_paquexpress_pendientes")
      .select(
        "id,guia,tipo_evento,fecha_evento,estado,envio_id,destinatario_nombre"
      )
      .in("estado", ["pendiente", "asignado"])
      .order("fecha_evento", { ascending: false })
      .limit(1000);

    if (errorGuias) {
      throw new Error(errorGuias.message);
    }

    const listaGuias: GuiaPaquetexpress[] = guias ?? [];

    const numeros = [
      ...new Set(listaGuias.map((item) => item.guia)),
    ];

    let eventos: EventoHistorial[] = [];

    // Consultar movimientos únicamente de las guías obtenidas.
    // Se consultan por lotes para evitar listas IN demasiado grandes.
    const tamanoLote = 100;

    for (let i = 0; i < numeros.length; i += tamanoLote) {
      const lote = numeros.slice(i, i + tamanoLote);

      let desde = 0;
      const tamanoPagina = 1000;

      while (true) {
        const { data, error } = await supabase
          .from("eventos_paquexpress_historial")
          .select("id,guia,tipo_evento,fecha_evento")
          .in("guia", lote)
          .order("fecha_evento", { ascending: true })
          .order("id", { ascending: true })
          .range(desde, desde + tamanoPagina - 1);

        if (error) {
          throw new Error(error.message);
        }

        const pagina: EventoHistorial[] = data ?? [];

        eventos.push(...pagina);

        if (pagina.length < tamanoPagina) {
          break;
        }

        desde += tamanoPagina;
      }
    }

    // Obtener el último movimiento real de cada guía.
    const ultimoEventoPorGuia = new Map<string, EventoHistorial>();

    for (const evento of eventos) {
      const anterior = ultimoEventoPorGuia.get(evento.guia);

      if (
        !anterior ||
        new Date(evento.fecha_evento).getTime() >
          new Date(anterior.fecha_evento).getTime() ||
        (
          new Date(evento.fecha_evento).getTime() ===
            new Date(anterior.fecha_evento).getTime() &&
          evento.id > anterior.id
        )
      ) {
        ultimoEventoPorGuia.set(evento.guia, evento);
      }
    }

    // Actualizar el estado y fecha mostrados en cada tarjeta.
    const guiasActualizadas = listaGuias.map((guia) => {
      const ultimoEvento = ultimoEventoPorGuia.get(guia.guia);

      if (!ultimoEvento) return guia;

      return {
        ...guia,
        tipo_evento: ultimoEvento.tipo_evento,
        fecha_evento: ultimoEvento.fecha_evento,
      };
    });
    const pendientes = listaGuias.filter(
      (guia) => guia.estado === "pendiente"
    ).length;

    const asignadas = listaGuias.filter(
      (guia) => guia.estado === "asignado"
    ).length;

    return NextResponse.json(
      {
        success: true,
        guias: guiasActualizadas,
        eventos,
        total: listaGuias.length,
        pendientes,
        asignadas,
        totalEventos: eventos.length,
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
    console.error(
      "Error consultando seguimiento Paquetexpress:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo consultar el seguimiento de Paquetexpress.",
      },
      { status: 500 }
    );
  }
}
