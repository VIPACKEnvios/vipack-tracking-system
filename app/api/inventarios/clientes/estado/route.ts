
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Faltan variables de Supabase.",
        },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);

    const id = body?.id;
    const activo = body?.activo;

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof activo !== "boolean"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "ID o estado inválido.",
        },
        { status: 400 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: cliente, error: buscarError } =
      await supabase
        .from("clientes_inventario")
        .select("id, id_cliente, nombre, activo")
        .eq("id", id)
        .maybeSingle();

    if (buscarError) {
      return NextResponse.json(
        {
          success: false,
          error: "No se pudo consultar la clienta.",
        },
        { status: 500 }
      );
    }

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error: "Clienta no encontrada.",
        },
        { status: 404 }
      );
    }

    const { data: actualizado, error: actualizarError } =
      await supabase
        .from("clientes_inventario")
        .update({ activo })
        .eq("id", id)
        .select("id, id_cliente, nombre, activo")
        .single();

    if (actualizarError) {
      console.error(
        "Error actualizando estado:",
        actualizarError
      );

      return NextResponse.json(
        {
          success: false,
          error: "No se pudo cambiar el estado.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        mensaje: activo
          ? "Clienta reactivada correctamente."
          : "Clienta dada de baja correctamente.",
        cliente: actualizado,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Error cambiando estado:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor.",
      },
      { status: 500 }
    );
  }
}
