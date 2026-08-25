import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RegistroClienteBody = {
  nombre?: string;
  telefono?: string;
  direccion?: string;
  referencia_domicilio?: string;
};

function limpiarTelefono(valor: unknown) {
  return String(valor || "").replace(/\D/g, "");
}

function limpiarTexto(valor: unknown) {
  return String(valor || "").trim().replace(/\s+/g, " ");
}

function generarFolio() {
  const ahora = new Date();

  const fecha =
    `${ahora.getFullYear()}` +
    `${String(ahora.getMonth() + 1).padStart(2, "0")}` +
    `${String(ahora.getDate()).padStart(2, "0")}`;

  const sufijo =
    randomUUID()
      .replace(/-/g, "")
      .slice(0, 6)
      .toUpperCase();

  return `CLI-${fecha}-${sufijo}`;
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as RegistroClienteBody;

    const nombre =
      limpiarTexto(body?.nombre);

    const telefono =
      limpiarTelefono(body?.telefono);

    const direccion =
      limpiarTexto(body?.direccion);

    const referenciaDomicilio =
      limpiarTexto(body?.referencia_domicilio);

    if (!nombre) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ingresa tu nombre completo.",
        },
        { status: 400 }
      );
    }

    if (nombre.length < 3) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El nombre no parece válido.",
        },
        { status: 400 }
      );
    }

    if (telefono.length !== 10) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El teléfono debe tener 10 dígitos.",
        },
        { status: 400 }
      );
    }

    if (!direccion) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ingresa tu dirección completa.",
        },
        { status: 400 }
      );
    }

    if (!referenciaDomicilio) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ingresa una referencia del domicilio.",
        },
        { status: 400 }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configuración de Supabase.",
        },
        { status: 500 }
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

    /*
     * Evitamos duplicados mientras exista
     * una solicitud pendiente o ya aprobada.
     */
    const {
      data: existente,
      error: buscarError,
    } =
      await supabase
        .from("solicitudes_clientes")
        .select(
          "id, folio, estado"
        )
        .eq(
          "telefono",
          telefono
        )
        .in(
          "estado",
          [
            "pendiente",
            "aprobado",
          ]
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

    if (buscarError) {
      console.error(
        "Error revisando solicitud cliente:",
        buscarError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No fue posible revisar el registro.",
          detalle:
            buscarError.message,
        },
        { status: 500 }
      );
    }

    if (existente) {
      return NextResponse.json(
        {
          success: false,
          error:
            existente.estado === "aprobado"
              ? "Este número de teléfono ya pertenece a un cliente registrado."
              : "Ya existe una solicitud pendiente con este número de teléfono.",
          folio:
            existente.folio,
        },
        { status: 409 }
      );
    }

    const folio =
      generarFolio();

    const {
      data: solicitud,
      error: insertError,
    } =
      await supabase
        .from("solicitudes_clientes")
        .insert({
          folio,
          nombre,
          telefono,
          direccion,
          referencia_domicilio:
            referenciaDomicilio,
          estado:
            "pendiente",
          updated_at:
            new Date().toISOString(),
        })
        .select(
          `
          id,
          folio,
          nombre,
          telefono,
          direccion,
          referencia_domicilio,
          estado,
          created_at
          `
        )
        .single();

    if (insertError) {
      console.error(
        "Error creando solicitud cliente:",
        insertError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No fue posible guardar el registro.",
          detalle:
            insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id:
        solicitud.id,
      folio:
        solicitud.folio,
      estado:
        solicitud.estado,
    });
  } catch (error: unknown) {
    console.error(
      "Error API registro-cliente:",
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
      { status: 500 }
    );
  }
}