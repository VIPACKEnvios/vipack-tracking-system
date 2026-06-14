import { NextResponse } from "next/server";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function limpiarTelefono(to: any) {
  let telefono = String(to || "").replace(/\D/g, "").trim();

  if (!telefono) return "";

  // Correcto WhatsApp México: 521 + 10 dígitos
  if (telefono.startsWith("521") && telefono.length === 13) {
    return telefono;
  }

  // Si viene como 52 + 10 dígitos, convertir a 521 + 10 dígitos
  if (telefono.startsWith("52") && telefono.length === 12) {
    return `521${telefono.slice(2)}`;
  }

  // Si viene solo 10 dígitos
  if (telefono.length === 10) {
    return `521${telefono}`;
  }

  return telefono;
}

function obtenerEstado(envio: any) {
  return String(
    envio.estado_17track ||
      envio.estatus_actual ||
      envio.ultimo_estado_enviado ||
      ""
  ).trim();
}

function mensajePorEstado(envio: any) {
  const estadoActual = obtenerEstado(envio);
  const estado = estadoActual.toLowerCase();

  let textoEstado = "tu envío ha sido actualizado.";

  if (estado.includes("entregado") || estado.includes("delivered")) {
    textoEstado = "tu paquete aparece como ENTREGADO ✅";
  } else if (
    estado.includes("transito") ||
    estado.includes("tránsito") ||
    estado.includes("in transit")
  ) {
    textoEstado = "tu paquete ya va EN TRÁNSITO 🚚";
  } else if (
    estado.includes("enviado") ||
    estado.includes("shipped") ||
    estado.includes("picked")
  ) {
    textoEstado = "tu paquete ya fue ENVIADO 📦";
  } else if (estado.includes("pendiente")) {
    textoEstado = "tu guía sigue en estado PENDIENTE ⏳";
  }

  return `📦 VIPACK Envíos

Hola ${envio.cliente || "cliente"} 👋

Te compartimos una actualización de tu envío:

${textoEstado}

🔢 Guía: ${envio.guia || "sin guía"}
🚚 Paquetería: ${envio.paqueteria || "sin paquetería"}
📍 Estado actual: ${estadoActual || "sin estado"}

Gracias por confiar en VIPACK 💜`;
}

export async function POST(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Falta el ID del envío" },
        { status: 400 }
      );
    }

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

    const { data: envio, error } = await supabase
      .from("envios")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !envio) {
      return NextResponse.json(
        {
          success: false,
          error: "No se encontró el envío",
          detalle: error?.message || null,
          id,
        },
        { status: 404 }
      );
    }

    const telefono = limpiarTelefono(envio.telefono_whatsapp);
    const estadoActual = obtenerEstado(envio);

    console.log("DEBUG TELEFONO:", {
      original: envio.telefono_whatsapp,
      limpio: telefono,
      destino: `whatsapp:+${telefono}`,
    });

    if (!telefono || telefono.length !== 13 || !telefono.startsWith("521")) {
      return NextResponse.json(
        {
          success: false,
          error: `Teléfono inválido para WhatsApp México: ${envio.telefono_whatsapp}`,
          telefono_limpio: telefono,
        },
        { status: 400 }
      );
    }

    if (!estadoActual) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El envío no tiene estado_17track. Escribe Enviado, En tránsito o Entregado antes de mandar.",
        },
        { status: 400 }
      );
    }

    const mensaje = mensajePorEstado(envio);

    const message = await client.messages.create({
  from: fromWhatsApp,
  to: `whatsapp:+${telefono}`,
  contentSid: "HX23277e717da845d5b292d5c196900566",
  contentVariables: JSON.stringify({
    "1": String(envio.cliente || "Cliente"),
    "2": String(envio.pedido || "Sin pedido"),
    "3": String(envio.paqueteria || "Sin paquetería"),
    "4": String(envio.guia || "Sin guía"),
    "5": String(estadoActual || "Sin estado"),
  }),
});

    console.log("TWILIO RESPUESTA:", {
      sid: message.sid,
      status: message.status,
      to: message.to,
      from: message.from,
    });

    const { error: updateError } = await supabase
      .from("envios")
      .update({
        ultimo_whatsapp: `Actualización enviada: ${estadoActual}`,
        ultimo_estado_enviado: estadoActual,
        fecha_envio: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error actualizando Supabase:", updateError);
    }

    return NextResponse.json({
      success: true,
      message: "WhatsApp de actualización enviado correctamente",
      sid: message.sid,
      status: message.status,
      telefono: `whatsapp:+${telefono}`,
      estado: estadoActual,
    });
  } catch (error: any) {
    console.error("Error enviar actualización:", error);

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