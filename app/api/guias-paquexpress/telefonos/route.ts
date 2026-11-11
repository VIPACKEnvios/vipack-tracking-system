import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verificarSesionAdmin } from "@/lib/vipack-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clienteSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Configuración de Supabase incompleta");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizarNombre(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizarTelefono(valor: unknown) {
  let numero = String(valor ?? "").replace(/\D/g, "");

  if (numero.length === 13 && numero.startsWith("521")) {
    numero = numero.slice(3);
  } else if (numero.length === 12 && numero.startsWith("52")) {
    numero = numero.slice(2);
  }

  return numero.length === 10 ? `521${numero}` : null;
}

function noAutorizado() {
  return NextResponse.json(
    { success: false, error: "No autorizado" },
    { status: 401 }
  );
}

const fuentes = [
  {
    tabla: "clientes",
    nombre: "cliente",
    telefono: "telefono_whatsapp",
  },
  {
    tabla: "envios",
    nombre: "cliente",
    telefono: "telefono_whatsapp",
  },
  {
    tabla: "clientes_inventario",
    nombre: "nombre",
    telefono: "telefono_whatsapp",
  },
  {
    tabla: "solicitudes_clientes",
    nombre: "nombre",
    telefono: "telefono",
  },
  {
    tabla: "cobros",
    nombre: "cliente",
    telefono: "telefono",
  },
] as const;

export async function GET(request: NextRequest) {
  if (!verificarSesionAdmin(request)) return noAutorizado();

  try {
    const guia = request.nextUrl.searchParams.get("guia")?.trim();

    if (!guia || !/^\d{12}$/.test(guia)) {
      return NextResponse.json(
        { success: false, error: "Guía inválida" },
        { status: 400 }
      );
    }

    const supabase = clienteSupabase();

    const { data: guiaDatos, error: errorGuia } = await supabase
      .from("guias_paquexpress_pendientes")
      .select("id,guia,destinatario_nombre,telefono_whatsapp")
      .eq("guia", guia)
      .limit(2);

    if (errorGuia) throw errorGuia;

    if (!guiaDatos || guiaDatos.length !== 1) {
      return NextResponse.json(
        { success: false, error: "Guía no encontrada o duplicada" },
        { status: 404 }
      );
    }

    const registro = guiaDatos[0];
    const nombre = registro.destinatario_nombre ?? "";
    const clave = normalizarNombre(nombre);

    if (!clave) {
      return NextResponse.json({
        success: true,
        nombre,
        telefono_guardado: registro.telefono_whatsapp,
        opciones: [],
      });
    }

    const resultados = await Promise.all(
      fuentes.map(async (fuente) => {
        const { data, error } = await supabase
          .from(fuente.tabla)
          .select(`${fuente.nombre},${fuente.telefono}`)
          .ilike(fuente.nombre, `%${nombre.trim().split(/\s+/)[0]}%`)
          .limit(1000);

        if (error) throw error;

        return {
          fuente: fuente.tabla,
          registros: (data ?? []) as unknown as Record<string, unknown>[],
          campoNombre: fuente.nombre,
          campoTelefono: fuente.telefono,
        };
      })
    );

    const coincidencias = new Map<
      string,
      { telefono: string; fuentes: string[] }
    >();

    for (const resultado of resultados) {
      for (const fila of resultado.registros) {
        if (
          normalizarNombre(fila[resultado.campoNombre]) !== clave
        ) {
          continue;
        }

        const telefono = normalizarTelefono(
          fila[resultado.campoTelefono]
        );

        if (!telefono) continue;

        const existente = coincidencias.get(telefono);

        if (existente) {
          if (!existente.fuentes.includes(resultado.fuente)) {
            existente.fuentes.push(resultado.fuente);
          }
        } else {
          coincidencias.set(telefono, {
            telefono,
            fuentes: [resultado.fuente],
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      nombre,
      telefono_guardado: registro.telefono_whatsapp,
      opciones: [...coincidencias.values()],
    });
  } catch (error) {
    console.error("Error buscando teléfonos:", error);

    return NextResponse.json(
      { success: false, error: "No se pudieron buscar teléfonos" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!verificarSesionAdmin(request)) return noAutorizado();

  try {
    const body = await request.json();
    const guia = String(body.guia ?? "").trim();
    const telefono = normalizarTelefono(body.telefono);

    if (!/^\d{12}$/.test(guia) || !telefono) {
      return NextResponse.json(
        { success: false, error: "Guía o teléfono inválido" },
        { status: 400 }
      );
    }

    const supabase = clienteSupabase();

    const { data: existentes, error: errorBusqueda } = await supabase
      .from("guias_paquexpress_pendientes")
      .select("id")
      .eq("guia", guia)
      .limit(2);

    if (errorBusqueda) throw errorBusqueda;

    if (!existentes || existentes.length !== 1) {
      return NextResponse.json(
        { success: false, error: "Guía no encontrada o duplicada" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("guias_paquexpress_pendientes")
      .update({ telefono_whatsapp: telefono })
      .eq("id", existentes[0].id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      telefono,
      mensaje: "Teléfono guardado correctamente",
    });
  } catch (error) {
    console.error("Error guardando teléfono:", error);

    return NextResponse.json(
      { success: false, error: "No se pudo guardar el teléfono" },
      { status: 500 }
    );
  }
}
