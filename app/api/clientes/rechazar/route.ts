import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Evita solicitudes desde sitios externos; requiere también la sesión VIPACK.
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return NextResponse.json({ success: false, error: "Origen no autorizado." }, { status: 403 });
    }
    const cookies = request.headers.get("cookie") || "";
    if (!/(?:^|;\s*)vipack-auth=/.test(cookies)) {
      return NextResponse.json({ success: false, error: "Inicia sesión para continuar." }, { status: 401 });
    }
    // IMPORTANTE: La firma y caducidad de vipack-auth deben validarse en el
    // middleware/proxy de la aplicación. La presencia de cookie no autentica.
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Datos inválidos." }, { status: 400 });
    }
    const entrada = body as Record<string, unknown>;
    const id = entrada.solicitud_id;
    const motivo = typeof entrada.motivo === "string" ? entrada.motivo.trim() : "";
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || motivo.length < 5 || motivo.length > 500) {
      return NextResponse.json({ success: false, error: "Solicitud o motivo inválido (5 a 500 caracteres)." }, { status: 400 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Falta configuración de Supabase.");
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    // Solo se rechazan solicitudes pendientes, sin número asignado ni reserva.
    const { data: solicitud, error: errorConsulta } = await supabase
      .from("solicitudes_clientes")
      .select("id, estado, id_cliente_asignado, carpeta_cliente, onedrive_folder_id")
      .eq("id", id).maybeSingle();
    if (errorConsulta) throw errorConsulta;
    if (!solicitud) return NextResponse.json({ success: false, error: "Solicitud no encontrada." }, { status: 404 });
    if (solicitud.estado !== "pendiente" || solicitud.id_cliente_asignado != null || solicitud.carpeta_cliente || solicitud.onedrive_folder_id) {
      return NextResponse.json({ success: false, error: "La solicitud ya tiene avances o no está pendiente. Requiere revisión." }, { status: 409 });
    }
    const { data: reservas, error: errorReserva } = await supabase
      .from("reservas_numeros_clientes").select("solicitud_id").eq("solicitud_id", id).limit(1);
    if (errorReserva) throw errorReserva;
    if (reservas?.length) return NextResponse.json({ success: false, error: "Existe una reserva de número. No se puede rechazar automáticamente." }, { status: 409 });

    const { data: actualizado, error: errorActualizacion } = await supabase
      .from("solicitudes_clientes")
      .update({ estado: "rechazado", motivo_rechazo: motivo, rechazado_at: new Date().toISOString() })
      .eq("id", id).eq("estado", "pendiente").is("id_cliente_asignado", null)
      .is("carpeta_cliente", null).is("onedrive_folder_id", null)
      .select("id").maybeSingle();
    if (errorActualizacion) throw errorActualizacion;
    if (!actualizado) return NextResponse.json({ success: false, error: "La solicitud cambió de estado. Actualiza la pantalla." }, { status: 409 });
    return NextResponse.json({ success: true, solicitud_id: id });
  } catch (e) {
    console.error("Error al rechazar solicitud:", e);
    return NextResponse.json({ success: false, error: "No se pudo rechazar. Verifica la estructura de Supabase y los registros de la API." }, { status: 500 });
  }
}