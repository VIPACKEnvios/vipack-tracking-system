
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseAdmin() {
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

function configurarVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const original = process.env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !original) {
    throw new Error("Faltan variables VAPID.");
  }

  const subject =
    original.startsWith("mailto:") || original.includes("://")
      ? original
      : `mailto:${original}`;

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function respuestaError(mensaje: string, status: number) {
  return NextResponse.json(
    { success: false, error: mensaje },
    { status }
  );
}

function origenPermitido(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) return false;

  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

// POST: ejecutar prueba manual para UNA clienta.
export async function POST(request: NextRequest) {
  try {
    if (!origenPermitido(request)) {
      return respuestaError("Origen no autorizado.", 403);
    }

    // El proxy.ts exige sesión administrativa.
    const body = await request.json().catch(() => null);
    const clienteId = body?.cliente_id;

    if (
      typeof clienteId !== "number" ||
      !Number.isSafeInteger(clienteId) ||
      clienteId <= 0
    ) {
      return respuestaError("ID de cliente no válido.", 400);
    }

    const supabase = supabaseAdmin();

    const { data: cliente, error: clienteError } = await supabase
      .from("clientes_inventario")
      .select("id_cliente, activo")
      .eq("id_cliente", clienteId)
      .eq("activo", true)
      .maybeSingle();

    if (clienteError) {
      return respuestaError("No se pudo verificar la clienta.", 500);
    }

    if (!cliente) {
      return respuestaError(
        "La clienta no existe o está inactiva.",
        404
      );
    }

    const { data: suscripciones, error: suscripcionesError } =
      await supabase
        .from("push_subscriptions")
        .select("id, cliente_id, endpoint, p256dh, auth")
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .order("id", { ascending: true })
        .limit(100);

    if (suscripcionesError) {
      return respuestaError(
        "No se pudieron consultar los dispositivos.",
        500
      );
    }

    if (!suscripciones?.length) {
      return NextResponse.json({
        success: true,
        cliente_id: clienteId,
        diagnostico_id: null,
        dispositivos: 0,
        aceptados: 0,
        errores: 0,
        mensaje: "La clienta no tiene dispositivos push activos.",
      });
    }

    configurarVapid();

    const diagnosticoId = randomUUID();

    let aceptados = 0;
    let errores = 0;

    for (const suscripcion of suscripciones) {
      // Volver a verificar que la clienta siga activa.
      const { data: vigente, error: vigenciaError } =
        await supabase
          .from("clientes_inventario")
          .select("id_cliente")
          .eq("id_cliente", clienteId)
          .eq("activo", true)
          .maybeSingle();

      if (vigenciaError || !vigente) {
        break;
      }

      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256")
        .update(token)
        .digest("hex");

      const { data: entrega, error: entregaError } =
        await supabase
          .from("push_entregas")
          .insert({
            diagnostico_id: diagnosticoId,
            cliente_id: clienteId,
            suscripcion_id: suscripcion.id,
            estado: "pendiente",
            confirmacion_token_hash: tokenHash,
          })
          .select("id")
          .single();

      if (entregaError || !entrega) {
        console.error(
          "No se pudo registrar entrega:",
          entregaError
        );
        errores++;
        continue;
      }

      const payload = JSON.stringify({
        title: "VIPACK Envíos",
        body:
          "🔔 Prueba de notificación VIPACK. " +
          "No necesitas abrir este aviso.",
        url: "/",
        tag: `vipack-diagnostico-${entrega.id}`,
        entrega_id: entrega.id,
        confirmacion_token: token,
      });

      try {
        const response = await webpush.sendNotification(
          {
            endpoint: suscripcion.endpoint,
            keys: {
              p256dh: suscripcion.p256dh,
              auth: suscripcion.auth,
            },
          },
          payload,
          { TTL: 300 }
        );

        // No sobrescribir una confirmación que haya
        // llegado antes que esta actualización.
        const { error: actualizarError } = await supabase
          .from("push_entregas")
          .update({
            estado: "aceptado",
            enviado_at: new Date().toISOString(),
            status_code: response.statusCode,
          })
          .eq("id", entrega.id)
          .eq("estado", "pendiente");

        if (actualizarError) {
          console.error(
            "Error actualizando entrega:",
            actualizarError
          );
        }

        aceptados++;
      } catch (error: unknown) {
        const pushError = error as {
          statusCode?: number;
          message?: string;
        };

        const statusCode = pushError?.statusCode ?? null;

        const { error: registroError } = await supabase
          .from("push_entregas")
          .update({
            estado: "error",
            enviado_at: new Date().toISOString(),
            status_code: statusCode,
            error_detalle:
              pushError?.message ?? "Error de envío Push.",
          })
          .eq("id", entrega.id)
          .eq("estado", "pendiente");

        if (registroError) {
          console.error(
            "Error registrando fallo Push:",
            registroError
          );
        }

        // 404 y 410 indican suscripción inválida.
        if (statusCode === 404 || statusCode === 410) {
          const { error: desactivarError } = await supabase
            .from("push_subscriptions")
            .update({ activo: false })
            .eq("id", suscripcion.id)
            .eq("cliente_id", clienteId);

          if (desactivarError) {
            console.error(
              "No se pudo desactivar suscripción:",
              desactivarError
            );
          }
        }

        errores++;
      }
    }

    return NextResponse.json({
      success: true,
      diagnostico_id: diagnosticoId,
      cliente_id: clienteId,
      dispositivos: suscripciones.length,
      aceptados,
      errores,
      mensaje:
        "Prueba enviada. Consulta el diagnóstico para " +
        "revisar las confirmaciones.",
    });
  } catch (error) {
    console.error("Error diagnóstico Push:", error);

    return respuestaError(
      "No se pudo ejecutar el diagnóstico.",
      500
    );
  }
}

// GET: consultar resultados sin enviar notificaciones.
export async function GET(request: NextRequest) {
  try {
    const diagnosticoId =
      request.nextUrl.searchParams.get("diagnostico_id");

    if (
      !diagnosticoId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        diagnosticoId
      )
    ) {
      return respuestaError(
        "Identificador de diagnóstico no válido.",
        400
      );
    }

    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("push_entregas")
      .select(
        "id, cliente_id, suscripcion_id, estado, enviado_at, confirmado_at, status_code, error_detalle"
      )
      .eq("diagnostico_id", diagnosticoId)
      .order("created_at", { ascending: true })
      .limit(1000);

    if (error) {
      return respuestaError(
        "No se pudieron consultar los resultados.",
        500
      );
    }

    const entregas = data ?? [];

    return NextResponse.json({
      success: true,
      diagnostico_id: diagnosticoId,
      total: entregas.length,
      confirmados: entregas.filter(
        (x) => x.estado === "confirmado"
      ).length,
      aceptados_sin_confirmacion: entregas.filter(
        (x) => x.estado === "aceptado"
      ).length,
      pendientes: entregas.filter(
        (x) => x.estado === "pendiente"
      ).length,
      errores: entregas.filter(
        (x) => x.estado === "error"
      ).length,
      entregas,
    });
  } catch (error) {
    console.error("Error consultando diagnóstico:", error);

    return respuestaError(
      "No se pudieron consultar los resultados.",
      500
    );
  }
}

