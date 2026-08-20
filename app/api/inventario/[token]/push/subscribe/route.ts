import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

type PushBody = {
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function obtenerClientePorToken(token: string) {
  const { data, error } = await supabaseAdmin
    .from("clientes_inventario")
    .select("id_cliente, nombre, activo")
    .eq("token_inventario", token)
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    console.error(
      "Error consultando cliente para push:",
      error
    );

    return null;
  }

  return data;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Token no válido.",
        },
        {
          status: 400,
        }
      );
    }

    const cliente =
      await obtenerClientePorToken(token);

    if (!cliente?.id_cliente) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cliente no encontrado o acceso inactivo.",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      (await request.json()) as PushBody;

    const endpoint =
      body?.subscription?.endpoint;

    const p256dh =
      body?.subscription?.keys?.p256dh;

    const auth =
      body?.subscription?.keys?.auth;

    if (
      !endpoint ||
      !p256dh ||
      !auth
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La suscripción push está incompleta.",
        },
        {
          status: 400,
        }
      );
    }

    const userAgent =
      request.headers.get("user-agent");

    const ahora =
      new Date().toISOString();

    const { data, error } =
      await supabaseAdmin
        .from("push_subscriptions")
        .upsert(
          {
            cliente_id:
              Number(cliente.id_cliente),

            endpoint,

            p256dh,

            auth,

            user_agent:
              userAgent,

            activo: true,

            updated_at:
              ahora,
          },
          {
            onConflict:
              "endpoint",
          }
        )
        .select(
          `
            id,
            cliente_id,
            activo,
            created_at,
            updated_at
          `
        )
        .maybeSingle();

    if (error) {
      console.error(
        "Error guardando push subscription:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo guardar la suscripción.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      cliente: {
        id_cliente:
          cliente.id_cliente,
        nombre:
          cliente.nombre,
      },
      subscription:
        data,
    });
  } catch (error) {
    console.error(
      "Error en POST push subscribe:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Error interno al registrar las notificaciones.",
      },
      {
        status: 500,
      }
    );
  }
}