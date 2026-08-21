import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_NOTAS =
  "Envios/NotasRecoleccion";

const RUTA_FOTOS =
  "Envios/Recoleccion por cliente";

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
      (item: any) =>
        Boolean(
          item?.file
        )
    )
    .map(
      (item: any): ArchivoOneDrive => ({
        id:
          String(item.id || ""),

        nombre:
          String(item.name || ""),

        tamaño:
          Number(item.size || 0),

        webUrl:
          item.webUrl
            ? String(item.webUrl)
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

      listarArchivosCarpeta(
        accessToken,
        RUTA_FOTOS
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
          archivoId &&
        perteneceAlFolio(
          item.nombre,
          folio
        )
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
      todosFotos,
    ] =
      await Promise.all([
        listarArchivosCarpeta(
          accessToken,
          RUTA_NOTAS
        ),

        listarArchivosCarpeta(
          accessToken,
          RUTA_FOTOS
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

    const fotos =
      todosFotos.filter(
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

    const ruta =
      tipo === "nota"
        ? RUTA_NOTAS
        : RUTA_FOTOS;

    const existentes =
      await listarArchivosCarpeta(
        accessToken,
        ruta
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

    const ruta =
      tipo === "nota"
        ? RUTA_NOTAS
        : RUTA_FOTOS;

    const archivos =
      await listarArchivosCarpeta(
        accessToken,
        ruta
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
