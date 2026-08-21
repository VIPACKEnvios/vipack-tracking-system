import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_NOTAS =
  "Envios/NotasRecoleccion";

const RUTA_FOTOS =
  "Envios/Recoleccion por cliente";

const RUTA_EXCEL =
  "Envios/control_recolecciones_bodega.xlsx";

const HOJA_SOLICITUDES =
  "Solicitudes";

type TipoEvidencia =
  | "nota"
  | "foto";

type ArchivoOneDrive = {
  id: string;
  nombre: string;
  tamaño: number;
  webUrl: string | null;
  modificado: string | null;
};

type ArchivoSubido = {
  id: string;
  nombre: string;
  tamaño: number;
  webUrl: string | null;
};

type CarpetaOneDrive = {
  id: string;
  nombre: string;
};

async function leerJsonSeguro(
  response: Response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function crearSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !supabaseServiceRoleKey
  ) {
    throw new Error(
      "Faltan variables de configuración de Supabase."
    );
  }

  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function renovarTokenOneDrive(
  clientId: string,
  clientSecret: string,
  refreshToken: string
) {
  const response =
    await fetch(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            client_id:
              clientId,

            client_secret:
              clientSecret,

            grant_type:
              "refresh_token",

            refresh_token:
              refreshToken,

            scope:
              "openid profile offline_access User.Read Files.ReadWrite",
          }),

        cache:
          "no-store",
      }
    );

  const data =
    await leerJsonSeguro(
      response
    );

  return {
    response,
    data,
  };
}

async function obtenerAccessToken() {
  const clientId =
    process.env.ONEDRIVE_CLIENT_ID;

  const clientSecret =
    process.env.ONEDRIVE_CLIENT_SECRET;

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "Faltan variables de configuración de OneDrive."
    );
  }

  const supabase =
    crearSupabase();

  const {
    data: conexion,
    error,
  } = await supabase
    .from("onedrive_connections")
    .select(
      "id, refresh_token"
    )
    .order(
      "id",
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar la conexión de OneDrive: ${error.message}`
    );
  }

  if (
    !conexion?.refresh_token
  ) {
    throw new Error(
      "No existe una conexión activa de OneDrive."
    );
  }

  const {
    response,
    data,
  } =
    await renovarTokenOneDrive(
      clientId,
      clientSecret,
      conexion.refresh_token
    );

  if (!response.ok) {
    throw new Error(
      data
        ?.error_description ||
        data?.error ||
        "No se pudo renovar el acceso a OneDrive."
    );
  }

  const accessToken =
    data?.access_token;

  if (!accessToken) {
    throw new Error(
      "Microsoft no devolvió access_token."
    );
  }

  const newRefreshToken =
    data?.refresh_token;

  if (
    newRefreshToken &&
    newRefreshToken !==
      conexion.refresh_token
  ) {
    const {
      error:
        updateError,
    } = await supabase
      .from(
        "onedrive_connections"
      )
      .update({
        refresh_token:
          newRefreshToken,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        conexion.id
      );

    if (updateError) {
      console.error(
        "No se pudo actualizar refresh_token:",
        updateError
      );
    }
  }

  return accessToken;
}

function limpiarFolio(
  folio: string
) {
  return folio
    .trim()
    .replace(
      /[^A-Za-z0-9-_]/g,
      ""
    );
}

function extensionDesdeNombre(
  nombre: string
) {
  const partes =
    nombre.split(".");

  if (
    partes.length < 2
  ) {
    return ".jpg";
  }

  const extension =
    partes
      .pop()
      ?.toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ""
      );

  return extension
    ? `.${extension}`
    : ".jpg";
}

function numeroConCeros(
  numero: number
) {
  return String(
    numero
  ).padStart(
    3,
    "0"
  );
}


function normalizarNombre(
  valor: string
) {
  return valor
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLocaleLowerCase(
      "es"
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim()
    .replace(
      /\s+/g,
      " "
    );
}

function quitarCodigoInicial(
  valor: string
) {
  return valor
    .replace(
      /^\d+\s*/,
      ""
    )
    .trim();
}

async function descargarExcel(
  accessToken: string
) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_EXCEL
    )}:/content`;

  const response =
    await fetch(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache:
          "no-store",
      }
    );

  if (!response.ok) {
    const detalle =
      await response.text();

    throw new Error(
      `No se pudo leer el Excel de recolecciones. ${detalle}`
    );
  }

  return await response.arrayBuffer();
}

