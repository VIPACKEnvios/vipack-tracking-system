import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Faltan variables de Supabase.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type ClienteResumen = {
  id_cliente: number;
  nombre: string;
  dispositivos_registrados: number;
  dispositivos_activos: number;
  ultima_confirmacion: string | null;
};

async function obtenerTodos(
  supabase: ReturnType<typeof supabaseAdmin>,
  tabla: string,
  columnas: string,
  filtros?: (consulta: any) => any
): Promise<Record<string, any>[]> {
  const resultados: Record<string, any>[] = [];
  const tamano = 500;

  for (let inicio = 0; ; inicio += tamano) {
    let consulta = supabase
      .from(tabla)
      .select(columnas)
      .order("id", { ascending: true })
      .range(inicio, inicio + tamano - 1);

    if (filtros) consulta = filtros(consulta);

    const { data, error } = await consulta;

    if (error) throw error;

    const pagina = (data ?? []) as Record<string, any>[];
    resultados.push(...pagina);

    if (pagina.length < tamano) break;
  }

  return resultados;
}

export async function GET() {
  try {
    // Esta ruta requiere la sesión validada por proxy.ts.
    const supabase = supabaseAdmin();

    const clientes = await obtenerTodos(
      supabase,
      "clientes_inventario",
      "id, id_cliente, nombre",
      (q) => q.eq("activo", true)
    );

    const suscripciones = await obtenerTodos(
      supabase,
      "push_subscriptions",
      "id, cliente_id, activo"
    );

    const entregas = await obtenerTodos(
      supabase,
      "push_entregas",
      "id, cliente_id, estado, confirmado_at",
      (q) => q.eq("estado", "confirmado")
    );

    const mapa = new Map<number, ClienteResumen>();

    for (const cliente of clientes) {
      const id = Number(cliente.id_cliente);

      mapa.set(id, {
        id_cliente: id,
        nombre: String(cliente.nombre ?? ""),
        dispositivos_registrados: 0,
        dispositivos_activos: 0,
        ultima_confirmacion: null,
      });
    }

    for (const suscripcion of suscripciones) {
      const cliente = mapa.get(Number(suscripcion.cliente_id));
      if (!cliente) continue;

      cliente.dispositivos_registrados++;

      if (suscripcion.activo === true) {
        cliente.dispositivos_activos++;
      }
    }

    for (const entrega of entregas) {
      const cliente = mapa.get(Number(entrega.cliente_id));
      if (!cliente || !entrega.confirmado_at) continue;

      const fecha = String(entrega.confirmado_at);

      if (
        !cliente.ultima_confirmacion ||
        fecha > cliente.ultima_confirmacion
      ) {
        cliente.ultima_confirmacion = fecha;
      }
    }

    const lista = Array.from(mapa.values()).sort(
      (a, b) => a.id_cliente - b.id_cliente
    );

    return NextResponse.json({
      success: true,
      resumen: {
        clientes_activos: lista.length,
        clientes_con_dispositivos: lista.filter(
          (c) => c.dispositivos_activos > 0
        ).length,
        clientes_sin_dispositivos: lista.filter(
          (c) => c.dispositivos_activos === 0
        ).length,
        dispositivos_activos: lista.reduce(
          (total, c) => total + c.dispositivos_activos,
          0
        ),
        clientes_confirmados: lista.filter(
          (c) => c.ultima_confirmacion !== null
        ).length,
      },
      clientes: lista,
    });
  } catch (error) {
    console.error("Error en resumen de notificaciones:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo generar el resumen de notificaciones.",
      },
      { status: 500 }
    );
  }
}