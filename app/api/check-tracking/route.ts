import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const ACTUALIZACION_TEMPLATE = "HX23277e717da845d5b292d5c196900566";

function traducirEstado(status: string) {
  const estados: Record<string, string> = {
    InfoReceived: "Información recibida por paquetería",
    PickUp: "Recolectado por paquetería",
    AvailableForPickup: "Disponible para recoger en oficinas",
    InTransit: "En tránsito",
    OutForDelivery: "En ruta de entrega a tu domicilio",
    DeliveryFailure: "Intento de entrega fallido",
    Delivered: "Entregado",
    Exception: "Envío en espera del siguiente proceso.",
    Expired: "Caducado",
  };

  return estados[status] || status || "Sin actualización";
}

function limpiarGuia(valor: any) {
  return String(valor || "").replace(/\D/g, "");
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
      number: limpiarGuia(envio.guia),
    }));

    console.log(
      "TRACK17 KEY:",
      process.env.TRACK17_API_KEY
        ? process.env.TRACK17_API_KEY.substring(0, 10)
        : "NO EXISTE"
    );

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

    const acceptedList = data17?.data?.accepted || [];
    const rejectedList = data17?.data?.rejected || [];

    const resultados = [];

    for (const envio of envios) {
      const numeroGuia = limpiarGuia(envio.guia);

      const aceptado = acceptedList.find((item: any) => {
        const guia17 = limpiarGuia(item.number);

        return (
          guia17 === numeroGuia ||
          guia17.endsWith(numeroGuia) ||
          numeroGuia.endsWith(guia17)
        );
      });

      if (!aceptado) {
        const rechazado = rejectedList.find((item: any) => {
          const guia17 = limpiarGuia(item.number);

          return (
            guia17 === numeroGuia ||
            guia17.endsWith(numeroGuia) ||
            numeroGuia.endsWith(guia17)
          );
        });

        await supabase
          .from("envios")
          .update({
            fecha_ultima_revision: new Date().toISOString(),
          })
          .eq("id", envio.id);

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

     const ultimoEvento =
  aceptado?.track_info?.latest_event?.description ||
  aceptado?.track_info?.latest_event?.location ||
  "";

let statusOriginal =
  aceptado?.track_info?.latest_status?.status ||
  aceptado?.track_info?.latest_event?.stage ||
  "Sin actualización";

const eventoTexto = String(ultimoEvento).toLowerCase();

if (
  eventoTexto.includes("mensajero") ||
  eventoTexto.includes("reparto") ||
  eventoTexto.includes("ruta") ||
  eventoTexto.includes("out for delivery")
) {
  statusOriginal = "OutForDelivery";
}

      const statusTraducido = traducirEstado(statusOriginal);

      const yaSeEnvioEseEstado =
        envio.ultimo_estado_enviado === statusTraducido;

      await supabase
        .from("envios")
        .update({
          estatus_actual: statusTraducido,
          entregado: statusOriginal === "Delivered",
          fecha_ultima_revision: new Date().toISOString(),
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
            whatsapp_entregado:
              statusOriginal === "Delivered"
                ? true
                : envio.whatsapp_entregado,
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