async function obtenerClientePorFolio(
  accessToken: string,
  folio: string
) {
  const arrayBuffer =
    await descargarExcel(
      accessToken
    );

  const workbook =
    XLSX.read(
      Buffer.from(
        arrayBuffer
      ),
      {
        type:
          "buffer",
      }
    );

  const hoja =
    workbook.Sheets[
      HOJA_SOLICITUDES
    ];

  if (!hoja) {
    throw new Error(
      `El Excel no contiene la hoja "${HOJA_SOLICITUDES}".`
    );
  }

  const filas =
    XLSX.utils
      .sheet_to_json<
        Record<
          string,
          unknown
        >
      >(
        hoja,
        {
          defval:
            "",
          raw:
            false,
        }
      );

  const fila =
    filas.find(
      (item) =>
        String(
          item.Folio ?? ""
        ).trim() ===
        folio
    );

  if (!fila) {
    throw new Error(
      `No se encontró el folio ${folio} en el Excel de recolecciones.`
    );
  }

  const cliente =
    String(
      fila.Cliente ?? ""
    ).trim();

  if (!cliente) {
    throw new Error(
      `La recolección ${folio} no tiene cliente asignado.`
    );
  }

  return cliente;
}

async function listarCarpetas(
  accessToken: string,
  ruta: string
): Promise<CarpetaOneDrive[]> {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      ruta
    )}:/children?$select=id,name,folder&$top=999`;

  const response =
    await fetch(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache:
          "no-store",
      }
    );

  if (
    response.status === 404
  ) {
    return [];
  }

  const data =
    await leerJsonSeguro(
      response
    );

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `No se pudo leer la carpeta ${ruta}.`
    );
  }

  const items =
    Array.isArray(
      data?.value
    )
      ? data.value
      : [];

  return items
    .filter(
      (item: any) =>
        Boolean(
          item?.folder
        )
    )
    .map(
      (
        item: any
      ): CarpetaOneDrive => ({
        id:
          String(
            item.id || ""
          ),

        nombre:
          String(
            item.name || ""
          ),
      })
    );
}

async function resolverCarpetaCliente(
  accessToken: string,
  cliente: string
) {
  const carpetas =
    await listarCarpetas(
      accessToken,
      RUTA_FOTOS
    );

  const objetivo =
    normalizarNombre(
      cliente
    );

  /*
   * Tus carpetas pueden traer un código
   * delante, por ejemplo:
   * "00018 Nombre del cliente".
   */
  const preparadas =
    carpetas.map(
      (carpeta) => {
        const nombreNormal =
          normalizarNombre(
            carpeta.nombre
          );

        const sinCodigo =
          quitarCodigoInicial(
            nombreNormal
          );

        return {
          ...carpeta,
          nombreNormal,
          sinCodigo,
        };
      }
    );

  const exacta =
    preparadas.find(
      (carpeta) =>
        carpeta.sinCodigo ===
          objetivo ||
        carpeta.nombreNormal ===
          objetivo
    );

  if (exacta) {
    return exacta;
  }

  const candidatas =
    preparadas.filter(
      (carpeta) =>
        carpeta.sinCodigo.includes(
          objetivo
        ) ||
        objetivo.includes(
          carpeta.sinCodigo
        )
    );

  if (
    candidatas.length === 1
  ) {
    return candidatas[0];
  }

  if (
    candidatas.length > 1
  ) {
    const empieza =
      candidatas.filter(
        (carpeta) =>
          carpeta.sinCodigo.startsWith(
            objetivo
          ) ||
          objetivo.startsWith(
            carpeta.sinCodigo
          )
      );

    if (
      empieza.length === 1
    ) {
      return empieza[0];
    }

    throw new Error(
      `Se encontraron varias carpetas posibles para el cliente "${cliente}". Revisa los nombres dentro de "${RUTA_FOTOS}".`
    );
  }

  throw new Error(
    `No se encontró una carpeta para "${cliente}" dentro de "${RUTA_FOTOS}". No se creó una carpeta nueva para evitar duplicados.`
  );
}

async function resolverRutaFotosCliente(
  accessToken: string,
  folio: string
) {
  const cliente =
    await obtenerClientePorFolio(
      accessToken,
      folio
    );

  const carpeta =
    await resolverCarpetaCliente(
      accessToken,
      cliente
    );

  return {
    cliente,

    carpeta:
      carpeta.nombre,

    ruta:
      `${RUTA_FOTOS}/${carpeta.nombre}`,
  };
}

async function obtenerIdCarpetaPorRuta(
  accessToken: string,
  ruta: string
) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      ruta
    )}?$select=id,name,folder`;

  const response =
    await fetch(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache:
          "no-store",
      }
    );

  const data =
    await leerJsonSeguro(
      response
    );

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `No se pudo localizar la carpeta ${ruta}.`
    );
  }

  const id =
    String(
      data?.id || ""
    );

  if (!id) {
    throw new Error(
      `Microsoft no devolvió el id de la carpeta ${ruta}.`
    );
  }

  return id;
}

