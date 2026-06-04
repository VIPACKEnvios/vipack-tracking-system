import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const ACTUALIZACION_TEMPLATE =
  "HX23277e717da845d5b292d5c196900566";

function traducirEstado(status: string) {
  const estados: Record<string, string> = {
    InfoReceived: "Información recibida por paquetería",
    PickUp: "Recolectado por paquetería",
    AvailableForPickup: "Disponible para recoger en oficinas",
    InTransit: "En tránsito",
    OutForDelivery: "En ruta de entrega",
    DeliveryFailure: "Intento de entrega fallido",
    Delivered: "Entregado",
    Exception: "Envío en espera del siguiente proceso.",
    Expired: "Caducado",
  };

  return estados[status] || status || "Sin actualización";
}

export async function GET() {
  try {
    const { data: envios, error } = await supabase
      .from("envios")
      .select("*")
      .eq("entregado", false);

    if (error) throw error;

    if (!envios || envios.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        resultados: [],
      });
    }

    const guias17Track = envios.map((envio: any) => ({
      number: String(envio.guia || "").replace(/\s/g, ""),
    }));
console.log("TRACK17:", process.env.TRACK176ABE5F9410182D2007AF65DEF694916C);
    const response17 = await fetch(
      "https://api.17track.net/track/v2.2/gettrackinfo",
      {
        method: "POST",
        headers: {
          "17token": process.env.TRACK17_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(guias17Track),
      }
    );

    const rawText = await response17.text();

    let data17: any;

    try {
      data17 = JSON.parse(rawText);
    } catch {
      return NextResponse.json({
        success: false,
        error: "17TRACK respondió formato inválido",
        respuesta: rawText.slice(0, 300),
      });
    }

    const resultados = [];

    for (const envio of envios) {
      const numeroGuia = String(envio.guia || "").replace(/\s/g, "");

      const aceptado = data17?.data?.accepted?.find(
        (item: any) => item.number === numeroGuia
      );

      if (!aceptado) {
        const rechazado = data17?.data?.rejected?.find(
          (item: any) => item.number === numeroGuia
        );

        resultados.push({
          guia: envio.guia,
          cliente: envio.cliente,
          actualizado: false,
          motivo:
            rechazado?.error?.message ||
            "Sin información de 17TRACK",
        });

        continue;
      }

      const statusOriginal =
        aceptado?.track_info?.latest_status?.status ||
        "Sin actualización";

      const statusTraducido = traducirEstado(statusOriginal);

      const yaSeEnvioEseEstado =
        envio.ultimo_estado_enviado === statusTraducido;

      await supabase
        .from("envios")
        .update({
          estatus_actual: statusTraducido,
          entregado: statusOriginal === "Delivered",
        })
        .eq("id", envio.id);

      let whatsappEnviado = false;

      if (
        !yaSeEnvioEseEstado &&
        statusTraducido !== "Sin actualización"
      ) {
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER!,
          to: `whatsapp:+${envio.telefono_whatsapp}`,

          contentSid: ACTUALIZACION_TEMPLATE,

          contentVariables: JSON.stringify({
            "1": String(envio.cliente || ""),
            "2": String(envio.pedido || ""),
            "3": String(envio.paqueteria || ""),
            "4": String(envio.guia || ""),
            "5": String(statusTraducido || ""),
          }),
        });

        await supabase
          .from("envios")
          .update({
            ultimo_estado_enviado: statusTraducido,
            ultimo_whatsapp: `Actualización enviada: ${statusTraducido}`,
          })
          .eq("id", envio.id);

        whatsappEnviado = true;
      }

      resultados.push({
        guia: envio.guia,
        cliente: envio.cliente,
        statusOriginal,
        statusTraducido,
        whatsapp_enviado: whatsappEnviado,
      });
    }

    return NextResponse.json({
      success: true,
      total: resultados.length,
      resultados,
    });
  } catch (error: any) {
    console.error("Error check-tracking:", error);

    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}