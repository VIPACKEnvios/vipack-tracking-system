import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GUIAS_A_IMPORTAR = [
  "0719047999",
  "3147524939",
  "1521564080",
  "3859051942",
  "3279305628",
];

export async function POST(request: Request) {
  try {
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

    const resultados = [];

    for (const guia of GUIAS_A_IMPORTAR) {
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
              courier_code: "estafetausa",
              order_number: guia,
            }),
          }
        );

        const data = await response.json();

        const mensaje = String(
          data?.meta?.message || ""
        ).toLowerCase();

        const duplicada =
          mensaje.includes("exist") ||
          mensaje.includes("duplicate");

        if (
          response.ok ||
          data?.meta?.code === 200
        ) {
          resultados.push({
            guia,
            estado: "registrada",
            respuesta: data?.meta?.message,
          });
        } else if (duplicada) {
          resultados.push({
            guia,
            estado: "ya_existia",
          });
        } else {
          resultados.push({
            guia,
            estado: "error",
            respuesta: data,
          });
        }
      } catch (error: any) {
        resultados.push({
          guia,
          estado: "error",
          error:
            error?.message ||
            "Error desconocido",
        });
      }
    }

    return NextResponse.json({
      success: true,

      resumen: {
        total: resultados.length,

        registradas: resultados.filter(
          (r) => r.estado === "registrada"
        ).length,

        ya_existian: resultados.filter(
          (r) => r.estado === "ya_existia"
        ).length,

        errores: resultados.filter(
          (r) => r.estado === "error"
        ).length,
      },

      resultados,
    });
  } catch (error: any) {
    console.error(
      "Error importando guías:",
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