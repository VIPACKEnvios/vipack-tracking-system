import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_CLIENTES =
  "Envios/Recoleccion por cliente";

type CrearSesionBody = {
  id_cliente?: number | string;
  nombre_archivo?: string;
  tamaño?: number;
};

type CarpetaOneDrive = {
  id: string;
  name: string;
  folder?: {
    childCount?: number;
  };
};

function limpiarNombreArchivo(nombre: string) {
  return nombre
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(valor: unknown) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

function numeroCliente(valor: number) {
  return String(valor).padStart(5, "0");
}

async function leerJsonSeguro(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function validarCarpetaPorId(
  accessToken: string,
  folderId: string
) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
      folderId
    )}?$select=id,name,folder`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const data =
    await leerJsonSeguro(response);

  if (
    response.ok &&
    data?.id &&
    data?.folder
  ) {
    return {
      existe: true,
      carpeta: {
        id: String(data.id),
        name: String(data.name || ""),
        folder: data.folder,
      } as CarpetaOneDrive,
      status: response.status,
      detalle: null,
    };
  }

  return {
    existe: false,
    carpeta: null,
    status: response.status,
    detalle: data,
  };
}

async function buscarCarpetaFisicaCliente(
  accessToken: string,
  idCliente: number,
  carpetaCliente: string | null
) {
  /*
   * 1. Localizamos la carpeta raíz real:
   * Envios/Recoleccion por cliente
   */
  const rootUrl =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_CLIENTES
    )}?$select=id,name,folder`;

  const rootResponse =
    await fetch(rootUrl, {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

  const rootData =
    await leerJsonSeguro(
      rootResponse
    );

  if (
    !rootResponse.ok ||
    !rootData?.id
  ) {
    return {
      carpeta: null,
      duplicadas: [] as CarpetaOneDrive[],
      error:
        `No se encontró la carpeta principal "${RUTA_CLIENTES}" en OneDrive.`,
      detalle:
        rootData ||
        `HTTP ${rootResponse.status}`,
    };
  }

  /*
   * 2. Leemos todas las carpetas hijas.
   */
  const childrenUrl =
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
      String(rootData.id)
    )}/children?$select=id,name,folder&$top=999`;

  const childrenResponse =
    await fetch(childrenUrl, {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

  const childrenData =
    await leerJsonSeguro(
      childrenResponse
    );

  if (!childrenResponse.ok) {
    return {
      carpeta: null,
      duplicadas: [] as CarpetaOneDrive[],
      error:
        "No se pudieron consultar las carpetas de clientes en OneDrive.",
      detalle:
        childrenData ||
        `HTTP ${childrenResponse.status}`,
    };
  }

  const carpetas:
    CarpetaOneDrive[] =
    Array.isArray(
      childrenData?.value
    )
      ? childrenData.value.filter(
          (item: any) =>
            Boolean(
              item?.folder
            )
        )
      : [];

  /*
   * PRIORIDAD 1:
   * ID de cliente al inicio de la carpeta.
   * Ejemplo: 00091 Irasema Vazquez
   */
  const prefijo =
    numeroCliente(
      idCliente
    );

  const porId =
    carpetas.filter(
      (carpeta) => {
        const nombre =
          String(
            carpeta.name ||
            ""
          ).trim();

        return (
          nombre === prefijo ||
          nombre.startsWith(
            `${prefijo} `
          )
        );
      }
    );

  if (porId.length === 1) {
    return {
      carpeta: porId[0],
      duplicadas: [],
      error: null,
      detalle: null,
    };
  }

  if (porId.length > 1) {
    return {
      carpeta: null,
      duplicadas: porId,
      error:
        "Se encontraron varias carpetas de OneDrive con el mismo ID de cliente.",
      detalle:
        porId.map(
          (item) => ({
            id: item.id,
            name: item.name,
          })
        ),
    };
  }

  /*
   * PRIORIDAD 2:
   * nombre exacto normalizado de carpeta_cliente.
   */
  const esperado =
    normalizar(
      carpetaCliente
    );

  if (esperado) {
    const porNombre =
      carpetas.filter(
        (carpeta) =>
          normalizar(
            carpeta.name
          ) === esperado
      );

    if (porNombre.length === 1) {
      return {
        carpeta: porNombre[0],
        duplicadas: [],
        error: null,
        detalle: null,
      };
    }

    if (
      porNombre.length >
      1
    ) {
      return {
        carpeta: null,
        duplicadas: porNombre,
        error:
          "Se encontraron varias carpetas de OneDrive con el mismo nombre.",
        detalle:
          porNombre.map(
            (item) => ({
              id: item.id,
              name: item.name,
            })
          ),
      };
    }
  }

  return {
    carpeta: null,
    duplicadas: [],
    error:
      "No se encontró la carpeta física del cliente en OneDrive.",
    detalle: {
      id_cliente:
        idCliente,
      carpeta_cliente:
        carpetaCliente,
      ruta:
        RUTA_CLIENTES,
    },
  };
}

async function crearUploadSession(
  accessToken: string,
  folderId: string,
  nombreArchivo: string
) {
  const crearSesionUrl =
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
      folderId
    )}:/${encodeURIComponent(
      nombreArchivo
    )}:/createUploadSession`;

  const response =
    await fetch(
      crearSesionUrl,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            item: {
              "@microsoft.graph.conflictBehavior":
                "rename",
            },
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

export async function POST(request: Request) {
  try {
    /*
     * Esta API NO recibe el archivo completo.
     * Solamente crea la sesión temporal de carga.
     * El navegador sube después directamente a OneDrive.
     */
    const body =
      (await request.json()) as CrearSesionBody;

    const idCliente =
      Number(
        body?.id_cliente
      );

    const nombreOriginal =
      String(
        body?.nombre_archivo ||
        ""
      ).trim();

    const tamaño =
      Number(
        body?.tamaño
      );

    if (
      !Number.isInteger(
        idCliente
      ) ||
      idCliente <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El id_cliente no es válido.",
        },
        { status: 400 }
      );
    }

    if (!nombreOriginal) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta el nombre del archivo.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(
        tamaño
      ) ||
      tamaño <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El tamaño del archivo no es válido.",
        },
        { status: 400 }
      );
    }

    const nombreArchivo =
      limpiarNombreArchivo(
        nombreOriginal
      );

    if (!nombreArchivo) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El nombre del archivo no es válido.",
        },
        { status: 400 }
      );
    }

    /*
     * 1. Variables de entorno.
     */
    const clientId =
      process.env
        .ONEDRIVE_CLIENT_ID;

    const clientSecret =
      process.env
        .ONEDRIVE_CLIENT_SECRET;

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const supabaseServiceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY;

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
            "Faltan variables de configuración de OneDrive o Supabase.",
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
     * 2. Buscar cliente activo.
     */
    const {
      data: cliente,
      error: clienteError,
    } =
      await supabase
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
          activo
          `
        )
        .eq(
          "id_cliente",
          idCliente
        )
        .eq(
          "activo",
          true
        )
        .maybeSingle();

    if (clienteError) {
      console.error(
        "Error buscando cliente:",
        clienteError
      );

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
            "Cliente no encontrado o inactivo.",
        },
        { status: 404 }
      );
    }

    /*
     * 3. Obtener conexión OneDrive.
     */
    const {
      data: conexion,
      error: conexionError,
    } =
      await supabase
        .from(
          "onedrive_connections"
        )
        .select(
          `
          id,
          refresh_token
          `
        )
        .order(
          "id",
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle();

    if (conexionError) {
      console.error(
        "Error consultando conexión OneDrive:",
        conexionError
      );

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
            "No existe una conexión activa de OneDrive.",
        },
        { status: 500 }
      );
    }

    /*
     * 4. Renovar access_token.
     */
    const tokenResponse =
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
                conexion.refresh_token,
              scope:
                "openid profile offline_access User.Read Files.ReadWrite",
            }),

          cache:
            "no-store",
        }
      );

    const tokenData =
      await leerJsonSeguro(
        tokenResponse
      );

    if (!tokenResponse.ok) {
      console.error(
        "Error renovando token Microsoft:",
        tokenData
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo renovar el acceso a OneDrive.",
          detalle:
            tokenData
              ?.error_description ||
            tokenData?.error ||
            `HTTP ${tokenResponse.status}`,
        },
        { status: 400 }
      );
    }

    const accessToken =
      tokenData
        ?.access_token;

    const nuevoRefreshToken =
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
     * Microsoft puede rotar refresh_token.
     */
    if (
      nuevoRefreshToken &&
      nuevoRefreshToken !==
        conexion.refresh_token
    ) {
      const {
        error:
          updateTokenError,
      } =
        await supabase
          .from(
            "onedrive_connections"
          )
          .update({
            refresh_token:
              nuevoRefreshToken,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            conexion.id
          );

      if (
        updateTokenError
      ) {
        console.error(
          "No se pudo guardar refresh_token rotado:",
          updateTokenError
        );
      }
    }

    /*
     * 5. Resolver el folderId correcto.
     *
     * Primero validamos el ID guardado.
     * Si ya no existe, buscamos nuevamente
     * la carpeta física del cliente en OneDrive.
     */
    let folderId =
      String(
        cliente
          .onedrive_folder_id ||
        ""
      ).trim();

    let carpetaDetectada:
      CarpetaOneDrive |
      null = null;

    if (folderId) {
      const validacion =
        await validarCarpetaPorId(
          accessToken,
          folderId
        );

      if (
        validacion.existe &&
        validacion.carpeta
      ) {
        carpetaDetectada =
          validacion.carpeta;
      } else {
        console.warn(
          "FolderId guardado inválido; se intentará recuperar:",
          {
            id_cliente:
              cliente.id_cliente,
            folderId,
            status:
              validacion.status,
            detalle:
              validacion.detalle,
          }
        );

        folderId = "";
      }
    }

    /*
     * Si el ID no existe o es inválido,
     * recuperamos la carpeta real.
     */
    if (!folderId) {
      const busqueda =
        await buscarCarpetaFisicaCliente(
          accessToken,
          Number(
            cliente.id_cliente
          ),
          cliente
            .carpeta_cliente
        );

      if (
        !busqueda.carpeta
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              busqueda.error ||
              "No se pudo localizar la carpeta del cliente en OneDrive.",
            detalle:
              busqueda.detalle,
          },
          { status: 404 }
        );
      }

      carpetaDetectada =
        busqueda.carpeta;

      folderId =
        busqueda.carpeta.id;

      /*
       * Autorreparación:
       * guardamos el ID actual en Supabase.
       */
      const {
        error:
          actualizarFolderError,
      } =
        await supabase
          .from(
            "clientes_inventario"
          )
          .update({
            onedrive_folder_id:
              folderId,
            carpeta_cliente:
              busqueda.carpeta
                .name,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            cliente.id
          );

      if (
        actualizarFolderError
      ) {
        console.error(
          "La carpeta fue recuperada pero no se pudo actualizar Supabase:",
          actualizarFolderError
        );
      }
    }

    /*
     * 6. Crear sesión de carga.
     */
    let {
      response:
        sessionResponse,
      data:
        sessionData,
    } =
      await crearUploadSession(
        accessToken,
        folderId,
        nombreArchivo
      );

    /*
     * Segunda defensa:
     * si Microsoft todavía devuelve itemNotFound,
     * volvemos a resolver la carpeta una sola vez
     * y reintentamos automáticamente.
     */
    const graphCodeInicial =
      sessionData
        ?.error?.code;

    if (
      !sessionResponse.ok &&
      (
        sessionResponse.status ===
          404 ||
        graphCodeInicial ===
          "itemNotFound"
      )
    ) {
      const busqueda =
        await buscarCarpetaFisicaCliente(
          accessToken,
          Number(
            cliente.id_cliente
          ),
          cliente
            .carpeta_cliente
        );

      if (
        busqueda.carpeta &&
        busqueda.carpeta.id !==
          folderId
      ) {
        folderId =
          busqueda.carpeta.id;

        carpetaDetectada =
          busqueda.carpeta;

        await supabase
          .from(
            "clientes_inventario"
          )
          .update({
            onedrive_folder_id:
              folderId,
            carpeta_cliente:
              busqueda.carpeta
                .name,
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            cliente.id
          );

        const reintento =
          await crearUploadSession(
            accessToken,
            folderId,
            nombreArchivo
          );

        sessionResponse =
          reintento.response;

        sessionData =
          reintento.data;
      }
    }

    if (
      !sessionResponse.ok
    ) {
      console.error(
        "Error creando upload session:",
        {
          status:
            sessionResponse.status,
          statusText:
            sessionResponse.statusText,
          sessionData,
          id_cliente:
            cliente.id_cliente,
          folderId,
          carpeta:
            carpetaDetectada
              ?.name ||
            cliente
              .carpeta_cliente,
        }
      );

      const graphCode =
        sessionData
          ?.error?.code;

      const graphMessage =
        sessionData
          ?.error?.message;

      const detalle =
        [
          graphCode
            ? `Código: ${graphCode}`
            : "",
          graphMessage
            ? `Microsoft: ${graphMessage}`
            : "",
          `HTTP: ${sessionResponse.status}`,
        ]
          .filter(Boolean)
          .join(" | ");

      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo preparar la subida del archivo en OneDrive.",
          detalle:
            detalle ||
            "Microsoft Graph rechazó createUploadSession.",
        },
        {
          status:
            sessionResponse.status >=
              400 &&
            sessionResponse.status <
              600
              ? sessionResponse.status
              : 400,
        }
      );
    }

    const uploadUrl =
      String(
        sessionData
          ?.uploadUrl ||
        ""
      ).trim();

    if (!uploadUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Microsoft no devolvió uploadUrl.",
        },
        { status: 400 }
      );
    }

    /*
     * 7. Respuesta.
     * Nunca devolvemos credenciales.
     */
    return NextResponse.json({
      success: true,

      cliente: {
        id_cliente:
          cliente.id_cliente,
        nombre:
          cliente.nombre,
        carpeta:
          carpetaDetectada
            ?.name ||
          cliente
            .carpeta_cliente,
      },

      archivo: {
        nombre:
          nombreArchivo,
        tamaño,
      },

      uploadUrl,

      expirationDateTime:
        sessionData
          ?.expirationDateTime ||
        null,
    });
  } catch (error: unknown) {
    console.error(
      "Error API inventarios/subir:",
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