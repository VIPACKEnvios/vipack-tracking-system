import {
  NextRequest,
  NextResponse,
} from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EstadoBazar =
  | "pendiente"
  | "activo"
  | "rechazado"
  | "suspendido";

type BazarActual = {
  id: string;
  folio: string;
  nombre_bazar: string;
  estado: EstadoBazar;
  observaciones: string | null;
};

const ESTADOS_VALIDOS: EstadoBazar[] = [
  "pendiente",
  "activo",
  "rechazado",
  "suspendido",
];

const NOMBRE_ADMINISTRADOR =
  process.env.ADMINISTRADOR_NOMBRE ||
  "Viridiana";

const FIRMA_ADMINISTRADOR =
  process.env.ADMINISTRADOR_FIRMA ||
  "Viridiana Málaga - Administradora VIPACK";

type ContextoRuta = {
  params: Promise<{
    id: string;
  }>;
};

function obtenerAccion(
  estado: EstadoBazar
) {
  const acciones: Record<
    EstadoBazar,
    string
  > = {
    pendiente:
      "Regresó el expediente a pendiente",
    activo:
      "Aprobó el bazar",
    rechazado:
      "Rechazó el bazar",
    suspendido:
      "Suspendió el bazar",
  };

  return acciones[estado];
}

export async function PATCH(
  request: NextRequest,
  contexto: ContextoRuta
) {
  try {
    const { id } = await contexto.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta el identificador del bazar.",
        },
        { status: 400 }
      );
    }

    const cuerpo = await request.json();

    const estado = String(
      cuerpo?.estado || ""
    )
      .trim()
      .toLowerCase() as EstadoBazar;

    const observaciones =
      typeof cuerpo?.observaciones ===
      "string"
        ? cuerpo.observaciones.trim()
        : "";

    const administradorNombre =
      typeof cuerpo?.administrador_nombre ===
        "string" &&
      cuerpo.administrador_nombre.trim()
        ? cuerpo.administrador_nombre.trim()
        : NOMBRE_ADMINISTRADOR;

    const administradorFirma =
      typeof cuerpo?.administrador_firma ===
        "string" &&
      cuerpo.administrador_firma.trim()
        ? cuerpo.administrador_firma.trim()
        : FIRMA_ADMINISTRADOR;

    if (
      !ESTADOS_VALIDOS.includes(estado)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El estado seleccionado no es válido.",
        },
        { status: 400 }
      );
    }

    const requiereObservacion =
      estado === "rechazado" ||
      estado === "suspendido";

    if (
      requiereObservacion &&
      !observaciones
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Debes escribir una observación para rechazar o suspender el bazar.",
        },
        { status: 400 }
      );
    }

    /*
     * Consultar el estado actual antes de modificarlo.
     */
    const {
      data: bazarActual,
      error: errorConsulta,
    } = await supabaseAdmin
      .from("bazares")
      .select(`
        id,
        folio,
        nombre_bazar,
        estado,
        observaciones
      `)
      .eq("id", id)
      .single();

    if (
      errorConsulta ||
      !bazarActual
    ) {
      console.error(
        "Error consultando el bazar:",
        errorConsulta
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se encontró el bazar solicitado.",
        },
        { status: 404 }
      );
    }

    const bazar =
      bazarActual as BazarActual;

    if (bazar.estado === estado) {
      return NextResponse.json(
        {
          success: false,
          error: `El bazar ya se encuentra en estado ${estado}.`,
        },
        { status: 409 }
      );
    }

    const fechaMovimiento =
      new Date().toISOString();

    const cambios: Record<
      string,
      string | null
    > = {
      estado,
      observaciones:
        observaciones || null,
      fecha_actualizacion:
        fechaMovimiento,
      ultimo_movimiento_por:
        administradorNombre,
    };

    /*
     * Estos datos se guardan cuando el
     * expediente es aprobado.
     */
    if (estado === "activo") {
      cambios.aprobado_por =
        administradorNombre;

      cambios.firma_administrador =
        administradorFirma;

      cambios.fecha_aprobacion =
        fechaMovimiento;
    }

    const {
      data: bazarActualizado,
      error: errorActualizacion,
    } = await supabaseAdmin
      .from("bazares")
      .update(cambios)
      .eq("id", id)
      .select(`
        id,
        folio,
        nombre_bazar,
        estado,
        observaciones,
        aprobado_por,
        firma_administrador,
        fecha_aprobacion,
        ultimo_movimiento_por,
        fecha_actualizacion
      `)
      .single();

    if (
      errorActualizacion ||
      !bazarActualizado
    ) {
      console.error(
        "Error actualizando el bazar:",
        errorActualizacion
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No fue posible actualizar el estado del bazar.",
        },
        { status: 500 }
      );
    }

    /*
     * Registrar el movimiento en la bitácora.
     */
    const {
      error: errorHistorial,
    } = await supabaseAdmin
      .from("bazares_historial")
      .insert({
        bazar_id: bazar.id,
        folio: bazar.folio,
        nombre_bazar:
          bazar.nombre_bazar,
        estado_anterior:
          bazar.estado,
        estado_nuevo: estado,
        observaciones:
          observaciones || null,
        accion:
          obtenerAccion(estado),
        administrador_nombre:
          administradorNombre,
        administrador_firma:
          administradorFirma,
        fecha_movimiento:
          fechaMovimiento,
      });

    if (errorHistorial) {
      console.error(
        "Error guardando la bitácora:",
        errorHistorial
      );

      /*
       * Revertir el cambio si no fue posible
       * guardar el historial.
       */
      const {
        error: errorReversion,
      } = await supabaseAdmin
        .from("bazares")
        .update({
          estado: bazar.estado,
          observaciones:
            bazar.observaciones,
          fecha_actualizacion:
            new Date().toISOString(),
        })
        .eq("id", id);

      if (errorReversion) {
        console.error(
          "No fue posible revertir el cambio:",
          errorReversion
        );
      }

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo guardar la bitácora. El cambio de estado fue cancelado.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,

      bazar: bazarActualizado,

      movimiento: {
        accion:
          obtenerAccion(estado),
        estado_anterior:
          bazar.estado,
        estado_nuevo: estado,
        administrador:
          administradorNombre,
        firma:
          administradorFirma,
        fecha:
          fechaMovimiento,
      },

      mensaje: `El bazar cambió de ${bazar.estado} a ${estado}.`,
    });
  } catch (error) {
    console.error(
      "Error en la API de estado del bazar:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible actualizar el bazar.",
      },
      { status: 500 }
    );
  }
}