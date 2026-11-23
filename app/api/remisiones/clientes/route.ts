
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verificarSesionAdmin } from "@/lib/vipack-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMPOS_DIRECCION =
  "id_cliente,calle,numero_exterior,numero_interior,colonia,delegacion,codigo_postal,ciudad,estado";

const camposDireccion = [
  "calle",
  "numero_exterior",
  "numero_interior",
  "colonia",
  "delegacion",
  "codigo_postal",
  "ciudad",
  "estado",
] as const;

type CampoDireccion = (typeof camposDireccion)[number];

type Direccion = Record<CampoDireccion, string | null>;

function responder(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function obtenerId(valor: unknown): number | null {
  if (typeof valor !== "string" && typeof valor !== "number") {
    return null;
  }

  if (String(valor).trim() === "") return null;

  const id = Number(valor);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// GET: consultar un domicilio o todos los domicilios registrados.
export async function GET(request: NextRequest) {
  if (!verificarSesionAdmin(request)) {
    return responder(
      { success: false, error: "Sesión no autorizada." },
      401
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const idTexto = request.nextUrl.searchParams.get("id");

    // Consulta individual: se conserva el funcionamiento anterior.
    if (idTexto !== null) {
      const id = obtenerId(idTexto);

      if (id === null) {
        return responder(
          { success: false, error: "ID de cliente inválido." },
          400
        );
      }

      const { data, error } = await supabase
        .from("remisiones_direcciones")
        .select(CAMPOS_DIRECCION)
        .eq("id_cliente", id)
        .maybeSingle();

      if (error) throw error;

      return responder({
        success: true,
        direccion: data ?? null,
      });
    }

    // Consulta general: todos los domicilios registrados.
    const direcciones: Direccion[] = [];
    const TAMANO_PAGINA = 500;

    let desde = 0;

    while (true) {
      const { data, error } = await supabase
        .from("remisiones_direcciones")
        .select(CAMPOS_DIRECCION)
        .order("id_cliente", { ascending: true })
        .range(desde, desde + TAMANO_PAGINA - 1);

      if (error) throw error;

      const pagina = (data ?? []) as Direccion[];

      direcciones.push(...pagina);

      if (pagina.length < TAMANO_PAGINA) {
        break;
      }

      desde += TAMANO_PAGINA;
    }

    return responder({
      success: true,
      total: direcciones.length,
      direcciones,
    });

  } catch (error) {
    console.error(
      "Error consultando domicilios de remisión:",
      error
    );

    return responder(
      {
        success: false,
        error: "No se pudieron consultar los domicilios.",
      },
      500
    );
  }
}

// PATCH: crear o actualizar un domicilio.
export async function PATCH(request: NextRequest) {
  if (!verificarSesionAdmin(request)) {
    return responder(
      { success: false, error: "Sesión no autorizada." },
      401
    );
  }

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return responder(
        { success: false, error: "Datos inválidos." },
        400
      );
    }

    const entrada = body as Record<string, unknown>;

    const id = obtenerId(entrada.id ?? entrada.id_cliente);

    if (id === null) {
      return responder(
        { success: false, error: "ID de cliente inválido." },
        400
      );
    }

    const direccion = {} as Direccion;

    for (const campo of camposDireccion) {
      const valor = entrada[campo];

      if (
        valor !== undefined &&
        valor !== null &&
        typeof valor !== "string"
      ) {
        return responder(
          { success: false, error: `Valor inválido: ${campo}` },
          400
        );
      }

      const limpio =
        typeof valor === "string" ? valor.trim() : "";

      if (limpio.length > 200) {
        return responder(
          { success: false, error: `Campo demasiado largo: ${campo}` },
          400
        );
      }

      direccion[campo] = limpio || null;
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("remisiones_direcciones")
      .upsert(
        {
          id_cliente: id,
          ...direccion,
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: "id_cliente" }
      )
      .select(CAMPOS_DIRECCION)
      .single();

    if (error) throw error;

    return responder({
      success: true,
      direccion: data,
    });

  } catch (error) {
    console.error(
      "Error guardando domicilio de remisión:",
      error
    );

    return responder(
      {
        success: false,
        error: "No se pudo guardar el domicilio.",
      },
      500
    );
  }
}