async function listarArchivosCarpeta(
  accessToken: string,
  ruta: string
): Promise<ArchivoOneDrive[]> {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      ruta
    )}:/children?$select=id,name,size,file,webUrl,lastModifiedDateTime&$top=999`;

  const response =
    await fetch(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache:
          "no-store",
      }
    );

  if (
    response.status === 404
  ) {
    return [];
  }

  const data =
    await leerJsonSeguro(
      response
    );

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `No se pudo leer la carpeta ${ruta}.`
    );
  }

  const items =
    Array.isArray(
      data?.value
    )
      ? data.value
      : [];

  return items
    .filter(
      (
        item: any
      ) =>
        Boolean(
          item?.file
        )
    )
    .map(
      (
        item: any
      ): ArchivoOneDrive => ({
        id:
          String(
            item.id || ""
          ),

        nombre:
          String(
            item.name || ""
          ),

        tamaño:
          Number(
            item.size || 0
          ),

        webUrl:
          item.webUrl
            ? String(
                item.webUrl
              )
            : null,

        modificado:
          item.lastModifiedDateTime
            ? String(
                item.lastModifiedDateTime
              )
            : null,
      })
    );
}

function perteneceAlFolio(
  nombre: string,
  folio: string
) {
  return nombre
    .toLowerCase()
    .startsWith(
      folio.toLowerCase()
    );
}


async function buscarFotosPorFolio(
  accessToken: string,
  folio: string
): Promise<ArchivoOneDrive[]> {
  /*
   * Primero leemos la carpeta exacta del cliente.
   * Esto refleja una foto nueva inmediatamente y
   * evita esperar al índice de búsqueda de Graph.
   */
  try {
    const destino =
      await resolverRutaFotosCliente(
        accessToken,
        folio
      );

    const archivosCliente =
      await listarArchivosCarpeta(
        accessToken,
        destino.ruta
      );

    const directos =
      archivosCliente.filter(
        (
          archivo:
            ArchivoOneDrive
        ) =>
          perteneceAlFolio(
            archivo.nombre,
            folio
          )
      );

    if (
      directos.length > 0
    ) {
      return directos;
    }
  } catch (
    error: unknown
  ) {
    console.warn(
      "Lectura directa de carpeta no disponible; usando búsqueda histórica:",
      error instanceof Error
        ? error.message
        : error
    );
  }

  /*
   * Respaldo para archivos históricos:
   * búsqueda recursiva dentro de todas las
   * carpetas de "Recoleccion por cliente".
   */
  const carpetaId =
    await obtenerIdCarpetaPorRuta(
      accessToken,
      RUTA_FOTOS
    );

  const url =
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
      carpetaId
    )}/search(q='${folio}')?$select=id,name,size,file,webUrl,lastModifiedDateTime&$top=999`;

  const response =
    await fetch(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache:
          "no-store",
      }
    );

  const data =
    await leerJsonSeguro(
      response
    );

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        "No se pudieron buscar las fotos de la recolección."
    );
  }

  const items =
    Array.isArray(
      data?.value
    )
      ? data.value
      : [];

  return items
    .filter(
      (item: any) =>
        Boolean(
          item?.file
        ) &&
        perteneceAlFolio(
          String(
            item?.name || ""
          ),
          folio
        )
    )
    .map(
      (
        item: any
      ): ArchivoOneDrive => ({
        id:
          String(
            item.id || ""
          ),

        nombre:
          String(
            item.name || ""
          ),

        tamaño:
          Number(
            item.size || 0
          ),

        webUrl:
          item.webUrl
            ? String(
                item.webUrl
              )
            : null,

        modificado:
          item.lastModifiedDateTime
            ? String(
                item.lastModifiedDateTime
              )
            : null,
      })
    );
}


