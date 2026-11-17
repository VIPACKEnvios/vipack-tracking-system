import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ResultadoAutorizacion =
  | { autorizado: true; recolectorId: string; folio: string }
  | { autorizado: false; status: number; error: string };

export async function autorizarEvidenciaRecolector(
  authorization: string,
  folioRaw: string
): Promise<ResultadoAutorizacion> {
  const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];

  if (!token) {
    return {
      autorizado: false,
      status: 401,
      error: "Token de acceso requerido.",
    };
  }

  const folio = folioRaw.trim();

  if (!/^[A-Za-z0-9_-]{1,100}$/.test(folio)) {
    return {
      autorizado: false,
      status: 400,
      error: "Folio invalido.",
    };
  }

  const supabase = getSupabaseAdmin();

  const { data: autenticacion, error: errorAuth } =
    await supabase.auth.getUser(token);

  if (errorAuth || !autenticacion.user) {
    return {
      autorizado: false,
      status: 401,
      error: "Sesion no valida.",
    };
  }

  const recolectorId = autenticacion.user.id;

  const { data: recolector, error: errorRecolector } =
    await supabase
      .from("recolectores")
      .select("id")
      .eq("id", recolectorId)
      .eq("activo", true)
      .eq("rol", "recolector")
      .maybeSingle();

  if (errorRecolector) {
    throw errorRecolector;
  }

  if (!recolector) {
    return {
      autorizado: false,
      status: 403,
      error: "Recolector no autorizado.",
    };
  }

  const { data: asignacion, error: errorAsignacion } =
    await supabase
      .from("recolecciones_asignadas")
      .select("folio")
      .eq("recolector_id", recolectorId)
      .eq("folio", folio)
      .limit(1)
      .maybeSingle();

  if (errorAsignacion) {
    throw errorAsignacion;
  }

  if (!asignacion) {
    return {
      autorizado: false,
      status: 403,
      error: "La recoleccion no esta asignada a este recolector.",
    };
  }

  const { data: eliminada, error: errorEliminada } =
    await supabase
      .from("recolecciones_eliminadas")
      .select("folio")
      .eq("folio", folio)
      .limit(1)
      .maybeSingle();

  if (errorEliminada) {
    throw errorEliminada;
  }

  if (eliminada) {
    return {
      autorizado: false,
      status: 403,
      error: "La recoleccion fue eliminada.",
    };
  }

  return {
    autorizado: true,
    recolectorId,
    folio,
  };
}