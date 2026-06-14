import { NextResponse } from "next/server";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

function limpiarTelefono(to: any) {
  return String(to || "")
    .replace(/\D/g, "")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { to, cliente, pedido, guia, paqueteria, pdfUrl, folio, tipo } = body;

    const telefono = limpiarTelefono(to);
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM;

    if (!fromWhatsApp) {
      return NextResponse.json(
        {
          success: false,
          error: "Falta configurar TWILIO_WHATSAPP_FROM en .env.local",
        },
        { status: 500 }
      );
    }

    if (!telefono || !cliente) {
      return NextResponse.json(
        { success: false, error: "Faltan datos: teléfono o cliente" },
        { status: 400 }
      );
    }

    let message;

    if (tipo === "recolectada") {
      message = await client.messages.create({
        from: fromWhatsApp,
        to: `whatsapp:+${telefono}`,
        body: `Hola ${cliente} 👋 Tu mercancía ya fue recolectada por VIPACK. Folio: ${
          folio || "sin folio"
        }. Gracias por confiar en nosotros.`,
      });
    } else {
      message = await client.messages.create({
        from: fromWhatsApp,
        to: `whatsapp:+${telefono}`,
        contentSid: "HXa23d26a6a0fc9103ed95cc58bb5699dc",
        contentVariables: JSON.stringify({
          "1": String(cliente || ""),
          "2": String(pedido || ""),
          "3": String(guia || ""),
          "4": String(paqueteria || ""),
          "5": String(pdfUrl || ""),
        }),
      });
    }

    return NextResponse.json({
      success: true,
      sid: message.sid,
    });
  } catch (error: any) {
    console.error("Twilio Error completo:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code || null,
        moreInfo: error.moreInfo || null,
        status: error.status || null,
      },
      { status: 500 }
    );
  }
}