async function obtenerArchivoSeguro(
  accessToken: string,
  folio: string,
  archivoId: string
): Promise<{
  archivo: ArchivoOneDrive;
  tipo: TipoEvidencia;
} | null> {
  const [
    notas,
    fotos,
  ] =
    await Promise.all([
      listarArchivosCarpeta(
        accessToken,
        RUTA_NOTAS
      ),

      buscarFotosPorFolio(
        accessToken,
        folio
      ),
    ]);

  const nota =
    notas.find(
      (
        item:
          ArchivoOneDrive
      ) =>
        item.id ===
          archivoId &&
        perteneceAlFolio(
          item.nombre,
          folio
        )
    );

  if (nota) {
    return {
      archivo:
        nota,
      tipo:
        "nota",
    };
  }

  const foto =
    fotos.find(
      (
        item:
          ArchivoOneDrive
      ) =>
        item.id ===
        archivoId
    );

  if (foto) {
    return {
      archivo:
        foto,
      tipo:
        "foto",
    };
  }

  return null;
}


async function descargarArchivoOneDrive(
  accessToken: string,
  archivoId: string
) {
  const response =
    await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
        archivoId
      )}/content`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache:
          "no-store",

        redirect:
          "follow",
      }
    );

  if (!response.ok) {
    const detalle =
      await response.text();

    throw new Error(
      detalle ||
        "No se pudo abrir la evidencia."
    );
  }

  return response;
}

async function subirArchivo(
  accessToken: string,
  ruta: string,
  archivo: File,
  nombreFinal: string
): Promise<ArchivoSubido> {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      `${ruta}/${nombreFinal}`
    )}:/content`;

  const buffer =
    Buffer.from(
      await archivo.arrayBuffer()
    );

  const response =
    await fetch(
      url,
      {
        method: "PUT",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            archivo.type ||
            "application/octet-stream",
        },

        body:
          new Uint8Array(
            buffer
          ),

        cache:
          "no-store",
      }
    );

  const data =
    await leerJsonSeguro(
      response
    );

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `No se pudo subir ${archivo.name}.`
    );
  }

  return {
    id:
      data?.id,

    nombre:
      data?.name,

    webUrl:
      data?.webUrl || null,

    tamaño:
      data?.size || 0,
  };
}

