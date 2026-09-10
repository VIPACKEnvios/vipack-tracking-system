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
): string {
  return String(valor ?? "")
    .trim()
    .replace(
      /[^A-Za-z0-9-_]/g,
      ""
    )
    .slice(0, 100);
}

async function leerBody(
  request: Request
): Promise<{
  folio?: unknown;
}> {
  try {
    const body =
      (await request.json()) as unknown;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return {};
    }

    return body as {
      folio?: unknown;
    };
  } catch {
    return {};
  }
}

function respuesta(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    data,
    {
      status,
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    }
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
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    const folios =
      Array.from(
        new Set(
          (data ?? [])
            .map(
              (item: {
                folio?: unknown;
              }) =>
                limpiarFolio(
                  item.folio
                )
            )
            .filter(
              (
                folio
              ): folio is string =>
                Boolean(folio)
            )
        )
      );

    return respuesta({
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

    return respuesta(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido.",
      },
      500
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await leerBody(
        request
      );

    const folio =
      limpiarFolio(
        body.folio
      );

    if (!folio) {
      return respuesta(
        {
          success: false,
          error:
            "El folio es obligatorio.",
        },
        400
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
            onConflict:
              "folio",
          }
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    return respuesta({
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

    return respuesta(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido.",
      },
      500
    );
  }
}

export async function DELETE(
  request: Request
) {
  try {
    const body =
      await leerBody(
        request
      );

    const folio =
      limpiarFolio(
        body.folio
      );

    if (!folio) {
      return respuesta(
        {
          success: false,
          error:
            "El folio es obligatorio.",
        },
        400
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

    return respuesta({
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

    return respuesta(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido.",
      },
      500
    );
  }
}