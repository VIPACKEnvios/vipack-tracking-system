
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function obtenerSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Faltan variables de Supabase.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type ConfirmacionBody = {
  entrega_id?: string;
  confirmacion_token?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ConfirmacionBody;

    const entregaId = body?.entrega_id;
    const token = body?.confirmacion_token;

    // Validar identificador y token de confirmación.
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const tokenRegex = /^[0-9a-f]{64}$/i;

    if (
      typeof entregaId !== "string" ||
      !uuidRegex.test(entregaId) ||
      typeof token !== "string" ||
      !tokenRegex.test(token)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Datos de confirmación no válidos.",
        },
        { status: 400 }
      );
    }

    const supabase = obtenerSupabaseAdmin();

    // Buscar la entrega registrada.
    const { data: entrega, error: consultaError } =
      await supabase
        .from("push_entregas")
        .select(
          "id, estado, confirmacion_token_hash"
        )
        .eq("id", entregaId)
        .maybeSingle();

    if (consultaError) {
      console.error(
        "Error consultando entrega:",
        consultaError
      );

      return NextResponse.json(
        {
          success: false,
          error: "No se pudo consultar la entrega.",
        },
        { status: 500 }
      );
    }

    if (!entrega) {
      return NextResponse.json(
        {
          success: false,
          error: "Entrega no encontrada.",
        },
        { status: 404 }
      );
    }

    // Verificar que exista un comprobante.
    const hashGuardado = entrega.confirmacion_token_hash;

    if (
      typeof hashGuardado !== "string" ||
      !tokenRegex.test(hashGuardado)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Confirmación no disponible.",
        },
        { status: 403 }
      );
    }

    // Calcular hash del token recibido.
    const hashRecibido = createHash("sha256")
      .update(token)
      .digest("hex");

    const recibido = Buffer.from(hashRecibido, "hex");
    const esperado = Buffer.from(hashGuardado, "hex");

    // Comparación segura.
    if (
      recibido.length !== esperado.length ||
      !timingSafeEqual(recibido, esperado)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Confirmación no autorizada.",
        },
        { status: 403 }
      );
    }

    // Evitar confirmar dos veces.
    if (entrega.estado === "confirmado") {
      return NextResponse.json({
        success: true,
        confirmado: true,
      });
    }

    // Solo se permiten entregas pendientes o aceptadas.
    if (
      entrega.estado !== "pendiente" &&
      entrega.estado !== "aceptado"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "La entrega no permite confirmación.",
        },
        { status: 409 }
      );
    }

    // Registrar la confirmación de recepción.
    const { data: actualizada, error: actualizarError } =
      await supabase
        .from("push_entregas")
        .update({
          estado: "confirmado",
          confirmado_at: new Date().toISOString(),
        })
        .eq("id", entregaId)
        .in("estado", ["pendiente", "aceptado"])
        .select("id")
        .maybeSingle();

    if (actualizarError) {
      console.error(
        "Error guardando confirmación:",
        actualizarError
      );

      return NextResponse.json(
        {
          success: false,
          error: "No se pudo guardar la confirmación.",
        },
        { status: 500 }
      );
    }

    // Si otra solicitud confirmó la entrega al mismo
    // tiempo, comprobar su estado actual.
    if (!actualizada) {
      const { data: estadoActual, error: estadoError } =
        await supabase
          .from("push_entregas")
          .select("estado")
          .eq("id", entregaId)
          .maybeSingle();

      if (estadoError) {
        return NextResponse.json(
          {
            success: false,
            error: "No se pudo verificar la confirmación.",
          },
          { status: 500 }
        );
      }

      if (estadoActual?.estado !== "confirmado") {
        return NextResponse.json(
          {
            success: false,
            confirmado: false,
            error: "La entrega no pudo confirmarse.",
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      confirmado: true,
    });
  } catch (error) {
    console.error(
      "Error en confirmación de recepción VIPACK:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor.",
      },
      { status: 500 }
    );
  }
}