export async function GET(
  request: Request,
  context: {
    params:
      Promise<{
        folio: string;
      }>;
  }
) {
  try {
    const {
      folio:
        folioRaw,
    } =
      await context.params;

    const folio =
      limpiarFolio(
        folioRaw
      );

    if (!folio) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Folio inválido.",
        },
        {
          status: 400,
        }
      );
    }

    const accessToken =
      await obtenerAccessToken();

    const url =
      new URL(
        request.url
      );

    const archivoId =
      String(
        url.searchParams.get(
          "archivoId"
        ) || ""
      ).trim();

    /*
     * VISOR INTERNO:
     * si llega archivoId, primero
     * verificamos que el archivo
     * pertenezca al folio y después
     * lo transmitimos sin exponer
     * OneDrive al usuario.
     */
    if (archivoId) {
      const seguro =
        await obtenerArchivoSeguro(
          accessToken,
          folio,
          archivoId
        );

      if (!seguro) {
        return NextResponse.json(
          {
            success: false,
            error:
              "La evidencia no existe o no pertenece a esta recolección.",
          },
          {
            status: 404,
          }
        );
      }

      const archivoResponse =
        await descargarArchivoOneDrive(
          accessToken,
          archivoId
        );

      const buffer =
        await archivoResponse.arrayBuffer();

      const contentType =
        archivoResponse.headers.get(
          "content-type"
        ) ||
        "application/octet-stream";

      return new Response(
        buffer,
        {
          status: 200,

          headers: {
            "Content-Type":
              contentType,

            "Content-Disposition":
              `inline; filename="${seguro.archivo.nombre.replace(
                /"/g,
                ""
              )}"`,

            "Cache-Control":
              "private, no-store, max-age=0",
          },
        }
      );
    }

    const [
      todosNotas,
      fotos,
    ] =
      await Promise.all([
        listarArchivosCarpeta(
          accessToken,
          RUTA_NOTAS
        ),

        buscarFotosPorFolio(
          accessToken,
          folio
        ),
      ]);

    const notas =
      todosNotas.filter(
        (
          archivo:
            ArchivoOneDrive
        ) =>
          perteneceAlFolio(
            archivo.nombre,
            folio
          )
      );

    return NextResponse.json({
      success: true,

      folio,

      resumen: {
        notas:
          notas.length,

        fotos:
          fotos.length,

        total:
          notas.length +
          fotos.length,
      },

      notas,

      fotos,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error consultando evidencias:",
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
      {
        status: 500,
      }
    );
  }
}


