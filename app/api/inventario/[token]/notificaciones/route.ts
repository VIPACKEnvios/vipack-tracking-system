
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/*
 * =========================================================
 * CONFIGURACIÓN DE SUPABASE
 * =========================================================
 *
 * El cliente se crea únicamente cuando se necesita.
 * Esto evita inicializar Supabase durante el build.
 */

function obtenerSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase para notificaciones."
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type InventarioResponse = {
  success: boolean;
  cliente?: {
    id_cliente: number;
    nombre: string;
    carpeta: string;
  };
  error?: string;
};

/*
 * =========================================================
 * VALIDAR CLIENTE POR TOKEN
 * =========================================================
 */

async function obtenerClientePorToken(
  request: NextRequest,
  token: string
) {
  try {
    const urlInventario = new URL(
      `/api/inventario/${encodeURIComponent(token)}`,
      request.nextUrl.origin
    );

    const response = await fetch(urlInventario, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const resultado =
      (await response.json()) as InventarioResponse;

    if (
      !resultado.success ||
      !resultado.cliente?.id_cliente
    ) {
      return null;
    }

    return resultado.cliente;
  } catch (error) {
    console.error(
      "Error validando token del cliente:",
      error
    );

    return null;
  }
}

/*
 * =========================================================
 * GET
 * OBTENER NOTIFICACIONES DEL CLIENTE
 * =========================================================
 */

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      token: string;
    }>;
  }
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

    const cliente = await obtenerClientePorToken(
      request,
      token
    );

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Inventario no válido o cliente no encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    const supabaseAdmin = obtenerSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("notificaciones_clientes")
      .select(
        `
          id,
          cliente_id,
          titulo,
          mensaje,
          tipo,
          url,
          leida,
          created_at
        `
      )
      .eq("cliente_id", cliente.id_cliente)
      .order("created_at", {
        ascending: false,
      })
      .limit(30);

    if (error) {
      console.error(
        "Error obteniendo notificaciones:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudieron cargar las notificaciones.",
        },
        {
          status: 500,
        }
      );
    }

    const notificaciones = data || [];

    const noLeidas = notificaciones.filter(
      (notificacion) => !notificacion.leida
    ).length;

    return NextResponse.json({
      success: true,
      cliente: {
        id_cliente: cliente.id_cliente,
        nombre: cliente.nombre,
      },
      total: notificaciones.length,
      no_leidas: noLeidas,
      notificaciones,
    });
  } catch (error) {
    console.error(
      "Error en GET notificaciones:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Error interno al consultar las notificaciones.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * PATCH
 * MARCAR NOTIFICACIONES COMO LEÍDAS
 * =========================================================
 */

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      token: string;
    }>;
  }
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

    const cliente = await obtenerClientePorToken(
      request,
      token
    );

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error: "Cliente no encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    const body = await request.json();

    /*
     * OPCIÓN 1
     * Marcar todas las notificaciones como leídas
     */

    if (body?.marcarTodas === true) {
      const supabaseAdmin = obtenerSupabaseAdmin();

      const { error } = await supabaseAdmin
        .from("notificaciones_clientes")
        .update({
          leida: true,
        })
        .eq("cliente_id", cliente.id_cliente)
        .eq("leida", false);

      if (error) {
        console.error(
          "Error marcando todas como leídas:",
          error
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "No se pudieron actualizar las notificaciones.",
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        success: true,
        mensaje:
          "Todas las notificaciones fueron marcadas como leídas.",
      });
    }

    /*
     * OPCIÓN 2
     * Marcar una sola notificación como leída
     */

    const id = Number(body?.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ID de notificación no válido.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * SEGURIDAD
     *
     * Se valida tanto el ID de la notificación
     * como el ID del cliente asociado al token.
     */

    const supabaseAdmin = obtenerSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("notificaciones_clientes")
      .update({
        leida: true,
      })
      .eq("id", id)
      .eq("cliente_id", cliente.id_cliente)
      .select(
        `
          id,
          cliente_id,
          titulo,
          mensaje,
          tipo,
          url,
          leida,
          created_at
        `
      )
      .maybeSingle();

    if (error) {
      console.error(
        "Error marcando notificación:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo actualizar la notificación.",
        },
        {
          status: 500,
        }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "Notificación no encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
      notificacion: data,
    });
  } catch (error) {
    console.error(
      "Error en PATCH notificaciones:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Error interno al actualizar la notificación.",
      },
      {
        status: 500,
      }
    );
  }
}
