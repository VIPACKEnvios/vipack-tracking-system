import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function obtenerCarrier(paqueteria: string) {
  const p = String(paqueteria || "").toUpperCase();

  if (p.includes("DHL")) return 100001;
 if (p.includes("ESTAFETA")) return undefined;
  if (p.includes("FEDEX")) return 100003;

  return undefined;
}

export async function GET() {
  try {
    const { data: envios, error } = await supabase
      .from("envios")
      .select("guia, paqueteria")
      .eq("entregado", false);

    if (error) throw error;

    const guias = (envios || [])
      .map((envio: any) => ({
        number: String(envio.guia || "").replace(/\D/g, ""),
        carrier: obtenerCarrier(envio.paqueteria),
      }))
      .filter((item: any) => item.number && item.carrier);

    const response = await fetch(
      "https://api.17track.net/track/v2/register",
      {
        method: "POST",
        headers: {
          "17token": process.env.TRACK17_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(guias),
      }
    );

    const data = await response.json();

    return NextResponse.json({
      success: true,
      total: guias.length,
      enviado_a_17track: guias,
      respuesta: data,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}