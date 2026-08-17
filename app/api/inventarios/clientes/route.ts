import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faltan variables de conexión de Supabase.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: clientes,
      error,
    } = await supabase
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
      )
      .eq("activo", true)
      .order("id_cliente", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Error consultando clientes:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudieron consultar los clientes.",
          detalle:
            error.message,
        },
        { status: 500 }
      );
    }

    const clientesFormateados =
      (clientes || []).map(
        (cliente) => ({
          ...cliente,
          total_archivos: null,
        })
      );

    return NextResponse.json({
      success: true,
      total:
        clientesFormateados.length,
      clientes:
        clientesFormateados,
    });
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