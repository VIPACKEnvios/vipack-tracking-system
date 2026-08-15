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

const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const TAMANO_MAXIMO =
  10 * 1024 * 1024;

type SupabaseAdminClient =
  ReturnType<typeof getSupabaseAdmin>;

type ArchivoGuardado = {
  ruta: string;
  nombre: string;
};

function limpiarNombre(
  valor: string
) {
  const nombreLimpio = valor
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-zA-Z0-9-_ ]/g,
      ""
    )
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 70);

  return (
    nombreLimpio ||
    "Bazar_sin_nombre"
  );
}

function limpiarTelefono(
  valor: string
) {
  return valor.replace(
    /\D/g,
    ""
  );
}

function obtenerExtension(
  archivo: File
) {
  const extensionesPorTipo:
    Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "application/pdf": "pdf",
    };

  return (
    extensionesPorTipo[
      archivo.type
    ] || ""
  );
}

function validarArchivo(
  archivo: File,
  nombreDocumento: string
) {
  if (
    !TIPOS_PERMITIDOS.includes(
      archivo.type
    )
  ) {
    throw new Error(
      `${nombreDocumento}: solo se permiten archivos JPG, PNG, WEBP o PDF.`
    );
  }

  if (archivo.size <= 0) {
    throw new Error(
      `${nombreDocumento}: el archivo está vacío.`
    );
  }

  if (
    archivo.size >
    TAMANO_MAXIMO
  ) {
    throw new Error(
      `${nombreDocumento}: el archivo no puede pesar más de 10 MB.`
    );
  }

  const extension =
    obtenerExtension(archivo);

  if (!extension) {
    throw new Error(
      `${nombreDocumento}: no fue posible identificar el formato del archivo.`
    );
  }
}

async function subirDocumento({
  supabaseAdmin,
  archivo,
  folio,
  nombreBazar,
  nombreBase,
}: {
  supabaseAdmin:
    SupabaseAdminClient;
  archivo: File;
  folio: string;
  nombreBazar: string;
  nombreBase: string;
}): Promise<ArchivoGuardado> {
  validarArchivo(
    archivo,
    nombreBase
  );

  const extension =
    obtenerExtension(archivo);

  const nombreBazarLimpio =
    limpiarNombre(
      nombreBazar
    );

  const marcaTiempo =
    Date.now();

  const nombreArchivo =
    `${nombreBase}_${marcaTiempo}.${extension}`;

  const carpeta =
    `${folio}_${nombreBazarLimpio}`;

  const rutaStorage =
    `${carpeta}/${nombreArchivo}`;

  const arrayBuffer =
    await archivo.arrayBuffer();

  const contenido =
    Buffer.from(
      arrayBuffer
    );

  const {
    error,
  } =
    await supabaseAdmin
      .storage
      .from(
        BUCKET_DOCUMENTOS
      )
      .upload(
        rutaStorage,
        contenido,
        {
          contentType:
            archivo.type,

          cacheControl:
            "3600",

          upsert: false,
        }
      );

  if (error) {
    console.error(
      `Error subiendo ${nombreBase}:`,
      error
    );

    throw new Error(
      `No fue posible subir ${nombreBase}. ${error.message}`
    );
  }

  return {
    ruta:
      rutaStorage,

    nombre:
      nombreArchivo,
  };
}

async function eliminarDocumentos({
  supabaseAdmin,
  rutas,
}: {
  supabaseAdmin:
    SupabaseAdminClient;

  rutas: string[];
}) {
  const rutasValidas =
    rutas.filter(Boolean);

  if (
    rutasValidas.length === 0
  ) {
    return;
  }

  const {
    error,
  } =
    await supabaseAdmin
      .storage
      .from(
        BUCKET_DOCUMENTOS
      )
      .remove(
        rutasValidas
      );

  if (error) {
    console.error(
      "No fue posible eliminar documentos incompletos:",
      error
    );
  }
}

