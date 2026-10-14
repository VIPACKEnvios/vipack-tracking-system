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
  calle?: string;
  numero_exterior?: string;
  numero_interior?: string;
  colonia?: string;
  delegacion?: string;
  codigo_postal?: string;
  ciudad?: string;
  estado?: string;
};

const CAMPOS_DOMICILIO = [
  "calle", "numero_exterior", "numero_interior", "colonia",
  "delegacion", "codigo_postal", "ciudad", "estado",
] as const;

type CampoDomicilio = (typeof CAMPOS_DOMICILIO)[number];
type Domicilio = Record<CampoDomicilio, string | null>;

function soloDigitos(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "");
}

function normalizarTelefonoWhatsApp(valor: unknown): string {
  const telefono = soloDigitos(valor);
  if (telefono.startsWith("521") && telefono.length === 13) return telefono;
  if (telefono.startsWith("52") && telefono.length === 12) return `521${telefono.slice(2)}`;
  if (telefono.length === 10) return `521${telefono}`;
  return "";
}

function variantesTelefonoMexico(telefono: string): string[] {
  if (!telefono.startsWith("521") || telefono.length !== 13) return [telefono];
  const nacional = telefono.slice(3);
  return [telefono, `52${nacional}`, nacional];
}

function limpiarTexto(valor: unknown): string {
  return String(valor ?? "").trim().replace(/\s+/g, " ");
}

function generarFolio(): string {
  const ahora = new Date();
  const fecha = `${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, "0")}${String(ahora.getDate()).padStart(2, "0")}`;
  const sufijo = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `CLI-${fecha}-${sufijo}`;
}

function respuestaError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: Request) {
  try {
    const body: RegistroClienteBody = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return respuestaError("Los datos del registro no son válidos.", 400);
    }

    const nombre = limpiarTexto(body.nombre);
    const telefono = normalizarTelefonoWhatsApp(body.telefono);
    const referenciaDomicilio = limpiarTexto(body.referencia_domicilio);

    // El formulario anterior solo enviaba "direccion".
    // El formulario nuevo envía campos separados, incluido "estado" geográfico.
    const hayCamposSeparados = CAMPOS_DOMICILIO.some(
      (campo) => body[campo] !== undefined
    );

    const domicilio: Domicilio = {
      calle: null,
      numero_exterior: null,
      numero_interior: null,
      colonia: null,
      delegacion: null,
      codigo_postal: null,
      ciudad: null,
      estado: null,
    };

    if (hayCamposSeparados) {
      for (const campo of CAMPOS_DOMICILIO) {
        const valor = body[campo];
        if (valor !== undefined && valor !== null && typeof valor !== "string") {
          return respuestaError(`Dato inválido: ${campo}.`, 400);
        }
        const limpio = limpiarTexto(valor);
        if (limpio.length > 200) {
          return respuestaError(`El campo ${campo} es demasiado largo.`, 400);
        }
        domicilio[campo] = limpio || null;
      }
    }

    if (nombre.length < 3 || nombre.length > 200) {
      return respuestaError("Ingresa tu nombre completo válido.", 400);
    }
    if (!telefono) {
      return respuestaError("Ingresa un teléfono mexicano válido de 10 dígitos.", 400);
    }
    if (!referenciaDomicilio || referenciaDomicilio.length > 500) {
      return respuestaError("Ingresa una referencia del domicilio válida.", 400);
    }

    if (hayCamposSeparados && domicilio.codigo_postal && !/^\d{5}$/.test(domicilio.codigo_postal)) {
      return respuestaError("El código postal debe tener 5 dígitos.", 400);
    }

    // Se conserva la dirección completa para Excel, inventario y sistemas anteriores.
    // Cuando llegan campos separados, estos son la fuente de la dirección completa.
    const direccionSeparada = [
      [domicilio.calle, domicilio.numero_exterior, domicilio.numero_interior]
        .filter(Boolean).join(" "),
      domicilio.colonia,
      domicilio.delegacion,
      domicilio.codigo_postal ? `C.P. ${domicilio.codigo_postal}` : "",
      domicilio.ciudad,
      domicilio.estado,
    ].filter(Boolean).join(", ");

    const direccion = hayCamposSeparados
      ? direccionSeparada || limpiarTexto(body.direccion)
      : limpiarTexto(body.direccion);

    if (!direccion || direccion.length > 1000) {
      return respuestaError("Ingresa tu dirección completa válida.", 400);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return respuestaError("Falta configuración de Supabase.", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existente, error: buscarError } = await supabase
      .from("solicitudes_clientes")
      .select("id, folio, estado, telefono")
      .in("telefono", variantesTelefonoMexico(telefono))
      .in("estado", ["pendiente", "procesando", "aprobado"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (buscarError) {
      console.error("Error revisando solicitud cliente:", buscarError);
      return NextResponse.json({
        success: false,
        error: "No fue posible revisar el registro.",
        detalle: buscarError.message,
      }, { status: 500 });
    }

    if (existente) {
      const mensaje = existente.estado === "aprobado"
        ? "Este número de teléfono ya pertenece a un cliente registrado."
        : existente.estado === "procesando"
          ? "Este número de teléfono tiene una solicitud en proceso de aprobación."
          : "Ya existe una solicitud pendiente con este número de teléfono.";
      return NextResponse.json({
        success: false,
        error: mensaje,
        folio: existente.folio,
      }, { status: 409 });
    }

    const folio = generarFolio();
    const camposSeparados = hayCamposSeparados ? {
      calle: domicilio.calle,
      numero_exterior: domicilio.numero_exterior,
      numero_interior: domicilio.numero_interior,
      colonia: domicilio.colonia,
      delegacion: domicilio.delegacion,
      codigo_postal: domicilio.codigo_postal,
      ciudad: domicilio.ciudad,
      // No sobrescribir "estado": se usa para pendiente/procesando/aprobado.
      estado_domicilio: domicilio.estado,
    } : {};

    const { data: solicitud, error: insertError } = await supabase
      .from("solicitudes_clientes")
      .insert({
        folio,
        nombre,
        telefono,
        direccion,
        referencia_domicilio: referenciaDomicilio,
        ...camposSeparados,
        estado: "pendiente",
        updated_at: new Date().toISOString(),
      })
      .select("id, folio, estado, telefono")
      .single();

    if (insertError || !solicitud) {
      console.error("Error creando solicitud cliente:", insertError);
      return NextResponse.json({
        success: false,
        error: "No fue posible guardar el registro.",
        detalle: insertError?.message ?? "No se confirmó el registro.",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      id: solicitud.id,
      folio: solicitud.folio,
      estado: solicitud.estado,
      telefono: solicitud.telefono,
    });
  } catch (error: unknown) {
    console.error("Error API registro-cliente:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido.",
    }, { status: 500 });
  }
}