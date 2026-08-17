import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

/*
 * Convierte una fecha YYYY-MM-DD a una fecha ISO
 * usando mediodía UTC para evitar que el cambio
 * de zona horaria la mueva al día/mes anterior.
 */
function crearFechaISO(
  year: number,
  month: number,
  day: number
) {
  const fecha = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12,
      0,
      0
    )
  );

  if (
    fecha.getUTCFullYear() !== year ||
    fecha.getUTCMonth() !== month - 1 ||
    fecha.getUTCDate() !== day
  ) {
    return null;
  }

  return fecha.toISOString();
}

/*
 * Intenta obtener la fecha desde el nombre
 * original del archivo.
 *
 * Ejemplos reconocidos:
 *
 * WhatsApp Image 2026-07-31 at 9.45.01 AM.jpeg
 * 2026-07-31.jpg
 * 31-07-2026.jpg
 * 31-07-26-1.jpg
 * 20260731.jpg
 */
function obtenerFechaDesdeNombre(
  nombre: string
) {
  /*
   * YYYY-MM-DD
   * YYYY_MM_DD
   * YYYY.MM.DD
   */
  const formatoYearPrimero =
    nombre.match(
      /(?:^|[^0-9])(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})(?:[^0-9]|$)/
    );

  if (formatoYearPrimero) {
    const year =
      Number(
        formatoYearPrimero[1]
      );

    const month =
      Number(
        formatoYearPrimero[2]
      );

    const day =
      Number(
        formatoYearPrimero[3]
      );

    const fecha =
      crearFechaISO(
        year,
        month,
        day
      );

    if (fecha) {
      return fecha;
    }
  }

  /*
   * DD-MM-YYYY
   * DD_MM_YYYY
   * DD.MM.YYYY
   */
  const formatoDiaPrimeroLargo =
    nombre.match(
      /(?:^|[^0-9])(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})(?:[^0-9]|$)/
    );

  if (formatoDiaPrimeroLargo) {
    const day =
      Number(
        formatoDiaPrimeroLargo[1]
      );

    const month =
      Number(
        formatoDiaPrimeroLargo[2]
      );

    const year =
      Number(
        formatoDiaPrimeroLargo[3]
      );

    const fecha =
      crearFechaISO(
        year,
        month,
        day
      );

    if (fecha) {
      return fecha;
    }
  }

  /*
   * DD-MM-YY
   *
   * Ejemplo:
   * 31-07-26-1.jpg
   */
  const formatoDiaPrimeroCorto =
    nombre.match(
      /(?:^|[^0-9])(\d{1,2})[-_.](\d{1,2})[-_.](\d{2})(?:[^0-9]|$)/
    );

  if (formatoDiaPrimeroCorto) {
    const day =
      Number(
        formatoDiaPrimeroCorto[1]
      );

    const month =
      Number(
        formatoDiaPrimeroCorto[2]
      );

    const yearCorto =
      Number(
        formatoDiaPrimeroCorto[3]
      );

    const year =
      yearCorto >= 70
        ? 1900 + yearCorto
        : 2000 + yearCorto;

    const fecha =
      crearFechaISO(
        year,
        month,
        day
      );

    if (fecha) {
      return fecha;
    }
  }

  /*
   * YYYYMMDD
   *
   * Ejemplo:
   * IMG_20260731_123456.jpg
   */
  const formatoCompacto =
    nombre.match(
      /(?:^|[^0-9])(\d{4})(\d{2})(\d{2})(?:[^0-9]|$)/
    );

  if (formatoCompacto) {
    const year =
      Number(
        formatoCompacto[1]
      );

    const month =
      Number(
        formatoCompacto[2]
      );

    const day =
      Number(
        formatoCompacto[3]
      );

    const fecha =
      crearFechaISO(
        year,
        month,
        day
      );

    if (fecha) {
      return fecha;
    }
  }

  return null;
}

/*
 * Elegimos la mejor fecha disponible.
 *
 * Prioridad:
 *
 * 1. Fecha real tomada de la foto (EXIF/OneDrive).
 * 2. Fecha incluida en el nombre del archivo.
 * 3. Fecha original reportada por el sistema de archivos.
 * 4. Fecha de creación en OneDrive.
 * 5. Fecha de última modificación en OneDrive.
 *
 * Así evitamos que una foto antigua aparezca en el
 * mes en que fue subida al ERP.
 */
