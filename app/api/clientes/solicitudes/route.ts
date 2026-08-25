import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ESTADOS_VALIDOS = [
  "pendiente",
  "aprobado",
  "rechazado",
  "archivado",
];

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(
        request.url
      );

    const estado =
      String(
        url.searchParams.get(
          "estado"
        ) ||
          "pendiente"
      ).trim();

    if (
      !ESTADOS_VALIDOS.includes(
        estado
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Estado no válido.",
        },
        { status: 400 }
      );
    }

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const supabaseServiceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configuración de Supabase.",
        },
        { status: 500 }
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken:
              false,
            persistSession:
              false,
          },
        }
      );

    const {
      data,
      error,
    } =
      await supabase
        .from(
          "solicitudes_clientes"
        )
        .select(
          `
          id,
          folio,
          nombre,
          telefono,
          direccion,
          referencia_domicilio,
          estado,
          id_cliente_asignado,
          carpeta_cliente,
          onedrive_folder_id,
          created_at,
          updated_at
          `
        )
        .eq(
          "estado",
          estado
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        );

    if (error) {
      console.error(
        "Error cargando solicitudes clientes:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudieron consultar las solicitudes.",
          detalle:
            error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      solicitudes:
        data || [],
    });
  } catch (error: unknown) {
    console.error(
      "Error API clientes/solicitudes:",
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
      { status: 500 }
    );
  }
}