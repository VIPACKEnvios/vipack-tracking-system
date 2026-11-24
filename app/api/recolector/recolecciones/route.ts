import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { GET as obtenerRecolecciones } from "@/app/api/recolecciones/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function responder(datos: Record<string, unknown>, status = 200) {
  return NextResponse.json(datos, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];

  if (!token) {
    return responder(
      { success: false, error: "Token de acceso requerido." },
      401
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: autenticacion, error: errorAuth } =
      await supabase.auth.getUser(token);

    if (errorAuth || !autenticacion.user) {
      return responder(
        { success: false, error: "Sesion no valida." },
        401
      );
    }

    const usuarioId = autenticacion.user.id;

    const { data: recolector, error: errorRecolector } = await supabase
      .from("recolectores")
      .select("id,nombre,activo,rol")
      .eq("id", usuarioId)
      .eq("activo", true)
      .eq("rol", "recolector")
      .maybeSingle();

    if (errorRecolector) {
      throw errorRecolector;
    }

    if (!recolector) {
      return responder(
        { success: false, error: "Recolector no autorizado." },
        403
      );
    }

    const { data: asignaciones, error: errorAsignaciones } = await supabase
      .from("recolecciones_asignadas")
      .select("folio,asignado_en")
      .eq("recolector_id", usuarioId)
      .order("asignado_en", { ascending: false });

    if (errorAsignaciones) {
      throw errorAsignaciones;
    }

    const folios = (asignaciones ?? []).map((item) => item.folio);

    if (folios.length === 0) {
      return responder({
        success: true,
        recolector: { id: recolector.id, nombre: recolector.nombre },
        total: 0,
        recolecciones: [],
      });
    }

    const { data: eliminadas, error: errorEliminadas } = await supabase
      .from("recolecciones_eliminadas")
      .select("folio")
      .in("folio", folios);

    if (errorEliminadas) {
      throw errorEliminadas;
    }

    const foliosEliminados = new Set(
      (eliminadas ?? []).map((item) => item.folio)
    );

    const respuestaExcel = await obtenerRecolecciones();

    if (!respuestaExcel.ok) {
      return responder(
        { success: false, error: "No se pudo consultar la matriz." },
        503
      );
    }

    const resultado: unknown = await respuestaExcel.json();

    if (
      !resultado ||
      typeof resultado !== "object" ||
      !("success" in resultado) ||
      resultado.success !== true ||
      !("registros" in resultado) ||
      !Array.isArray(resultado.registros)
    ) {
      return responder(
        { success: false, error: "Respuesta de matriz no valida." },
        503
      );
    }

    const registros = resultado.registros as Record<string, unknown>[];

    const registrosPorFolio = new Map(
      registros.map((fila) => [String(fila["Folio"] ?? "").trim(), fila])
    );

    const recolecciones = folios
      .filter((folio) => !foliosEliminados.has(folio))
      .map((folio) => registrosPorFolio.get(folio))
      .filter((fila): fila is Record<string, unknown> => Boolean(fila))
      .filter((fila) => {
        const estado = String(fila["Estatus"] ?? "").trim().toLowerCase();
        return ["pendiente", "en ruta", "no lista", "reprogramada", "recolectada", "cancelada"].includes(
          estado
        );
      })
      .map((fila) => ({
        folio: String(fila["Folio"] ?? ""),
        cliente: String(fila["Cliente"] ?? ""),
        bodega: String(fila["Lugar / Bodega de recolección"] ?? ""),
        direccion: String(fila["Dirección de recolección"] ?? ""),
        mercancia: String(fila["Mercancía"] ?? ""),
        cantidad: String(fila["Cantidad / Bultos"] ?? ""),
        fechaRecoleccion: String(fila["Fecha de recolección"] ?? ""),
        horaCita: String(fila["Hora de cita"] ?? ""),
        observaciones: String(fila["Observaciones"] ?? ""),
        estado: String(fila["Estatus"] ?? ""),
      }));

    return responder({
      success: true,
      recolector: { id: recolector.id, nombre: recolector.nombre },
      total: recolecciones.length,
      recolecciones,
    });
  } catch (error) {
    console.error("Error consultando recolecciones de recolector:", error);

    return responder(
      { success: false, error: "No se pudieron consultar las recolecciones." },
      500
    );
  }
}
