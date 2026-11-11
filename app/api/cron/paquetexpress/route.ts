
import { NextRequest, NextResponse } from "next/server";
import { randomUUID, timingSafeEqual } from "node:crypto";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { POST as registrarEventos } from "../../hotmail/registrar/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verificarCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret || secret.length < 32) {
    return false;
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const recibido = Buffer.from(
    authorization.slice(7),
    "utf8"
  );

  const esperado = Buffer.from(secret, "utf8");

  return (
    recibido.length === esperado.length &&
    timingSafeEqual(recibido, esperado)
  );
}

export async function GET(request: NextRequest) {
  if (!verificarCron(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Cron no autorizado.",
      },
      { status: 401 }
    );
  }

  const supabase = getSupabaseAdmin();
  const token = randomUUID();

  const { data: adquirido, error: errorInicio } =
    await supabase.rpc("iniciar_cron_paquexpress", {
      p_token: token,
    });

  if (errorInicio) {
    console.error(
      "[PAQUETEXPRESS] Error adquiriendo bloqueo:",
      errorInicio.message
    );

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo iniciar el cron.",
      },
      { status: 500 }
    );
  }

  if (adquirido !== true) {
    return NextResponse.json({
      success: true,
      modo: "ejecucion_omitida",
      motivo: "Ya existe otra ejecuci├│n activa.",
      enviaWhatsapp: false,
    });
  }

  const controlador = new AbortController();
  let bloqueoPerdido = false;
  let renovando = false;

  const renovacion = setInterval(async () => {
    if (renovando || bloqueoPerdido) {
      return;
    }

    renovando = true;

    try {
      const { data, error } = await supabase.rpc(
        "renovar_cron_paquexpress",
        { p_token: token }
      );

      if (error || data !== true) {
        bloqueoPerdido = true;
        controlador.abort();
      }
    } catch {
      bloqueoPerdido = true;
      controlador.abort();
    } finally {
      renovando = false;
    }
  }, 60_000);

  try {
    const solicitudInterna = new NextRequest(
      new URL("/api/hotmail/registrar", request.url),
      {
        method: "POST",
        headers: {
          authorization:
            request.headers.get("authorization") || "",
        },
        signal: controlador.signal,
      }
    );

    const respuesta = await registrarEventos(
      solicitudInterna
    );

    if (bloqueoPerdido) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Se perdi├│ el bloqueo durante la ejecuci├│n.",
          enviaWhatsapp: false,
        },
        { status: 409 }
      );
    }

    return respuesta;
  } catch (error) {
    console.error(
      "[PAQUETEXPRESS] Error del cron:",
      error instanceof Error
        ? error.message
        : "Error desconocido"
    );

    return NextResponse.json(
      {
        success: false,
        error: "Error ejecutando el cron.",
        enviaWhatsapp: false,
      },
      { status: 500 }
    );
  } finally {
    clearInterval(renovacion);

    const { error } = await supabase.rpc(
      "finalizar_cron_paquexpress",
      { p_token: token }
    );

    if (error) {
      console.error(
        "[PAQUETEXPRESS] No se pudo liberar el bloqueo:",
        error.message
      );
    }
  }
}
