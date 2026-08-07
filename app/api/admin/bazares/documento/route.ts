import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getSupabaseAdmin,
} from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_DOCUMENTOS =
  "documentos-bazares";

const DURACION_URL_SEGUNDOS =
  60 * 5;

function limpiarRuta(valor: string) {
  return valor
    .trim()
    .replace(/^\/+/, "");
}

export async function GET(
  request: NextRequest
) {
  try {
    const supabaseAdmin =
      getSupabaseAdmin();

    const { searchParams } =
      new URL(request.url);

    const ruta = limpiarRuta(
      String(
        searchParams.get("ruta") || ""
      )
    );

    if (!ruta) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se recibió la ruta del documento.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      ruta.includes("..") ||
      ruta.startsWith("http://") ||
      ruta.startsWith("https://")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La ruta del documento no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data,
      error,
    } = await supabaseAdmin.storage
      .from(BUCKET_DOCUMENTOS)
      .createSignedUrl(
        ruta,
        DURACION_URL_SEGUNDOS
      );

    if (
      error ||
      !data?.signedUrl
    ) {
      console.error(
        "Error generando URL firmada:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error?.message ||
            "No fue posible abrir el documento.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      url: data.signedUrl,
      expira_en_segundos:
        DURACION_URL_SEGUNDOS,
    });
  } catch (error) {
    console.error(
      "Error consultando documento:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar el documento.",
      },
      {
        status: 500,
      }
    );
  }
}