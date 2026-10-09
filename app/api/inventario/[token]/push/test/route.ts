import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Faltan variables de Supabase.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function GET(request: NextRequest) {
  try {
    // Solo una llamada autorizada con CRON_SECRET puede ejecutar la prueba.
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "No autorizado." },
        { status: 401 }
      );
    }

    const clienteParam = request.nextUrl.searchParams.get("cliente");
    const clienteId = Number(clienteParam);

    if (!clienteParam || !Number.isInteger(clienteId) || clienteId <= 0) {
      return NextResponse.json(
        { success: false, error: "Cliente no válido." },
        { status: 400 }
      );
    }

    // IMPORTANTE: una suscripción activa no significa que el cliente
    // siga activo. Validamos el estado del cliente ANTES de enviar push.
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes_inventario")
      .select("id_cliente, activo")
      .eq("id_cliente", clienteId)
      .maybeSingle();

    if (clienteError) {
      console.error("Error verificando estado del cliente:", clienteError);
      return NextResponse.json(
        { success: false, error: "No se pudo verificar el estado del cliente." },
        { status: 500 }
      );
    }

    if (!cliente || cliente.activo !== true) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado o dado de baja." },
        { status: 404 }
      );
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
      return NextResponse.json(
        {
          success: false,
          error: "Faltan variables VAPID.",
          variables: {
            publicKey: Boolean(publicKey),
            privateKey: Boolean(privateKey),
            subject: Boolean(subject),
          },
        },
        { status: 500 }
      );
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const { data: suscripciones, error: suscripcionesError } = await supabase
      .from("push_subscriptions")
      .select("id, cliente_id, endpoint, p256dh, auth, activo")
      .eq("cliente_id", clienteId)
      .eq("activo", true);

    if (suscripcionesError) {
      return NextResponse.json(
        {
          success: false,
          error: "No se pudieron consultar las suscripciones.",
          detalle: suscripcionesError.message,
        },
        { status: 500 }
      );
    }

    if (!suscripciones || suscripciones.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Este cliente no tiene dispositivos push activos.",
          cliente: clienteId,
        },
        { status: 404 }
      );
    }

    const payload = JSON.stringify({
      title: "VIPACK Envíos",
      body: "🔔 Prueba de notificación VIPACK. Si ves este mensaje, las notificaciones funcionan correctamente.",
      url: "/",
      tag: `vipack-prueba-${Date.now()}`,
    });

    const resultados: Array<{
      id: number | string;
      success: boolean;
      statusCode: number | null;
      headers?: unknown;
      message?: string;
      body?: unknown;
    }> = [];

    for (const suscripcion of suscripciones) {
      try {
        const response = await webpush.sendNotification(
          {
            endpoint: suscripcion.endpoint,
            keys: {
              p256dh: suscripcion.p256dh,
              auth: suscripcion.auth,
            },
          },
          payload,
          { TTL: 300 }
        );

        resultados.push({
          id: suscripcion.id,
          success: true,
          statusCode: response.statusCode,
          headers: response.headers,
        });
      } catch (error: unknown) {
        const detalle = error as {
          statusCode?: number;
          message?: string;
          body?: unknown;
          headers?: unknown;
        };

        resultados.push({
          id: suscripcion.id,
          success: false,
          statusCode: detalle?.statusCode ?? null,
          message: detalle?.message || "Error desconocido",
          body: detalle?.body ?? null,
          headers: detalle?.headers ?? null,
        });
      }
    }

    const exitosos = resultados.filter((resultado) => resultado.success).length;

    return NextResponse.json({
      success: exitosos > 0,
      cliente: clienteId,
      dispositivos: suscripciones.length,
      exitosos,
      errores: resultados.length - exitosos,
      resultados,
    });
  } catch (error: unknown) {
    console.error("Error prueba push:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido.",
      },
      { status: 500 }
    );
  }
}
