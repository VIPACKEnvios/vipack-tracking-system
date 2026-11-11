import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

type PushBody = {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
};

function obtenerSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan variables de Supabase.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function obtenerClientePorToken(token: string) {
  const { data, error } = await obtenerSupabaseAdmin()
    .from("clientes_inventario")
    .select("id_cliente, nombre, activo")
    .eq("token_inventario", token)
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    console.error("Error consultando cliente push:", error);
    throw new Error("No se pudo verificar el cliente.");
  }
  return data;
}

// GET: verifica que este dispositivo esté activado para este cliente.
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ success: false, error: "Token no válido." }, { status: 400 });
    }

    const cliente = await obtenerClientePorToken(token);
    if (!cliente?.id_cliente) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado o acceso inactivo." },
        { status: 404 }
      );
    }

    const endpoint = request.nextUrl.searchParams.get("endpoint");
    if (!endpoint) {
      return NextResponse.json({ success: true, activado: false });
    }
    if (endpoint.length > 4096) {
      return NextResponse.json({ success: false, error: "Endpoint no válido." }, { status: 400 });
    }

    const { data, error } = await obtenerSupabaseAdmin()
      .from("push_subscriptions")
      .select("id, activo")
      .eq("cliente_id", cliente.id_cliente)
      .eq("endpoint", endpoint)
      .maybeSingle();

    if (error) {
      console.error("Error verificando suscripción:", error);
      return NextResponse.json(
        { success: false, activado: false, error: "No se pudo comprobar la suscripción." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      activado: data?.activo === true,
      cliente_id: cliente.id_cliente,
    });
  } catch (error) {
    console.error("Error GET push subscribe:", error);
    return NextResponse.json(
      { success: false, activado: false, error: "Error interno verificando las notificaciones." },
      { status: 500 }
    );
  }
}

// POST: registra o actualiza la suscripción del cliente sin duplicados.
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ success: false, error: "Token no válido." }, { status: 400 });
    }

    const cliente = await obtenerClientePorToken(token);
    if (!cliente?.id_cliente) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado o acceso inactivo." },
        { status: 404 }
      );
    }

    let body: PushBody;
    try {
      body = (await request.json()) as PushBody;
    } catch {
      return NextResponse.json({ success: false, error: "JSON no válido." }, { status: 400 });
    }

    const endpoint = body?.subscription?.endpoint;
    const p256dh = body?.subscription?.keys?.p256dh;
    const auth = body?.subscription?.keys?.auth;

    if (
      typeof endpoint !== "string" ||
      typeof p256dh !== "string" ||
      typeof auth !== "string" ||
      !endpoint || !p256dh || !auth ||
      endpoint.length > 4096 || p256dh.length > 1024 || auth.length > 1024
    ) {
      return NextResponse.json(
        { success: false, error: "La suscripción push no es válida." },
        { status: 400 }
      );
    }

    try {
      const url = new URL(endpoint);
      if (url.protocol !== "https:" || !url.hostname) throw new Error("Endpoint no permitido");
    } catch {
      return NextResponse.json(
        { success: false, error: "Endpoint push no válido." },
        { status: 400 }
      );
    }

    const { error: guardarError } = await obtenerSupabaseAdmin()
      .from("push_subscriptions")
      .upsert(
        {
          cliente_id: Number(cliente.id_cliente),
          endpoint,
          p256dh,
          auth,
          activo: true,
          user_agent: request.headers.get("user-agent"),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "cliente_id,endpoint" }
      );

    if (guardarError) {
      console.error("Error guardando suscripción push:", guardarError);
      return NextResponse.json(
        { success: false, error: "No se pudo registrar el dispositivo." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      activado: true,
      cliente: { id_cliente: cliente.id_cliente, nombre: cliente.nombre },
    });
  } catch (error) {
    console.error("Error POST push subscribe:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al registrar las notificaciones." },
      { status: 500 }
    );
  }
}