function obtenerFechaArchivo(
  item: any
) {
  const fechaTomada =
    item?.photo?.takenDateTime;

  if (fechaTomada) {
    return fechaTomada;
  }

  const fechaNombre =
    obtenerFechaDesdeNombre(
      String(
        item?.name || ""
      )
    );

  if (fechaNombre) {
    return fechaNombre;
  }

  const fechaSistemaCreacion =
    item?.fileSystemInfo
      ?.createdDateTime;

  if (fechaSistemaCreacion) {
    return fechaSistemaCreacion;
  }

  const fechaSistemaModificacion =
    item?.fileSystemInfo
      ?.lastModifiedDateTime;

  if (fechaSistemaModificacion) {
    return fechaSistemaModificacion;
  }

  if (item?.createdDateTime) {
    return item.createdDateTime;
  }

  return (
    item?.lastModifiedDateTime ||
    null
  );
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { token } =
      await context.params;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se recibió token de inventario.",
        },
        { status: 400 }
      );
    }

    const clientId =
      process.env.ONEDRIVE_CLIENT_ID;

    const clientSecret =
      process.env.ONEDRIVE_CLIENT_SECRET;

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !clientId ||
      !clientSecret ||
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faltan variables de configuración.",
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
            autoRefreshToken:
              false,
            persistSession:
              false,
          },
        }
      );

    /*
     * 1. Buscar al cliente
     * por su token privado.
     */
    const {
      data: cliente,
      error: clienteError,
    } = await supabase
      .from(
        "clientes_inventario"
      )
      .select(
        `
        id,
        id_cliente,
        nombre,
        carpeta_cliente,
        onedrive_folder_id,
        token_inventario,
        activo
        `
      )
      .eq(
        "token_inventario",
        token
      )
      .eq(
        "activo",
        true
      )
      .maybeSingle();

    if (clienteError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo consultar el cliente.",
          detalle:
            clienteError.message,
        },
        { status: 500 }
      );
    }

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Inventario no encontrado o acceso inactivo.",
        },
        { status: 404 }
      );
    }

    if (
      !cliente.onedrive_folder_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El cliente todavía no tiene una carpeta de OneDrive vinculada.",
        },
        { status: 400 }
      );
    }

    /*
     * 2. Obtener conexión
     * de OneDrive.
     */
    const {
      data: conexion,
      error: conexionError,
    } = await supabase
      .from(
        "onedrive_connections"
      )
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

    if (conexionError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo consultar la conexión de OneDrive.",
          detalle:
            conexionError.message,
        },
        { status: 500 }
      );
    }

    if (
      !conexion
        ?.refresh_token
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No existe una conexión activa con OneDrive.",
        },
        { status: 500 }
      );
    }

    /*
     * 3. Renovar access token.
     */
    const tokenResponse =
      await fetch(
        "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
        {
          method:
            "POST",

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
                conexion.refresh_token,

              scope:
                "openid profile offline_access User.Read Files.ReadWrite",
            }),

          cache:
            "no-store",
        }
      );

    const tokenData =
      await tokenResponse.json();

    if (
      !tokenResponse.ok
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo renovar el acceso a OneDrive.",
          detalle:
            tokenData
              ?.error_description ||
            tokenData?.error ||
            tokenData,
        },
        { status: 400 }
      );
    }

    const accessToken =
      tokenData
        ?.access_token;

    const newRefreshToken =
      tokenData
        ?.refresh_token;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Microsoft no devolvió access_token.",
        },
        { status: 400 }
      );
    }

    /*
     * Microsoft puede rotar
     * el refresh token.
     */
    if (
      newRefreshToken &&
      newRefreshToken !==
        conexion.refresh_token
    ) {
      await supabase
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
    }

    /*
     * 4. Leer únicamente
     * la carpeta asociada
     * a este cliente.
     *
     * Solicitamos:
     * - photo.takenDateTime
     * - fileSystemInfo
     * - createdDateTime
     *
     * para poder conservar
     * la fecha original.
     */
    const graphUrl =
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
        cliente.onedrive_folder_id
      )}/children?$select=id,name,file,folder,size,createdDateTime,lastModifiedDateTime,fileSystemInfo,photo,webUrl&$top=999`;

    const archivosResponse =
      await fetch(
        graphUrl,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache:
            "no-store",
        }
      );

    const archivosData =
      await archivosResponse.json();

    if (
      !archivosResponse.ok
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo leer el inventario del cliente.",
          detalle:
            archivosData,
        },
        { status: 400 }
      );
    }

    const items =
      Array.isArray(
        archivosData?.value
      )
        ? archivosData.value
        : [];

    /*
     * 5. Preparar respuesta segura.
     *
     * IMPORTANTE:
     *
     * La propiedad "modificado"
     * se conserva con el mismo nombre
     * para NO tocar el page.tsx.
     *
     * Pero ahora su valor representa
     * la fecha original del archivo
     * según la prioridad definida arriba.
     */
    const inventario =
      items.map(
        (item: any) => {
          const fechaArchivo =
            obtenerFechaArchivo(
              item
            );

          return {
            id:
              item.id,

            nombre:
              item.name,

            tipo:
              item.folder
                ? "carpeta"
                : item.file
                ? "archivo"
                : "otro",

            mime_type:
              item.file
                ?.mimeType ||
              null,

            tamaño:
              item.size ||
              0,

            /*
             * El front ya usa
             * esta propiedad para:
             *
             * - mostrar la fecha
             * - crear los meses
             * - filtrar por mes
             *
             * Por eso NO hace falta
             * cambiar la vista.
             */
            modificado:
              fechaArchivo,

            /*
             * Campos extra útiles
             * para diagnóstico futuro.
             */
            fecha_archivo:
              fechaArchivo,

            fecha_subida:
              item.createdDateTime ||
              null,

            fecha_modificacion_onedrive:
              item.lastModifiedDateTime ||
              null,

            webUrl:
              item.webUrl ||
              null,
          };
        }
      );

    /*
     * Ordenar del archivo
     * más reciente al más antiguo
     * usando la fecha real del archivo.
     */
    inventario.sort(
      (
        a: any,
        b: any
      ) => {
        const fechaA =
          a.modificado
            ? new Date(
                a.modificado
              ).getTime()
            : 0;

        const fechaB =
          b.modificado
            ? new Date(
                b.modificado
              ).getTime()
            : 0;

        return (
          fechaB -
          fechaA
        );
      }
    );

    return NextResponse.json({
      success: true,

      cliente: {
        id_cliente:
          cliente.id_cliente,

        nombre:
          cliente.nombre,

        carpeta:
          cliente.carpeta_cliente,
      },

      total:
        inventario.length,

      inventario,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error inventario cliente:",
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