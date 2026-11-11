
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

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

export async function POST(request: NextRequest) {
  try {
    const secreto = process.env.CRON_SECRET;
    const autorizacion = request.headers.get("authorization");

    if (!secreto || autorizacion !== `Bearer ${secreto}`) {
      return NextResponse.json(
        { success: false, error: "No autorizado." },
        { status: 401 }
      );
    }

    let datos: unknown;

    try {
      datos = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "JSON no válido." },
        { status: 400 }
      );
    }

    const clienteId =
      datos !== null &&
      typeof datos === "object" &&
      "cliente" in datos
        ? (datos as { cliente: unknown }).cliente
        : null;

    if (
      typeof clienteId !== "number" ||
      !Number.isSafeInteger(clienteId) ||
      clienteId <= 0
    ) {
      return NextResponse.json(
        { success: false, error: "Cliente no válido." },
        { status: 400 }
      );
    }

    const supabase = obtenerSupabaseAdmin();

    const { data: cliente, error: clienteError } =
      await supabase
        .from("clientes_inventario")
        .select("id_cliente")
        .eq("id_cliente", clienteId)
        .eq("activo", true)
        .maybeSingle();

    if (clienteError) {
      console.error("Error verificando cliente:", clienteError);
      return NextResponse.json(
        { success: false, error: "Error verificando cliente." },
        { status: 500 }
      );
    }

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error: "Cliente inexistente o inactivo.",
        },
        { status: 404 }
      );
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subjectOriginal = process.env.VAPID_SUBJECT?.trim();

    if (!publicKey || !privateKey || !subjectOriginal) {
      return NextResponse.json(
        {
          success: false,
          error: "Configuración VAPID incompleta.",
        },
        { status: 500 }
      );
    }

    const subject =
      subjectOriginal.startsWith("mailto:") ||
      subjectOriginal.startsWith("https://")
        ? subjectOriginal
        : `mailto:${subjectOriginal}`;

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const { data: suscripciones, error: errorSuscripciones } =
      await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("cliente_id", clienteId)
        .eq("activo", true);

    if (errorSuscripciones) {
      console.error("Error consultando suscripciones:", errorSuscripciones);

      return NextResponse.json(
        {
          success: false,
          error: "No se pudieron consultar los dispositivos.",
        },
        { status: 500 }
      );
    }

    if (!suscripciones?.length) {
      return NextResponse.json(
        {
          success: false,
          cliente: clienteId,
          dispositivos: 0,
          error: "No hay dispositivos activos.",
        },
        { status: 404 }
      );
    }

    const payload = JSON.stringify({
      title: "VIPACK Envíos 📦",
      body: "🔔 Prueba de notificación. Tu dispositivo está conectado a VIPACK.",
      url: "/",
      tag: `vipack-prueba-${Date.now()}`,
    });

    const resultados: Array<{
      id: number;
      enviado: boolean;
      codigo: number | null;
      estado: string;
    }> = [];

    for (const suscripcion of suscripciones) {
      const { data: clienteVigente, error: errorVigencia } =
        await supabase
          .from("clientes_inventario")
          .select("id_cliente")
          .eq("id_cliente", clienteId)
          .eq("activo", true)
          .maybeSingle();

      if (errorVigencia || !clienteVigente) {
        console.warn("Prueba detenida: cliente inactivo o no verificable.");

        return NextResponse.json(
          {
            success: false,
            cliente: clienteId,
            error: "La prueba se detuvo al verificar el cliente.",
            resultados,
          },
          { status: 409 }
        );
      }

      // Comprobar que la suscripción sigue activa.
      const { data: suscripcionVigente, error: errorEstado } =
        await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("id", suscripcion.id)
          .eq("cliente_id", clienteId)
          .eq("activo", true)
          .maybeSingle();

      if (errorEstado || !suscripcionVigente) {
        resultados.push({
          id: suscripcion.id,
          enviado: false,
          codigo: null,
          estado: "Suscripción inactiva o no verificable",
        });
        continue;
      }

      try {
        const respuesta = await webpush.sendNotification(
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

        resultados.push({
          id: suscripcion.id,
          enviado: true,
          codigo: respuesta.statusCode,
          estado: "Aceptado por el servicio push",
        });
      } catch (error: unknown) {
        const codigo =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof error.statusCode === "number"
            ? error.statusCode
            : null;

        if (codigo === 404 || codigo === 410) {
          const { error: errorDesactivacion } =
            await supabase
              .from("push_subscriptions")
              .update({
                activo: false,
                updated_at: new Date().toISOString(),
              })
              .eq("id", suscripcion.id)
              .eq("cliente_id", clienteId)
              .eq("activo", true);

          if (errorDesactivacion) {
            console.error(
              "No se pudo desactivar la suscripción:",
              suscripcion.id,
              errorDesactivacion
            );
          }

          resultados.push({
            id: suscripcion.id,
            enviado: false,
            codigo,
            estado: errorDesactivacion
              ? "Suscripción vencida; error al desactivar"
              : "Suscripción vencida y desactivada",
          });
        } else {
          console.error(
            "Error enviando push a suscripción:",
            suscripcion.id,
            codigo
          );

          resultados.push({
            id: suscripcion.id,
            enviado: false,
            codigo,
            estado: "Error de envío",
          });
        }
      }
    }

    const exitosos = resultados.filter(
      (resultado) => resultado.enviado
    ).length;

    return NextResponse.json({
      success: exitosos > 0,
      cliente: clienteId,
      dispositivos: suscripciones.length,
      procesados: resultados.length,
      exitosos,
      errores: resultados.length - exitosos,
      resultados,
    });
  } catch (error) {
    console.error("Error interno de prueba push:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error interno al procesar la prueba.",
      },
      { status: 500 }
    );
  }
}
