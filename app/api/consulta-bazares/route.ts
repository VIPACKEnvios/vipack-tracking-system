import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const busqueda = String(
      searchParams.get("buscar") || ""
    )
      .trim()
      .replace(/[%(),]/g, " ");

    let consulta = supabaseAdmin
      .from("bazares")
      .select(`
        id,
        folio,
        nombre_bazar,
        estado
      `)
      .eq("estado", "activo")
      .order("nombre_bazar", {
        ascending: true,
      });

    if (busqueda) {
      consulta = consulta.ilike(
        "nombre_bazar",
        `%${busqueda}%`
      );
    }

    const { data, error } = await consulta;

    if (error) {
      console.error(
        "Error consultando bazares activos:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No fue posible consultar los bazares registrados.",
        },
        { status: 500 }
      );
    }

    const bazares = data || [];

    return NextResponse.json({
      success: true,
      encontrado: bazares.length > 0,
      bazares,
      total: bazares.length,
      mensaje:
        bazares.length > 0
          ? busqueda
            ? "Se encontraron bazares registrados."
            : "Lista de bazares registrados."
          : busqueda
            ? "No se encontró un bazar activo con ese nombre."
            : "Todavía no hay bazares activos.",
    });
  } catch (error) {
    console.error(
      "Error en la consulta de bazares:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible realizar la consulta.",
      },
      { status: 500 }
    );
  }
}