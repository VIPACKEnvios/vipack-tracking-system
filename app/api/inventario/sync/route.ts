import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 30;

/*
 * cron-job.org ejecutará este endpoint
 * cada 15 minutos.
 */
const INTERVALO_MINUTOS = 15;

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (
  !supabaseUrl ||
  !supabaseServiceRoleKey
) {
  throw new Error(
    "Faltan variables de Supabase."
  );
}

const supabaseAdmin =
  createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

type ClienteInventario = {
  id_cliente: number;
  token_inventario: string | null;
  onedrive_folder_id: string | null;
  activo: boolean;
};

type ResultadoCliente = {
  id_cliente: number;
  success: boolean;
  status?: number;
  error?: string;
};

function obtenerIndiceLote(
  totalLotes: number
) {
  if (totalLotes <= 1) {
    return 0;
  }

  const intervaloMs =
    INTERVALO_MINUTOS *
    60 *
    1000;

  const numeroIntervalo =
    Math.floor(
      Date.now() /
        intervaloMs
    );

  return (
    numeroIntervalo %
    totalLotes
  );
}

async function sincronizarCliente(
  request: NextRequest,
  cliente: ClienteInventario
): Promise<ResultadoCliente> {
  const token =
    cliente.token_inventario;

  if (!token) {
    return {
      id_cliente:
        cliente.id_cliente,
      success: false,
      error:
        "Cliente sin token.",
    };
  }

  try {
    const url =
      new URL(
        `/api/inventario/${encodeURIComponent(
          token
        )}`,
        request.nextUrl.origin
      );

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        20000
      );

    try {
      const response =
        await fetch(
          url,
          {
            method: "GET",

            cache:
              "no-store",

            signal:
              controller.signal,

            headers: {
              "User-Agent":
                "VIPACK-Inventory-Sync/1.0",
            },
          }
        );

      let result: any =
        null;

      try {
        result =
          await response.json();
      } catch {
        result =
          null;
      }

      return {
        id_cliente:
          cliente.id_cliente,

        success:
          response.ok &&
          result?.success ===
            true,

        status:
          response.status,

        ...(
          !response.ok ||
          result?.success !==
            true
            ? {
                error:
                  result?.error ||
                  "La sincronización no respondió correctamente.",
              }
            : {}
        ),
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.name ===
        "AbortError"
    ) {
      return {
        id_cliente:
          cliente.id_cliente,

        success: false,

        error:
          "Tiempo de espera agotado al sincronizar este cliente.",
      };
    }

    return {
      id_cliente:
        cliente.id_cliente,

      success: false,

      error:
        error instanceof Error
          ? error.message
          : "Error desconocido.",
    };
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    /*
     * =========================
     * 1. SEGURIDAD DEL CRON
     * =========================
     */

    const cronSecret =
      process.env.CRON_SECRET;

    const authHeader =
      request.headers.get(
        "authorization"
      );

    if (!cronSecret) {
      console.error(
        "CRON_SECRET no está configurado."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "CRON_SECRET no está configurado.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      authHeader !==
      `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * =========================
     * 2. CONSULTAR SOLO
     * CLIENTES CON INVENTARIO
     * =========================
     */

    const {
      data,
      error:
        clientesError,
    } = await supabaseAdmin
      .from(
        "clientes_inventario"
      )
      .select(
        `
          id_cliente,
          token_inventario,
          onedrive_folder_id,
          activo
        `
      )
      .eq(
        "activo",
        true
      )
      .not(
        "token_inventario",
        "is",
        null
      )
      .not(
        "onedrive_folder_id",
        "is",
        null
      )
      .neq(
        "onedrive_folder_id",
        ""
      )
      .order(
        "id_cliente",
        {
          ascending: true,
        }
      );

    if (clientesError) {
      console.error(
        "Error consultando clientes:",
        clientesError
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "No se pudieron consultar los clientes.",

          detalle:
            clientesError.message,
        },
        {
          status: 500,
        }
      );
    }

    const clientes =
      (
        data ||
        []
      ) as ClienteInventario[];

    if (
      clientes.length === 0
    ) {
      return NextResponse.json({
        success: true,

        mensaje:
          "No hay clientes activos con carpeta de OneDrive para sincronizar.",

        total_clientes: 0,

        procesados: 0,

        resultados: [],
      });
    }

    /*
     * =========================
     * 3. DIVIDIR EN LOTES
     * =========================
     */

    const totalLotes =
      Math.ceil(
        clientes.length /
          BATCH_SIZE
      );

    const indiceLote =
      obtenerIndiceLote(
        totalLotes
      );

    const inicio =
      indiceLote *
      BATCH_SIZE;

    const fin =
      inicio +
      BATCH_SIZE;

    const clientesLote =
      clientes.slice(
        inicio,
        fin
      );

    /*
     * =========================
     * 4. SINCRONIZAR EN PARALELO
     * =========================
     */

    const resultados =
      await Promise.all(
        clientesLote.map(
          (cliente) =>
            sincronizarCliente(
              request,
              cliente
            )
        )
      );

    /*
     * =========================
     * 5. RESULTADOS
     * =========================
     */

    const exitosos =
      resultados.filter(
        (resultado) =>
          resultado.success
      ).length;

    const errores =
      resultados.length -
      exitosos;

    return NextResponse.json({
      success: true,

      total_clientes:
        clientes.length,

      tamaño_lote:
        BATCH_SIZE,

      total_lotes:
        totalLotes,

      lote_actual:
        indiceLote + 1,

      procesados:
        resultados.length,

      exitosos,

      errores,

      rango: {
        desde:
          inicio + 1,

        hasta:
          Math.min(
            fin,
            clientes.length
          ),
      },

      resultados,
    });
  } catch (error) {
    console.error(
      "Error general sync inventarios:",
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
      {
        status: 500,
      }
    );
  }
}