import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verificarSesionAdmin } from "@/lib/vipack-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegistroImportacion = {
  nombre_responsable?: string;
  telefono?: string;
  direccion?: string;
  nombre_bazar?: string;
  correo?: string;
  productos?: string;
  facebook?: string;
  referencia_1_nombre?: string;
  referencia_1_telefono?: string;
  referencia_2_nombre?: string;
  referencia_2_telefono?: string;
  estado?: string;
  observaciones?: string;
};

type BazarExistente = {
  id: string;
  nombre_bazar: string | null;
  telefono: string | null;
  correo: string | null;
  facebook: string | null;
};

type Resultado = "nuevo" | "omitido" | "revision" | "incompleto" | "error";
type Detalle = {
  fila: number;
  nombre_bazar: string;
  resultado: Resultado;
  mensaje: string;
};

function texto(valor: unknown): string {
  return typeof valor === "string" || typeof valor === "number"
    ? String(valor).trim()
    : "";
}

function normalizar(valor: unknown): string {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function telefonoNormalizado(valor: unknown): string {
  const digitos = texto(valor).replace(/\D/g, "");
  // Se comparan los 10 dígitos nacionales cuando hay prefijo +52 o 521.
  if (digitos.length === 12 && digitos.startsWith("52")) return digitos.slice(2);
  if (digitos.length === 13 && digitos.startsWith("521")) return digitos.slice(3);
  return digitos;
}

function facebookNormalizado(valor: unknown): string {
  const original = texto(valor);
  if (!original) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(original) ? original : `https://${original}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    if (!["facebook.com", "fb.com", "fb.me"].includes(host)) return "";
    const ruta = url.pathname.replace(/\/+$/, "").toLowerCase();
    if (!ruta || ruta === "/") return "";
    // No convertir enlaces de compartir, búsquedas o perfiles genéricos en identidad.
    if (/^\/(share|search|watch|reel|story|groups)\b/.test(ruta)) return "";
    if (ruta === "/profile.php") {
      const id = url.searchParams.get("id");
      return id ? `facebook.com/profile.php?id=${id}` : "";
    }
    return `facebook.com${ruta}`;
  } catch {
    return "";
  }
}

function prepararNuevo(registro: RegistroImportacion) {
  return {
    nombre_responsable: texto(registro.nombre_responsable),
    telefono: telefonoNormalizado(registro.telefono),
    direccion: texto(registro.direccion),
    nombre_bazar: texto(registro.nombre_bazar),
    correo: texto(registro.correo).toLowerCase() || null,
    productos: texto(registro.productos),
    facebook: texto(registro.facebook),
    referencia_1_nombre: texto(registro.referencia_1_nombre),
    referencia_1_telefono: telefonoNormalizado(registro.referencia_1_telefono),
    referencia_2_nombre: texto(registro.referencia_2_nombre),
    referencia_2_telefono: telefonoNormalizado(registro.referencia_2_telefono),
    // Nunca aprobar automáticamente un registro importado.
    estado: "pendiente" as const,
    observaciones: texto(registro.observaciones) || null,
  };
}

function comparar(
  registro: RegistroImportacion,
  existentes: BazarExistente[]
): { resultado: "nuevo" | "omitido" | "revision" | "incompleto"; mensaje: string } {
  const nombre = normalizar(registro.nombre_bazar);
  const responsable = texto(registro.nombre_responsable);
  const telefono = telefonoNormalizado(registro.telefono);
  if (!nombre || !responsable || telefono.length !== 10) {
    return {
      resultado: "incompleto",
      mensaje: "Se requiere nombre del bazar, responsable y teléfono mexicano de 10 dígitos.",
    };
  }

  const correo = texto(registro.correo).toLowerCase();
  const facebook = facebookNormalizado(registro.facebook);
  const coincidencias = existentes.filter((b) => {
    const mismoNombre = normalizar(b.nombre_bazar) === nombre;
    const mismoTelefono = telefonoNormalizado(b.telefono) === telefono;
    const mismoCorreo = Boolean(correo) && texto(b.correo).toLowerCase() === correo;
    const mismoFacebook = Boolean(facebook) && facebookNormalizado(b.facebook) === facebook;
    return mismoNombre || mismoTelefono || mismoCorreo || mismoFacebook;
  });

  if (coincidencias.length === 0) {
    return { resultado: "nuevo", mensaje: "Sin coincidencias detectadas." };
  }

  const coincidenciaSegura = coincidencias.some((b) => {
    const mismoNombre = normalizar(b.nombre_bazar) === nombre;
    const mismoTelefono = telefonoNormalizado(b.telefono) === telefono;
    const mismoFacebook = Boolean(facebook) && facebookNormalizado(b.facebook) === facebook;
    return (mismoNombre && mismoTelefono) || (mismoNombre && mismoFacebook);
  });

  if (coincidencias.length === 1 && coincidenciaSegura) {
    return {
      resultado: "omitido",
      mensaje: "Ya está registrado en VIPACK. Se omite sin modificar datos, documentos ni estado.",
    };
  }
  return {
    resultado: "revision",
    mensaje: "Coincide en nombre, teléfono, correo o Facebook con un registro existente; requiere revisión manual.",
  };
}

async function consultarExistentes(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<BazarExistente[]> {
  const existentes: BazarExistente[] = [];
  const tamanoPagina = 500;
  for (let inicio = 0; ; inicio += tamanoPagina) {
    const { data, error } = await supabase
      .from("bazares")
      .select("id,nombre_bazar,telefono,correo,facebook")
      .order("id", { ascending: true })
      .range(inicio, inicio + tamanoPagina - 1);
    if (error) throw new Error("No se pudieron consultar los bazares existentes.");
    const pagina = (data ?? []) as BazarExistente[];
    existentes.push(...pagina);
    if (pagina.length < tamanoPagina) break;
    if (inicio >= 100000) throw new Error("Demasiados registros para validar la importación.");
  }
  return existentes;
}

function noAutorizado() {
  return NextResponse.json(
    { success: false, error: "Sesión administrativa no válida o caducada." },
    { status: 401 }
  );
}

export async function POST(request: NextRequest) {
  if (!verificarSesionAdmin(request)) return noAutorizado();

  try {
    const cuerpo: unknown = await request.json();
    if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
      return NextResponse.json({ success: false, error: "Solicitud inválida." }, { status: 400 });
    }
    const entrada = cuerpo as { accion?: unknown; registros?: unknown };
    const accion = entrada.accion;
    if (accion !== "analizar" && accion !== "importar") {
      return NextResponse.json(
        { success: false, error: "Debes analizar el archivo y confirmar la importación desde la pantalla actualizada." },
        { status: 400 }
      );
    }
    if (!Array.isArray(entrada.registros) || entrada.registros.length < 1 || entrada.registros.length > 500) {
      return NextResponse.json(
        { success: false, error: "Envía entre 1 y 500 registros por operación." },
        { status: 400 }
      );
    }
    if (entrada.registros.some((r) => !r || typeof r !== "object" || Array.isArray(r))) {
      return NextResponse.json({ success: false, error: "Hay registros inválidos." }, { status: 400 });
    }
    const registros = entrada.registros as RegistroImportacion[];
    const supabase = getSupabaseAdmin();

    const existentes = await consultarExistentes(supabase);

    const detalles: Detalle[] = [];
    let nuevos = 0;
    let omitidos = 0;
    let revision = 0;
    let incompletos = 0;
    let errores = 0;

    for (const [indice, registro] of registros.entries()) {
      const nombre = texto(registro.nombre_bazar) || "Sin nombre";
      const evaluacion = comparar(registro, existentes);
      let resultado: Resultado = evaluacion.resultado;
      let mensaje = evaluacion.mensaje;

      if (resultado === "nuevo" && accion === "importar") {
        // Segunda comprobación inmediatamente antes de insertar.
        // Esta comprobación NO sustituye una restricción transaccional en BD.
        try {
          const ultimos = await consultarExistentes(supabase);
          const segundaRevision = comparar(registro, ultimos);
          if (segundaRevision.resultado !== "nuevo") {
            resultado = segundaRevision.resultado;
            mensaje = segundaRevision.mensaje;
          } else {
            const { data: insertado, error: errorInsercion } = await supabase
              .from("bazares")
              .insert(prepararNuevo(registro))
              .select("id,nombre_bazar,telefono,correo,facebook")
              .single();
            if (errorInsercion || !insertado) {
              resultado = "error";
              mensaje = "No fue posible guardar el bazar.";
            } else {
              existentes.push(insertado as BazarExistente);
              mensaje = "Bazar agregado con estado pendiente.";
            }
          }
        } catch {
          resultado = "error";
          mensaje = "No se pudo verificar nuevamente el registro.";
        }
      } else if (resultado === "nuevo") {
        // Durante el análisis, considerar filas anteriores del mismo archivo.
        existentes.push({
          id: `vista-previa-${indice}`,
          nombre_bazar: texto(registro.nombre_bazar),
          telefono: telefonoNormalizado(registro.telefono),
          correo: texto(registro.correo).toLowerCase() || null,
          facebook: texto(registro.facebook) || null,
        });
      }

      if (resultado === "nuevo") nuevos++;
      else if (resultado === "omitido") omitidos++;
      else if (resultado === "revision") revision++;
      else if (resultado === "incompleto") incompletos++;
      else errores++;

      detalles.push({ fila: indice + 1, nombre_bazar: nombre, resultado, mensaje });
    }

    return NextResponse.json({
      success: true,
      accion,
      resumen: {
        recibidos: registros.length,
        nuevos,
        actualizados: 0,
        omitidos,
        revision,
        incompletos,
        errores,
      },
      detalles,
    });
  } catch (error) {
    console.error("Error en importaciones de bazares:", error);
    return NextResponse.json(
      { success: false, error: "No fue posible completar la operación." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!verificarSesionAdmin(request)) return noAutorizado();
  return NextResponse.json({
    success: true,
    mensaje: "API de importación de bazares disponible.",
  });
}