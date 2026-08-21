import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function crearSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !supabaseServiceRoleKey
  ) {
    throw new Error(
      "Faltan variables de configuración de Supabase."
    );
  }

  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function limpiarFolio(
  valor: unknown
) {
  return String(
    valor ?? ""
  )
    .trim()
    .replace(
      /[^A-Za-z0-9-_]/g,
      ""
    );
}

export async function GET() {
  try {
    const supabase =
      crearSupabase();

    const {
      data,
      error,
    } =
      await supabase
        .from(
          "recolecciones_eliminadas"
        )
        .select(
          "folio"
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    const folios =
      (data ?? [])
        .map(
          (item) =>
            limpiarFolio(
              item.folio
            )
        )
        .filter(
          Boolean
        );

    return NextResponse.json({
      success: true,
      folios,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error consultando recolecciones eliminadas:",
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

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as {
        folio?: string;
      };

    const folio =
      limpiarFolio(
        body.folio
      );

    if (!folio) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El folio es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      crearSupabase();

    const {
      error,
    } =
      await supabase
        .from(
          "recolecciones_eliminadas"
        )
        .upsert(
          {
            folio,
          },
          {
            onConflict: "folio",
          }
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    return NextResponse.json({
      success: true,
      mensaje:
        "Recolección eliminada de la vista sin modificar el Excel.",
      folio,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error eliminando recolección de la vista:",
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

export async function DELETE(
  request: Request
) {
  try {
    const body =
      (await request.json()) as {
        folio?: string;
      };

    const folio =
      limpiarFolio(
        body.folio
      );

    if (!folio) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El folio es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      crearSupabase();

    const {
      error,
    } =
      await supabase
        .from(
          "recolecciones_eliminadas"
        )
        .delete()
        .eq(
          "folio",
          folio
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    return NextResponse.json({
      success: true,
      mensaje:
        "Recolección restaurada correctamente.",
      folio,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error restaurando recolección:",
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