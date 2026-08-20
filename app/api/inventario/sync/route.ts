import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest) {
  try {
    const cronSecret =
      process.env.CRON_SECRET;

    const authHeader =
      request.headers.get("authorization");

    if (
      !cronSecret ||
      authHeader !== `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: clientes,
      error: clientesError,
    } = await supabaseAdmin
      .from("clientes_inventario")
      .select(
        `
          id_cliente,
          token_inventario,
          activo
        `
      )
      .eq("activo", true)
      .not("token_inventario", "is", null);

    if (clientesError) {
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

    const resultados = [];

    for (const cliente of clientes || []) {
      const token =
        cliente.token_inventario;

      if (!token) {
        continue;
      }

      try {
        const url =
          new URL(
            `/api/inventario/${encodeURIComponent(
              token
            )}`,
            request.nextUrl.origin
          );

        const response =
          await fetch(
            url,
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const result =
          await response.json();

        resultados.push({
          id_cliente:
            cliente.id_cliente,
          success:
            response.ok &&
            result?.success === true,
          status:
            response.status,
        });
      } catch (error) {
        resultados.push({
          id_cliente:
            cliente.id_cliente,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Error desconocido",
        });
      }
    }

    const exitosos =
      resultados.filter(
        (item) =>
          item.success
      ).length;

    return NextResponse.json({
      success: true,
      total_clientes:
        resultados.length,
      exitosos,
      errores:
        resultados.length -
        exitosos,
      resultados,
    });
  } catch (error) {
    console.error(
      "Error sync inventarios:",
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