export async function POST(
  request: Request,
  context: {
    params:
      Promise<{
        folio: string;
      }>;
  }
) {
  try {
    const {
      folio:
        folioRaw,
    } =
      await context.params;

    const folio =
      limpiarFolio(
        folioRaw
      );

    if (!folio) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Folio inválido.",
        },
        {
          status: 400,
        }
      );
    }

    const formData =
      await request.formData();

    const tipoRaw =
      String(
        formData.get(
          "tipo"
        ) || ""
      )
        .trim()
        .toLowerCase();

    if (
      tipoRaw !== "nota" &&
      tipoRaw !== "foto"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            'El tipo debe ser "nota" o "foto".',
        },
        {
          status: 400,
        }
      );
    }

    const tipo =
      tipoRaw as TipoEvidencia;

    const archivos =
      formData
        .getAll(
          "archivos"
        )
        .filter(
          (
            item
          ): item is File =>
            item instanceof File
        );

    if (
      archivos.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Selecciona al menos una imagen.",
        },
        {
          status: 400,
        }
      );
    }

    const accessToken =
      await obtenerAccessToken();

    let ruta =
      RUTA_NOTAS;

    let cliente:
      string | null =
        null;

    let carpetaCliente:
      string | null =
        null;

    if (
      tipo === "foto"
    ) {
      const destino =
        await resolverRutaFotosCliente(
          accessToken,
          folio
        );

      ruta =
        destino.ruta;

      cliente =
        destino.cliente;

      carpetaCliente =
        destino.carpeta;
    }

    const existentes =
      tipo === "nota"
        ? await listarArchivosCarpeta(
            accessToken,
            RUTA_NOTAS
          )
        : await buscarFotosPorFolio(
            accessToken,
            folio
          );

    const delFolio =
      existentes.filter(
        (
          archivo: ArchivoOneDrive
        ) =>
          perteneceAlFolio(
            archivo.nombre,
            folio
          )
      );

    const subidos: ArchivoSubido[] = [];

    for (
      let i = 0;
      i <
      archivos.length;
      i += 1
    ) {
      const archivo =
        archivos[i];

      const extension =
        extensionDesdeNombre(
          archivo.name
        );

      const numero =
        delFolio.length +
        i +
        1;

      const nombreFinal =
        tipo === "nota"
          ? `${folio}.Nota-${numeroConCeros(
              numero
            )}${extension}`
          : `${folio}.Foto-${numeroConCeros(
              numero
            )}${extension}`;

      const resultado =
        await subirArchivo(
          accessToken,
          ruta,
          archivo,
          nombreFinal
        );

      subidos.push(
        resultado
      );
    }

    return NextResponse.json({
      success: true,

      folio,

      tipo,

      agregados:
        subidos.length,

      archivos:
        subidos,

      destino:
        tipo === "nota"
          ? {
              ruta:
                RUTA_NOTAS,
            }
          : {
              ruta,
              cliente,
              carpeta:
                carpetaCliente,
            },
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error subiendo evidencias:",
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
      {
        status: 500,
      }
    );
  }
}

async function eliminarArchivoOneDrive(
  accessToken: string,
  id: string
) {
  const response =
    await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
        id
      )}`,
      {
        method: "DELETE",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache:
          "no-store",
      }
    );

  if (
    response.status !== 204 &&
    !response.ok
  ) {
    const data =
      await leerJsonSeguro(
        response
      );

    throw new Error(
      data?.error?.message ||
        "No se pudo eliminar el archivo de OneDrive."
    );
  }
}

export async function DELETE(
  request: Request,
  context: {
    params:
      Promise<{
        folio: string;
      }>;
  }
) {
  try {
    const {
      folio:
        folioRaw,
    } =
      await context.params;

    const folio =
      limpiarFolio(
        folioRaw
      );

    if (!folio) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Folio inválido.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      (await request.json()) as {
        id?: string;
        tipo?: TipoEvidencia;
      };

    const id =
      String(
        body.id || ""
      ).trim();

    const tipo =
      body.tipo;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta el identificador del archivo.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      tipo !== "nota" &&
      tipo !== "foto"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'El tipo debe ser "nota" o "foto".',
        },
        {
          status: 400,
        }
      );
    }

    const accessToken =
      await obtenerAccessToken();

    const archivos =
      tipo === "nota"
        ? await listarArchivosCarpeta(
            accessToken,
            RUTA_NOTAS
          )
        : await buscarFotosPorFolio(
            accessToken,
            folio
          );

    const archivo =
      archivos.find(
        (
          item:
            ArchivoOneDrive
        ) =>
          item.id === id &&
          perteneceAlFolio(
            item.nombre,
            folio
          )
      );

    if (!archivo) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La evidencia no existe o no pertenece a esta recolección.",
        },
        {
          status: 404,
        }
      );
    }

    await eliminarArchivoOneDrive(
      accessToken,
      archivo.id
    );

    return NextResponse.json({
      success: true,

      mensaje:
        tipo === "nota"
          ? "Nota eliminada correctamente."
          : "Foto eliminada correctamente.",

      eliminado: {
        id:
          archivo.id,

        nombre:
          archivo.nombre,

        tipo,
      },
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error eliminando evidencia:",
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
      {
        status: 500,
      }
    );
  }
}