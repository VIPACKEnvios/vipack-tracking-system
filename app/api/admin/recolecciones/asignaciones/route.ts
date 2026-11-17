import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verificarSesionAdmin } from "@/lib/vipack-auth";
import { GET as obtenerRecolecciones } from "@/app/api/recolecciones/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function responder(
  datos: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(datos, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

export async function GET(request: NextRequest) {
  if (!verificarSesionAdmin(request)) {
    return responder(
      { success: false, error: "No autorizado." },
      401
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const [recolectores, asignaciones] = await Promise.all([
      supabase
        .from("recolectores")
        .select("id,nombre,email,activo,rol")
        .eq("activo", true)
        .eq("rol", "recolector")
        .order("nombre"),

      supabase
        .from("recolecciones_asignadas")
        .select("id,folio,recolector_id,asignado_en")
        .order("asignado_en", { ascending: false }),
    ]);

    if (recolectores.error) {
      throw recolectores.error;
    }

    if (asignaciones.error) {
      throw asignaciones.error;
    }

    return responder({
      success: true,
      recolectores: recolectores.data ?? [],
      asignaciones: asignaciones.data ?? [],
    });
  } catch (error) {
    console.error("Error consultando asignaciones:", error);

    return responder(
      {
        success: false,
        error: "No se pudieron consultar las asignaciones.",
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  if (!verificarSesionAdmin(request)) {
    return responder(
      { success: false, error: "No autorizado." },
      401
    );
  }

  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return responder(
        { success: false, error: "JSON no valido." },
        400
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return responder(
        { success: false, error: "Datos no validos." },
        400
      );
    }

    const datos = body as Record<string, unknown>;

    const folio =
      typeof datos.folio === "string"
        ? datos.folio.trim()
        : "";

    const recolectorId =
      typeof datos.recolector_id === "string"
        ? datos.recolector_id.trim()
        : "";

    if (
      !folio ||
      folio.length > 100 ||
      !/^[A-Za-z0-9_-]+$/.test(folio)
    ) {
      return responder(
        { success: false, error: "Folio no valido." },
        400
      );
    }

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        recolectorId
      )
    ) {
      return responder(
        {
          success: false,
          error: "Identificador de recolector no valido.",
        },
        400
      );
    }

    const supabase = getSupabaseAdmin();

    const [respuestaExcel, eliminadas, recolector] =
      await Promise.all([
        obtenerRecolecciones(),

        supabase
          .from("recolecciones_eliminadas")
          .select("folio")
          .eq("folio", folio)
          .limit(1),

        supabase
          .from("recolectores")
          .select("id")
          .eq("id", recolectorId)
          .eq("activo", true)
          .eq("rol", "recolector")
          .maybeSingle(),
      ]);

    if (eliminadas.error) {
      throw eliminadas.error;
    }

    if (recolector.error) {
      throw recolector.error;
    }

    if (!recolector.data) {
      return responder(
        {
          success: false,
          error: "El recolector no existe o esta inactivo.",
        },
        400
      );
    }

    if (!respuestaExcel.ok) {
      return responder(
        {
          success: false,
          error: "No se pudo verificar el Excel de la matriz.",
        },
        503
      );
    }

    const resultadoExcel: unknown =
      await respuestaExcel.json();

    if (
      !resultadoExcel ||
      typeof resultadoExcel !== "object" ||
      !("success" in resultadoExcel) ||
      resultadoExcel.success !== true ||
      !("registros" in resultadoExcel) ||
      !Array.isArray(resultadoExcel.registros)
    ) {
      return responder(
        {
          success: false,
          error: "Respuesta no valida del Excel.",
        },
        503
      );
    }

    const registros = resultadoExcel.registros as Array<
      Record<string, unknown>
    >;

    const registro = registros.find(
      (fila) =>
        String(fila["Folio"] ?? "").trim() === folio
    );

    if (!registro) {
      return responder(
        {
          success: false,
          error: "El folio no existe en la matriz.",
        },
        404
      );
    }

    if ((eliminadas.data ?? []).length > 0) {
      return responder(
        {
          success: false,
          error: "La recoleccion esta eliminada de la vista.",
        },
        409
      );
    }

    const estado = String(
      registro["Estatus"] ?? ""
    ).trim().toLowerCase();

    const estadosPermitidos = [
      "pendiente",
      "en ruta",
      "no lista",
      "reprogramada",
    ];

    if (!estadosPermitidos.includes(estado)) {
      return responder(
        {
          success: false,
          error: "No se puede asignar una recoleccion terminada o cancelada.",
        },
        409
      );
    }

    const { data, error } = await supabase
      .from("recolecciones_asignadas")
      .upsert(
        {
          folio,
          recolector_id: recolectorId,
          asignado_en: new Date().toISOString(),
        },
        { onConflict: "folio" }
      )
      .select("id,folio,recolector_id,asignado_en")
      .single();

    if (error) {
      throw error;
    }

    return responder({
      success: true,
      mensaje: "Recoleccion asignada correctamente.",
      asignacion: data,
    });
  } catch (error) {
    console.error("Error asignando recoleccion:", error);

    return responder(
      {
        success: false,
        error: "No se pudo guardar la asignacion.",
      },
      500
    );
  }
}
