import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function obtenerCourier(paqueteria: string) {
  const p = String(paqueteria || "").toUpperCase();

  if (p.includes("ESTAFETA")) return "estafetausa";
  if (p.includes("DHL")) return "dhl";

  return null;
}

export async function POST(request: Request) {
  try {
    // Protección para que nadie pueda ejecutar la importación públicamente
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret");

    if (
      !process.env.TRACKINGMORE_WEBHOOK_SECRET ||
      secret !== process.env.TRACKINGMORE_WEBHOOK_SECRET
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado",
        },
        { status: 401 }
      );
    }

    if (!process.env.TRACKINGMORE_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "Falta TRACKINGMORE_API_KEY",
        },
        { status: 500 }
      );
    }

    // Buscar únicamente envíos que todavía pueden tener movimiento
    const { data: envios, error } = await supabase
      .from("envios")
      .select("id, guia, paqueteria, estatus_actual")
      .in("estatus_actual", [
        "Enviado",
        "Recolectado",
        "En tránsito",
        "En reparto",
        "En espera",
      ])
      .order("id", { ascending: false });

    if (error) {
      throw error;
    }

    const resultados: any[] = [];

    for (const envio of envios || []) {
      const guia = String(envio.guia || "")
        .replace(/\s+/g, "")
        .trim();

      const courier = obtenerCourier(envio.paqueteria);

      if (!guia) {
        resultados.push({
          id: envio.id,
          estado: "omitida",
          motivo: "Sin guía",
        });

        continue;
      }

      if (!courier) {
        resultados.push({
          id: envio.id,
          guia,
          estado: "omitida",
          motivo: `Paquetería no compatible: ${envio.paqueteria}`,
        });

        continue;
      }

      try {
        const response = await fetch(
          "https://api.trackingmore.com/v4/trackings/create",
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "Tracking-Api-Key":
                process.env.TRACKINGMORE_API_KEY,
            },
            body: JSON.stringify({
              tracking_number: guia,
              courier_code: courier,
              order_number: guia,
            }),
          }
        );

        const data = await response.json();

        /*
         * TrackingMore puede responder que la guía ya existe.
         * No lo consideramos un problema para esta importación.
         */
        const mensaje = String(
          data?.meta?.message || ""
        ).toLowerCase();

        const duplicada =
          mensaje.includes("exist") ||
          mensaje.includes("duplicate");

        if (response.ok || data?.meta?.code === 200) {
          resultados.push({
            id: envio.id,
            guia,
            courier,
            estado: "registrada",
          });
        } else if (duplicada) {
          resultados.push({
            id: envio.id,
            guia,
            courier,
            estado: "ya_existia",
          });
        } else {
          resultados.push({
            id: envio.id,
            guia,
            courier,
            estado: "error",
            respuesta: data,
          });
        }
      } catch (trackingError: any) {
        resultados.push({
          id: envio.id,
          guia,
          courier,
          estado: "error",
          error:
            trackingError?.message ||
            "Error desconocido",
        });
      }
    }

    const resumen = {
      total: resultados.length,
      registradas: resultados.filter(
        (r) => r.estado === "registrada"
      ).length,
      ya_existian: resultados.filter(
        (r) => r.estado === "ya_existia"
      ).length,
      omitidas: resultados.filter(
        (r) => r.estado === "omitida"
      ).length,
      errores: resultados.filter(
        (r) => r.estado === "error"
      ).length,
    };

    return NextResponse.json({
      success: true,
      resumen,
      resultados,
    });
  } catch (error: any) {
    console.error(
      "Error importando guías a TrackingMore:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}