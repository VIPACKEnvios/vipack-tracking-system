import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getSupabaseAdmin,
} from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ESTADOS_VALIDOS = [
  "pendiente",
  "activo",
  "rechazado",
  "suspendido",
];

export async function GET(
  request: NextRequest
) {
  try {
    const supabaseAdmin =
      getSupabaseAdmin();

    const { searchParams } =
      new URL(request.url);

    const busqueda =
      searchParams
        .get("buscar")
        ?.trim() || "";

    const estado =
      searchParams
        .get("estado")
        ?.trim() || "";

    let consulta = supabaseAdmin
      .from("bazares")
      .select(`
        id,
        folio,
        nombre_responsable,
        telefono,
        direccion,
        nombre_bazar,
        correo,
        productos,
        facebook,
        referencia_1_nombre,
        referencia_1_telefono,
        referencia_2_nombre,
        referencia_2_telefono,
        ine_frente_archivo,
        comprobante_domicilio_archivo,
        estado,
        observaciones,
        fecha_registro,
        fecha_actualizacion
      `)
      .order("fecha_registro", {
        ascending: false,
      });

    if (
      estado &&
      ESTADOS_VALIDOS.includes(estado)
    ) {
      consulta =
        consulta.eq(
          "estado",
          estado
        );
    }

    if (busqueda) {
      const textoSeguro =
        busqueda
          .replace(
            /[%(),]/g,
            " "
          )
          .trim();

      consulta =
        consulta.or(
          [
            `folio.ilike.%${textoSeguro}%`,
            `nombre_bazar.ilike.%${textoSeguro}%`,
            `nombre_responsable.ilike.%${textoSeguro}%`,
            `telefono.ilike.%${textoSeguro}%`,
          ].join(",")
        );
    }

    const {
      data,
      error,
    } = await consulta;

    if (error) {
      console.error(
        "Error consultando bazares:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No fue posible consultar los bazares registrados.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      bazares: data || [],
      total:
        data?.length || 0,
    });
  } catch (error) {
    console.error(
      "Error en API administrativa:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible cargar los bazares.",
      },
      {
        status: 500,
      }
    );
  }
}