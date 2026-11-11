import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verificarSesionAdmin } from "@/lib/vipack-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Configuración de Supabase incompleta");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function errorJson(mensaje: string, status: number) {
  return NextResponse.json(
    { success: false, error: mensaje },
    { status }
  );
}

export async function GET(request: NextRequest) {
  if (!verificarSesionAdmin(request)) {
    return errorJson("Sesión no autorizada", 401);
  }

  const guia = request.nextUrl.searchParams.get("guia")?.trim();

  if (!guia || !/^\d{12}$/.test(guia)) {
    return errorJson("Guía inválida", 400);
  }

  try {
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("guias_paquexpress_pendientes")
      .select(
        "id,telefono_whatsapp,whatsapp_autorizado,fecha_autorizacion,origen_autorizacion,evidencia_autorizacion"
      )
      .eq("guia", guia)
      .limit(2);

    if (error) throw error;

    if (!data || data.length !== 1) {
      return errorJson("Guía no encontrada o duplicada", 404);
    }

    return NextResponse.json({
      success: true,
      consentimiento: data[0],
    });
  } catch (error) {
    console.error("Error consultando consentimiento:", error);
    return errorJson("No se pudo consultar el consentimiento", 500);
  }
}

export async function POST(request: NextRequest) {
  if (!verificarSesionAdmin(request)) {
    return errorJson("Sesión no autorizada", 401);
  }

  const origenRequest = request.headers.get("origin");
  if (origenRequest && origenRequest !== request.nextUrl.origin) {
    return errorJson("Origen no permitido", 403);
  }

  try {
    const body = await request.json();

    const guia = String(body?.guia ?? "").trim();
    const origen = String(body?.origen ?? "").trim();
    const evidencia = String(body?.evidencia ?? "").trim();

    if (!/^\d{12}$/.test(guia)) {
      return errorJson("Guía inválida", 400);
    }

    if (
      !origen ||
      !evidencia ||
      origen.length > 100 ||
      evidencia.length > 500
    ) {
      return errorJson(
        "Debes indicar el origen y la evidencia de la autorización",
        400
      );
    }

    const supabase = supabaseAdmin();

    const { data: registros, error: errorBusqueda } = await supabase
      .from("guias_paquexpress_pendientes")
      .select("id,telefono_whatsapp")
      .eq("guia", guia)
      .limit(2);

    if (errorBusqueda) throw errorBusqueda;

    if (!registros || registros.length !== 1) {
      return errorJson("Guía no encontrada o duplicada", 404);
    }

    const registro = registros[0];

    if (!registro.telefono_whatsapp) {
      return errorJson(
        "Primero debes confirmar y guardar el teléfono",
        400
      );
    }

    const fecha = new Date().toISOString();

    const { data: actualizado, error: errorActualizacion } =
      await supabase
        .from("guias_paquexpress_pendientes")
        .update({
          whatsapp_autorizado: true,
          fecha_autorizacion: fecha,
          origen_autorizacion: origen,
          evidencia_autorizacion: evidencia,
        })
        .eq("id", registro.id)
        .eq("telefono_whatsapp", registro.telefono_whatsapp)
        .select("id,whatsapp_autorizado,fecha_autorizacion")
        .maybeSingle();

    if (errorActualizacion) throw errorActualizacion;

    if (!actualizado) {
      return errorJson(
        "El teléfono cambió. Vuelve a verificarlo antes de autorizar",
        409
      );
    }

    return NextResponse.json({
      success: true,
      consentimiento: actualizado,
      mensaje: "Autorización registrada correctamente",
    });
  } catch (error) {
    console.error("Error registrando consentimiento:", error);
    return errorJson("No se pudo registrar la autorización", 500);
  }
}
