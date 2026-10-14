
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verificarSesionAdmin } from "@/lib/vipack-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const columnas = [
  "id",
  "cliente",
  "telefono_whatsapp",
  "alias",
  "activo",
  ...camposDireccion,
].join(",");

function respuesta(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function autorizado(request: NextRequest) {
  return verificarSesionAdmin(request);
}

// Consultar clientas
export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return respuesta(
      { success: false, error: "Sesión no autorizada." },
      401
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("clientes")
      .select(columnas)
      .eq("activo", true)
      .order("cliente", { ascending: true })
      .limit(1000);

    if (error) {
      throw error;
    }

    return respuesta({
      success: true,
      clientes: data ?? [],
    });
  } catch (error) {
    console.error("Error consultando remisiones:", error);
    return respuesta(
      { success: false, error: "No se pudieron consultar las clientas." },
      500
    );
  }
}

// Guardar dirección de la clienta
export async function PATCH(request: NextRequest) {
  if (!autorizado(request)) {
    return respuesta(
      { success: false, error: "Sesión no autorizada." },
      401
    );
  }

  try {
    const body = await request.json();

    const id = Number(body?.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return respuesta(
        { success: false, error: "ID de clienta inválido." },
        400
      );
    }

    const actualizacion: Record<string, string | null> = {};

    for (const campo of camposDireccion) {
      if (Object.prototype.hasOwnProperty.call(body, campo)) {
        const valor = body[campo];

        if (valor !== null && typeof valor !== "string") {
          return respuesta(
            { success: false, error: `Valor inválido: ${campo}` },
            400
          );
        }

        const limpio = (valor ?? "").trim();

        if (limpio.length > 200) {
          return respuesta(
            { success: false, error: `Campo demasiado largo: ${campo}` },
            400
          );
        }

        actualizacion[campo] = limpio || null;
      }
    }

    if (Object.keys(actualizacion).length === 0) {
      return respuesta(
        { success: false, error: "No hay datos para actualizar." },
        400
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("clientes")
      .update(actualizacion)
      .eq("id", id)
      .eq("activo", true)
      .select(columnas)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return respuesta(
        { success: false, error: "Clienta no encontrada o inactiva." },
        404
      );
    }

    return respuesta({
      success: true,
      cliente: data,
    });
  } catch (error) {
    console.error("Error guardando dirección:", error);
    return respuesta(
      { success: false, error: "No se pudo guardar la dirección." },
      500
    );
  }
}
