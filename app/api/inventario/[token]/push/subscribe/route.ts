import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@supabase/supabase-js";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

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

const supabaseAdmin =
  createClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,

    process.env
      .SUPABASE_SERVICE_ROLE_KEY!,

    {
      auth: {
        autoRefreshToken:
          false,

        persistSession:
          false,
      },
    }
  );

async function obtenerClientePorToken(
  token: string
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "clientes_inventario"
      )
      .select(
        `
          id_cliente,
          nombre,
          activo
        `
      )
      .eq(
        "token_inventario",
        token
      )
      .eq(
        "activo",
        true
      )
      .maybeSingle();

  if (error) {
    console.error(
      "Error consultando cliente push:",
      error
    );

    return null;
  }

  return data;
}

/*
 * ==========================
 * GET
 *
 * Comprueba si ESTE dispositivo
 * está activado específicamente
 * para ESTE cliente.
 * ==========================
 */

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const {
      token,
    } =
      await context.params;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Token no válido.",
        },
        {
          status: 400,
        }
      );
    }

    const cliente =
      await obtenerClientePorToken(
        token
      );

    if (
      !cliente
        ?.id_cliente
    ) {
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

    const endpoint =
      request.nextUrl.searchParams.get(
        "endpoint"
      );

    if (!endpoint) {
      return NextResponse.json(
        {
          success: true,
          activado: false,
        }
      );
    }

    const {
      data:
        suscripcion,
      error:
        suscripcionError,
    } =
      await supabaseAdmin
        .from(
          "push_subscriptions"
        )
        .select(
          `
            id,
            cliente_id,
            endpoint,
            activo
          `
        )
        .eq(
          "endpoint",
          endpoint
        )
        .maybeSingle();

    if (
      suscripcionError
    ) {
      console.error(
        "Error verificando suscripción:",
        suscripcionError
      );

      return NextResponse.json(
        {
          success: false,
          activado:
            false,
          error:
            "No se pudo comprobar la suscripción.",
        },
        {
          status: 500,
        }
      );
    }

    const activado =
      Boolean(
        suscripcion &&
          suscripcion
            .activo ===
            true &&
          Number(
            suscripcion
              .cliente_id
          ) ===
            Number(
              cliente
                .id_cliente
            )
      );

    return NextResponse.json({
      success: true,

      activado,

      cliente_id:
        cliente.id_cliente,
    });
  } catch (
    error
  ) {
    console.error(
      "Error GET push subscribe:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        activado: false,
        error:
          "Error interno verificando las notificaciones.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * ==========================
 * POST
 *
 * Registra este dispositivo
 * únicamente para el cliente
 * correspondiente al token.
 * ==========================
 */

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const {
      token,
    } =
      await context.params;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Token no válido.",
        },
        {
          status: 400,
        }
      );
    }

    const cliente =
      await obtenerClientePorToken(
        token
      );

    if (
      !cliente
        ?.id_cliente
    ) {
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
      (
        await request.json()
      ) as PushBody;

    const endpoint =
      body
        ?.subscription
        ?.endpoint;

    const p256dh =
      body
        ?.subscription
        ?.keys
        ?.p256dh;

    const auth =
      body
        ?.subscription
        ?.keys
        ?.auth;

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

    /*
     * Primero comprobamos si el
     * endpoint ya existe.
     */
    const {
      data:
        existente,
      error:
        existenteError,
    } =
      await supabaseAdmin
        .from(
          "push_subscriptions"
        )
        .select(
          `
            id,
            cliente_id,
            endpoint,
            activo
          `
        )
        .eq(
          "endpoint",
          endpoint
        )
        .maybeSingle();

    if (
      existenteError
    ) {
      console.error(
        "Error buscando endpoint push:",
        existenteError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo comprobar el dispositivo.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Si este dispositivo ya pertenece
     * al mismo cliente, simplemente
     * actualizamos sus llaves.
     */
    if (
      existente &&
      Number(
        existente
          .cliente_id
      ) ===
        Number(
          cliente
            .id_cliente
        )
    ) {
      const {
        error:
          actualizarError,
      } =
        await supabaseAdmin
          .from(
            "push_subscriptions"
          )
          .update({
            p256dh,
            auth,

            activo:
              true,

            user_agent:
              request.headers.get(
                "user-agent"
              ),

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            existente.id
          );

      if (
        actualizarError
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No se pudo actualizar la suscripción.",
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        success: true,

        activado:
          true,

        cliente: {
          id_cliente:
            cliente
              .id_cliente,

          nombre:
            cliente
              .nombre,
        },
      });
    }

    /*
     * MUY IMPORTANTE:
     *
     * Si el mismo endpoint pertenece
     * a OTRO cliente, NO lo reasignamos
     * silenciosamente.
     */
    if (
      existente &&
      Number(
        existente
          .cliente_id
      ) !==
        Number(
          cliente
            .id_cliente
        )
    ) {
      return NextResponse.json(
        {
          success: false,

          codigo:
            "DISPOSITIVO_OTRO_CLIENTE",

          error:
            "Este dispositivo ya tiene notificaciones activadas para otro inventario VIPACK.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Endpoint completamente nuevo.
     */
    const {
      error:
        insertarError,
    } =
      await supabaseAdmin
        .from(
          "push_subscriptions"
        )
        .insert({
          cliente_id:
            Number(
              cliente
                .id_cliente
            ),

          endpoint,

          p256dh,

          auth,

          user_agent:
            request.headers.get(
              "user-agent"
            ),

          activo:
            true,

          updated_at:
            new Date()
              .toISOString(),
        });

    if (
      insertarError
    ) {
      console.error(
        "Error guardando push:",
        insertarError
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

      activado:
        true,

      cliente: {
        id_cliente:
          cliente
            .id_cliente,

        nombre:
          cliente
            .nombre,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Error POST push subscribe:",
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