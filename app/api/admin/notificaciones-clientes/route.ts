import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  try {
    const valor = request.nextUrl.searchParams.get("cliente_id");
    const clienteId = Number(valor);

    if (
      !valor ||
      !Number.isSafeInteger(clienteId) ||
      clienteId <= 0
    ) {
      return NextResponse.json(
        { success: false, error: "ID de cliente no válido." },
        { status: 400 }
      );
    }

    // El proxy.ts valida la sesión antes de permitir esta ruta.
    const supabase = supabaseAdmin();

    const { data: cliente, error: clienteError } = await supabase
      .from("clientes_inventario")
      .select("id_cliente, nombre, activo")
      .eq("id_cliente", clienteId)
      .maybeSingle();

    if (clienteError) {
      throw clienteError;
    }

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado." },
        { status: 404 }
      );
    }

    const { count: registrados, error: registradosError } =
      await supabase
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", clienteId);

    if (registradosError) {
      throw registradosError;
    }

    const { count: activos, error: activosError } =
      await supabase
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", clienteId)
        .eq("activo", true);

    if (activosError) {
      throw activosError;
    }

    const { data: ultima, error: ultimaError } =
      await supabase
        .from("push_entregas")
        .select("confirmado_at")
        .eq("cliente_id", clienteId)
        .eq("estado", "confirmado")
        .not("confirmado_at", "is", null)
        .order("confirmado_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (ultimaError) {
      throw ultimaError;
    }

    return NextResponse.json({
      success: true,
      cliente: {
        id_cliente: cliente.id_cliente,
        nombre: cliente.nombre,
        activo: cliente.activo,
      },
      notificaciones: {
        dispositivos_registrados: registrados ?? 0,
        dispositivos_activos: activos ?? 0,
        ultima_confirmacion: ultima?.confirmado_at ?? null,
      },
    });
  } catch (error) {
    console.error("Error consultando notificaciones:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo consultar el estado de notificaciones.",
      },
      { status: 500 }
    );
  }
}