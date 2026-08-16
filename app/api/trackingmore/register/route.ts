import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function limpiarGuia(valor: unknown) {
  return String(valor || "")
    .replace(/\D/g, "")
    .trim();
}

function obtenerCourierCode(paqueteria: string) {
  const p = String(paqueteria || "")
    .trim()
    .toUpperCase();

  if (p.includes("ESTAFETA")) {
    return "estafetausa";
  }

  if (p.includes("DHL")) {
    return "dhl";
  }

  return "";
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const auth = cookieStore.get("vipack-auth");

    if (!auth) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const apiKey =
      process.env.TRACKINGMORE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configurar TRACKINGMORE_API_KEY.",
        },
        {
          status: 500,
        }
      );
    }

    let body: any;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "El cuerpo de la solicitud no es JSON válido.",
        },
        {
          status: 400,
        }
      );
    }

    const trackingNumber =
      limpiarGuia(body?.guia);

    const paqueteria =
      String(body?.paqueteria || "").trim();

    if (!trackingNumber) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta el número de guía.",
        },
        {
          status: 400,
        }
      );
    }

    if (!paqueteria) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta la paquetería.",
        },
        {
          status: 400,
        }
      );
    }

    const courierCode =
      obtenerCourierCode(paqueteria);

    if (!courierCode) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Paquetería todavía no configurada en TrackingMore: ${paqueteria}`,
        },
        {
          status: 400,
        }
      );
    }

    const response =
      await fetch(
        "https://api.trackingmore.com/v4/trackings/create",
        {
          method: "POST",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            "Tracking-Api-Key":
              apiKey,
          },

          body: JSON.stringify({
            tracking_number:
              trackingNumber,

            courier_code:
              courierCode,

            order_number:
              trackingNumber,
          }),

          cache: "no-store",
        }
      );

    const rawText =
      await response.text();

    let data: any;

    try {
      data =
        JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        {
          success: false,

          error:
            "TrackingMore respondió con un formato inválido.",

          respuesta:
            rawText.slice(
              0,
              500
            ),
        },
        {
          status: 502,
        }
      );
    }

    /*
     * TrackingMore puede devolver información útil
     * aunque HTTP sea 200 y meta.code tenga otro valor,
     * por eso devolvemos también meta y data completos.
     */
    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,

          error:
            `TrackingMore respondió HTTP ${response.status}.`,

          tracking_number:
            trackingNumber,

          courier_code:
            courierCode,

          respuesta:
            data,
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json({
      success:
        data?.meta?.code === 200,

      tracking_number:
        trackingNumber,

      courier_code:
        courierCode,

      meta:
        data?.meta || null,

      tracking:
        data?.data || null,
    });
  } catch (error: unknown) {
    console.error(
      "Error TrackingMore register:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido.",
      },
      {
        status: 500,
      }
    );
  }
}