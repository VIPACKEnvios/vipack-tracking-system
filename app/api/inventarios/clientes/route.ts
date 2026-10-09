
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function obtenerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Faltan variables de conexión de Supabase."
    );
  }

  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = obtenerSupabase();

    const estado = request.nextUrl.searchParams.get("estado");

    // Por defecto conserva el comportamiento anterior.
    // estado=activos   -> solamente activos
    // estado=inactivos -> solamente inactivos
    // estado=todos     -> todos los clientes
    const filtro =
      estado === "inactivos" || estado === "todos"
        ? estado
        : "activos";

    let consulta = supabase
      .from("clientes_inventario")
      .select(
        `
        id,
        id_cliente,
        nombre,
        carpeta_cliente,
        onedrive_folder_id,
        token_inventario,
        activo
        `
      );

    if (filtro === "activos") {
      consulta = consulta.eq("activo", true);
    }

    if (filtro === "inactivos") {
      consulta = consulta.eq("activo", false);
    }

    const { data: clientes, error } = await consulta.order(
      "id_cliente",
      { ascending: true }
    );

    if (error) {
      console.error(
        "Error consultando clientes:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: "No se pudieron consultar los clientes.",
          detalle: error.message,
        },
        { status: 500 }
      );
    }

    const clientesFormateados = (clientes || []).map(
      (cliente) => ({
        ...cliente,
        total_archivos: null,
      })
    );

    const totalActivos = clientesFormateados.filter(
      (cliente) => cliente.activo === true
    ).length;

    const totalInactivos = clientesFormateados.filter(
      (cliente) => cliente.activo === false
    ).length;

    return NextResponse.json(
      {
        success: true,
        estado: filtro,
        total: clientesFormateados.length,
        total_activos: totalActivos,
        total_inactivos: totalInactivos,
        clientes: clientesFormateados,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error(
      "Error API inventarios/clientes:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido.",
      },
      { status: 500 }
    );
  }
}
