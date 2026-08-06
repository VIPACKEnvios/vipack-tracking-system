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
  estado?: EstadoBazar | string;
  observaciones?: string;
};

type BazarExistente = {
  id: string;
  nombre_bazar: string | null;
  telefono: string | null;
  nombre_responsable: string | null;
  direccion: string | null;
  correo: string | null;
  productos: string | null;
  facebook: string | null;
  referencia_1_nombre: string | null;
  referencia_1_telefono: string | null;
  referencia_2_nombre: string | null;
  referencia_2_telefono: string | null;
  estado: EstadoBazar | null;
  observaciones: string | null;
};

const ESTADOS_PERMITIDOS: EstadoBazar[] = [
  "pendiente",
  "activo",
  "rechazado",
  "suspendido",
];

function limpiarTexto(valor: unknown) {
  return String(valor ?? "").trim();
}

function limpiarTelefono(valor: unknown) {
  return String(valor ?? "")
    .replace(/\D/g, "")
    .trim();
}

function normalizarTexto(valor: unknown) {
  return limpiarTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function obtenerEstado(
  valor: unknown
): EstadoBazar {
  const estado = limpiarTexto(
    valor
  ).toLowerCase() as EstadoBazar;

  return ESTADOS_PERMITIDOS.includes(estado)
    ? estado
    : "activo";
}

/**
 * Solo agrega al objeto los campos que tienen
 * información. Así no reemplazamos datos existentes
 * con cadenas vacías.
 */
function crearCambios(
  registro: RegistroImportacion
) {
  const cambios: Record<string, string> = {};

  const camposTexto: Array<
    keyof RegistroImportacion
  > = [
    "nombre_responsable",
    "direccion",
    "correo",
    "productos",
    "facebook",
    "referencia_1_nombre",
    "referencia_2_nombre",
  ];

  for (const campo of camposTexto) {
    const valor = limpiarTexto(registro[campo]);

    if (valor) {
      cambios[campo] =
        campo === "correo"
          ? valor.toLowerCase()
          : valor;
    }
  }

  const camposTelefono: Array<
    keyof RegistroImportacion
  > = [
    "telefono",
    "referencia_1_telefono",
    "referencia_2_telefono",
  ];

  for (const campo of camposTelefono) {
    const valor = limpiarTelefono(
      registro[campo]
    );

    if (valor) {
      cambios[campo] = valor;
    }
  }

  const observaciones = limpiarTexto(
    registro.observaciones
  );

  if (observaciones) {
    cambios.observaciones = observaciones;
  }

  cambios.estado = obtenerEstado(
    registro.estado
  );

  cambios.fecha_actualizacion =
    new Date().toISOString();

  return cambios;
}

function prepararRegistroNuevo(
  registro: RegistroImportacion
) {
  return {
    nombre_responsable: limpiarTexto(
      registro.nombre_responsable
    ),

    telefono: limpiarTelefono(
      registro.telefono
    ),

    direccion: limpiarTexto(
      registro.direccion
    ),

    nombre_bazar: limpiarTexto(
      registro.nombre_bazar
    ),

    correo:
      limpiarTexto(registro.correo)
        .toLowerCase() || null,

    productos: limpiarTexto(
      registro.productos
    ),

    facebook: limpiarTexto(
      registro.facebook
    ),

    referencia_1_nombre: limpiarTexto(
      registro.referencia_1_nombre
    ),

    referencia_1_telefono:
      limpiarTelefono(
        registro.referencia_1_telefono
      ),

    referencia_2_nombre: limpiarTexto(
      registro.referencia_2_nombre
    ),

    referencia_2_telefono:
      limpiarTelefono(
        registro.referencia_2_telefono
      ),

    estado: obtenerEstado(
      registro.estado
    ),

    observaciones:
      limpiarTexto(
        registro.observaciones
      ) || null,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const cuerpo = await request.json();

    const registros: RegistroImportacion[] =
      Array.isArray(cuerpo?.registros)
        ? cuerpo.registros
        : [];

    if (registros.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se recibieron registros para importar.",
        },
        { status: 400 }
      );
    }

    if (registros.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Solo se permiten hasta 500 registros por importación.",
        },
        { status: 400 }
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("bazares")
        .select(`
          id,
          nombre_bazar,
          telefono,
          nombre_responsable,
          direccion,
          correo,
          productos,
          facebook,
          referencia_1_nombre,
          referencia_1_telefono,
          referencia_2_nombre,
          referencia_2_telefono,
          estado,
          observaciones
        `);

    if (error) {
      console.error(
        "Error consultando bazares existentes:",
        error
      );

      throw new Error(
        "No fue posible consultar los bazares existentes."
      );
    }

    const bazaresExistentes =
      (data || []) as BazarExistente[];

    let nuevos = 0;
    let actualizados = 0;
    let omitidos = 0;
    let errores = 0;

    const detalles: Array<{
      nombre_bazar: string;
      resultado:
        | "nuevo"
        | "actualizado"
        | "omitido"
        | "error";
      mensaje: string;
    }> = [];

    /*
     * También agregamos a este arreglo los registros
     * nuevos conforme se crean, para evitar duplicados
     * dentro del mismo archivo.
     */
    const listaComparacion = [
      ...bazaresExistentes,
    ];

    for (const registro of registros) {
      const nombreBazar = limpiarTexto(
        registro.nombre_bazar
      );

      const nombreNormalizado =
        normalizarTexto(nombreBazar);

      const telefono = limpiarTelefono(
        registro.telefono
      );

      if (!nombreBazar) {
        omitidos++;

        detalles.push({
          nombre_bazar:
            "Registro sin nombre",
          resultado: "omitido",
          mensaje:
            "No contiene nombre del bazar.",
        });

        continue;
      }

      try {
        const existente =
          listaComparacion.find(
            (bazar) => {
              const mismoNombre =
                normalizarTexto(
                  bazar.nombre_bazar
                ) === nombreNormalizado;

              const mismoTelefono =
                Boolean(telefono) &&
                limpiarTelefono(
                  bazar.telefono
                ) === telefono;

              return (
                mismoNombre ||
                mismoTelefono
              );
            }
          );

        if (existente) {
          const cambios =
            crearCambios(registro);

          const {
            error: errorActualizacion,
          } = await supabaseAdmin
            .from("bazares")
            .update(cambios)
            .eq("id", existente.id);

          if (errorActualizacion) {
            throw new Error(
              errorActualizacion.message
            );
          }

          Object.assign(
            existente,
            cambios
          );

          actualizados++;

          detalles.push({
            nombre_bazar: nombreBazar,
            resultado: "actualizado",
            mensaje:
              "El bazar ya existía y se actualizó sin borrar sus documentos.",
          });

          continue;
        }

        const registroNuevo =
          prepararRegistroNuevo(registro);

        const {
          data: nuevoBazar,
          error: errorInsercion,
        } = await supabaseAdmin
          .from("bazares")
          .insert(registroNuevo)
          .select("id, nombre_bazar, telefono")
          .single();

        if (
          errorInsercion ||
          !nuevoBazar
        ) {
          throw new Error(
            errorInsercion?.message ||
              "No fue posible crear el bazar."
          );
        }

        listaComparacion.push({
          id: nuevoBazar.id,
          nombre_bazar:
            nuevoBazar.nombre_bazar,
          telefono:
            nuevoBazar.telefono,
          nombre_responsable:
            registroNuevo.nombre_responsable,
          direccion:
            registroNuevo.direccion,
          correo:
            registroNuevo.correo,
          productos:
            registroNuevo.productos,
          facebook:
            registroNuevo.facebook,
          referencia_1_nombre:
            registroNuevo.referencia_1_nombre,
          referencia_1_telefono:
            registroNuevo.referencia_1_telefono,
          referencia_2_nombre:
            registroNuevo.referencia_2_nombre,
          referencia_2_telefono:
            registroNuevo.referencia_2_telefono,
          estado:
            registroNuevo.estado,
          observaciones:
            registroNuevo.observaciones,
        });

        nuevos++;

        detalles.push({
          nombre_bazar: nombreBazar,
          resultado: "nuevo",
          mensaje:
            "Bazar agregado correctamente.",
        });
      } catch (errorRegistro) {
        errores++;

        console.error(
          `Error importando ${nombreBazar}:`,
          errorRegistro
        );

        detalles.push({
          nombre_bazar: nombreBazar,
          resultado: "error",
          mensaje:
            errorRegistro instanceof Error
              ? errorRegistro.message
              : "No fue posible importar el registro.",
        });
      }
    }

    return NextResponse.json({
      success: true,

      resumen: {
        recibidos: registros.length,
        nuevos,
        actualizados,
        omitidos,
        errores,
      },

      detalles,
    });
  } catch (error) {
    console.error(
      "Error en la importación:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "No fue posible completar la importación.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    mensaje:
      "La API de importación de bazares está funcionando.",
  });
}