export async function POST(
  request: NextRequest
) {
  let registroCreadoId:
    string | null = null;

  const documentosSubidos:
    string[] = [];

  let supabaseAdmin:
    SupabaseAdminClient | null =
      null;

  try {
    /*
     * El cliente administrativo se crea
     * únicamente cuando se ejecuta la API.
     *
     * Esto evita que Vercel intente
     * inicializar Supabase durante el build.
     */
    supabaseAdmin =
      getSupabaseAdmin();

    const formData =
      await request.formData();

    const nombreResponsable =
      String(
        formData.get(
          "nombre_responsable"
        ) || ""
      ).trim();

    const telefono =
      limpiarTelefono(
        String(
          formData.get(
            "telefono"
          ) || ""
        )
      );

    const direccion =
      String(
        formData.get(
          "direccion"
        ) || ""
      ).trim();

    const nombreBazar =
      String(
        formData.get(
          "nombre_bazar"
        ) || ""
      ).trim();

    const correo =
      String(
        formData.get(
          "correo"
        ) || ""
      )
        .trim()
        .toLowerCase();

    const productos =
      String(
        formData.get(
          "productos"
        ) || ""
      ).trim();

    const facebook =
      String(
        formData.get(
          "facebook"
        ) || ""
      ).trim();

    const referencia1Nombre =
      String(
        formData.get(
          "referencia_1_nombre"
        ) || ""
      ).trim();

    const referencia1Telefono =
      limpiarTelefono(
        String(
          formData.get(
            "referencia_1_telefono"
          ) || ""
        )
      );

    const referencia2Nombre =
      String(
        formData.get(
          "referencia_2_nombre"
        ) || ""
      ).trim();

    const referencia2Telefono =
      limpiarTelefono(
        String(
          formData.get(
            "referencia_2_telefono"
          ) || ""
        )
      );

    const ineFrente =
      formData.get(
        "ine_frente"
      );

    const comprobante =
      formData.get(
        "comprobante_domicilio"
      );

    if (
      !nombreResponsable ||
      !telefono ||
      !direccion ||
      !nombreBazar ||
      !productos ||
      !facebook ||
      !referencia1Nombre ||
      !referencia1Telefono ||
      !referencia2Nombre ||
      !referencia2Telefono
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Faltan datos obligatorios del formulario.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      telefono.length < 10
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "El teléfono del responsable no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      referencia1Telefono.length <
        10 ||
      referencia2Telefono.length <
        10
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Los teléfonos de las referencias deben contener al menos 10 dígitos.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !(
        ineFrente instanceof
        File
      ) ||
      ineFrente.size === 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "La fotografía del INE es obligatoria.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !(
        comprobante instanceof
        File
      ) ||
      comprobante.size === 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "El comprobante de domicilio es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Validamos ambos documentos
     * antes de crear el registro.
     */
    validarArchivo(
      ineFrente,
      "Fotografía del INE"
    );

    validarArchivo(
      comprobante,
      "Comprobante de domicilio"
    );

    /*
     * Crear el registro para obtener
     * el folio automático.
     */
    const {
      data: registro,
      error:
        errorRegistro,
    } =
      await supabaseAdmin
        .from("bazares")
        .insert({
          nombre_responsable:
            nombreResponsable,

          telefono,

          direccion,

          nombre_bazar:
            nombreBazar,

          correo:
            correo || null,

          productos,

          facebook,

          referencia_1_nombre:
            referencia1Nombre,

          referencia_1_telefono:
            referencia1Telefono,

          referencia_2_nombre:
            referencia2Nombre,

          referencia_2_telefono:
            referencia2Telefono,

          estado:
            "pendiente",
        })
        .select(
          "id, folio"
        )
        .single();

    if (
      errorRegistro ||
      !registro
    ) {
      console.error(
        "Error creando el registro:",
        errorRegistro
      );

      throw new Error(
        errorRegistro?.message ||
          "No fue posible crear el registro del bazar."
      );
    }

    registroCreadoId =
      registro.id;

    /*
     * Subir fotografía del INE.
     */
    const documentoIne =
      await subirDocumento({
        supabaseAdmin,
        archivo:
          ineFrente,
        folio:
          registro.folio,
        nombreBazar,
        nombreBase:
          "INE_FRENTE",
      });

    documentosSubidos.push(
      documentoIne.ruta
    );

    /*
     * Subir comprobante.
     */
    const documentoComprobante =
      await subirDocumento({
        supabaseAdmin,
        archivo:
          comprobante,

        folio:
          registro.folio,

        nombreBazar,

        nombreBase:
          "COMPROBANTE_DOMICILIO",
      });

    documentosSubidos.push(
      documentoComprobante.ruta
    );

    /*
     * Guardar rutas privadas
     * del Storage.
     */
    const {
      error:
        errorActualizacion,
    } =
      await supabaseAdmin
        .from("bazares")
        .update({
          ine_frente_archivo:
            documentoIne.ruta,

          comprobante_domicilio_archivo:
            documentoComprobante.ruta,

          fecha_actualizacion:
            new Date().toISOString(),
        })
        .eq(
          "id",
          registro.id
        );

    if (
      errorActualizacion
    ) {
      console.error(
        "Error actualizando las rutas:",
        errorActualizacion
      );

      throw new Error(
        "Los documentos se subieron, pero no se pudieron registrar sus rutas."
      );
    }

    return NextResponse.json({
      success: true,

      mensaje:
        "Registro enviado correctamente. VIPACK revisará la información proporcionada.",

      id:
        registro.id,

      folio:
        registro.folio,

      bucket:
        BUCKET_DOCUMENTOS,

      carpeta:
        `${registro.folio}_${limpiarNombre(
          nombreBazar
        )}`,

      ine_frente_archivo:
        documentoIne.ruta,

      comprobante_domicilio_archivo:
        documentoComprobante.ruta,
    });
  } catch (error) {
    console.error(
      "Error registrando el bazar:",
      error
    );

    /*
     * Limpiar documentos que sí
     * alcanzaron a subir.
     */
    if (
      supabaseAdmin &&
      documentosSubidos.length >
        0
    ) {
      await eliminarDocumentos({
        supabaseAdmin,
        rutas:
          documentosSubidos,
      });
    }

    /*
     * IMPORTANTE:
     * Nunca eliminamos el registro de Supabase.
     *
     * Si algo falla después de crear el registro,
     * lo conservamos para mantener el historial
     * y lo marcamos para revisión.
     */
    if (
      supabaseAdmin &&
      registroCreadoId
    ) {
      const {
        error:
          errorMarcar,
      } =
        await supabaseAdmin
          .from("bazares")
          .update({
            estado:
              "error_registro",

            fecha_actualizacion:
              new Date().toISOString(),
          })
          .eq(
            "id",
            registroCreadoId
          );

      if (
        errorMarcar
      ) {
        console.error(
          "No fue posible marcar el registro incompleto para revisión:",
          errorMarcar
        );
      }
    }

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "No fue posible completar el registro.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,

    mensaje:
      "La API de registro de bazares está funcionando con Supabase Storage.",

    bucket:
      BUCKET_DOCUMENTOS,
  });
}