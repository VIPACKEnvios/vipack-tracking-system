import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_CLIENTES =
  "Envios/Recoleccion por cliente";

type ClienteInventario = {
  id: number;
  id_cliente: number;
  nombre: string;
  carpeta_cliente: string | null;
  onedrive_folder_id: string | null;
  token_inventario: string | null;
  activo: boolean;
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

function numeroCliente(
  valor: number
) {
  return String(valor).padStart(
    5,
    "0"
  );
}

async function renovarTokenOneDrive(
  clientId: string,
  clientSecret: string,
  refreshToken: string
) {
  const response = await fetch(
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body:
        new URLSearchParams({
          client_id: clientId,
          client_secret:
            clientSecret,
          grant_type:
            "refresh_token",
          refresh_token:
            refreshToken,
          scope:
            "openid profile offline_access User.Read Files.ReadWrite",
        }),
      cache: "no-store",
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

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const idCliente =
      Number(
        body?.id_cliente
      );

    if (
      !Number.isFinite(
        idCliente
      ) ||
      idCliente <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ID de cliente inválido.",
        },
        {
          status: 400,
        }
      );
    }

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
        {
          status: 500,
        }
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
     * 1. Buscar cliente en Supabase.
     */
    const {
      data:
        clienteData,
      error:
        clienteError,
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
        "id_cliente",
        idCliente
      )
      .maybeSingle();

    if (
      clienteError
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo consultar el cliente.",
          detalle:
            clienteError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !clienteData
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El cliente no existe.",
        },
        {
          status: 404,
        }
      );
    }

    const cliente =
      clienteData as ClienteInventario;

    /*
     * 2. Obtener conexión de OneDrive.
     */
    const {
      data:
        conexion,
      error:
        conexionError,
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

    if (
      conexionError
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo consultar la conexión de OneDrive.",
          detalle:
            conexionError.message,
        },
        {
          status: 500,
        }
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
        {
          status: 400,
        }
      );
    }

    /*
     * 3. Renovar token.
     */
    const {
      response:
        tokenResponse,
      data:
        tokenData,
    } =
      await renovarTokenOneDrive(
        clientId,
        clientSecret,
        conexion
          .refresh_token
      );

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
            tokenData ||
            `HTTP ${tokenResponse.status}`,
        },
        {
          status: 400,
        }
      );
    }

    const accessToken =
      tokenData
        ?.access_token;

    const newRefreshToken =
      tokenData
        ?.refresh_token;

    if (
      !accessToken
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Microsoft no devolvió access_token.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Guardar refresh token nuevo
     * si Microsoft lo rotó.
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
     * 4. Obtener carpeta principal.
     */
    const rootFolderUrl =
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
        RUTA_CLIENTES
      )}?$select=id,name,folder`;

    const rootResponse =
      await fetch(
        rootFolderUrl,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          cache:
            "no-store",
        }
      );

    const rootData =
      await leerJsonSeguro(
        rootResponse
      );

    if (
      !rootResponse.ok ||
      !rootData?.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se encontró la carpeta principal de clientes en OneDrive.",
          detalle:
            rootData ||
            `HTTP ${rootResponse.status}`,
        },
        {
          status: 400,
        }
      );
    }

    const rootFolderId =
      String(
        rootData.id
      );

    /*
     * 5. Construir nombre de carpeta.
     */
    const prefijo =
      numeroCliente(
        cliente.id_cliente
      );

    const nombreCarpeta =
      cliente
        .carpeta_cliente
        ?.trim() ||
      `${prefijo} ${cliente.nombre}`;

    /*
     * 6. Revisar si ya existe una carpeta
     * con el mismo número.
     */
    const childrenUrl =
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
        rootFolderId
      )}/children?$select=id,name,folder&$top=999`;

    const childrenResponse =
      await fetch(
        childrenUrl,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          cache:
            "no-store",
        }
      );

    const childrenData =
      await leerJsonSeguro(
        childrenResponse
      );

    if (
      !childrenResponse.ok
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudieron revisar las carpetas existentes.",
          detalle:
            childrenData ||
            `HTTP ${childrenResponse.status}`,
        },
        {
          status: 400,
        }
      );
    }

    const carpetas =
      Array.isArray(
        childrenData?.value
      )
        ? childrenData.value.filter(
            (item: any) =>
              item?.folder
          )
        : [];

    const existente =
      carpetas.find(
        (item: any) => {
          const nombre =
            String(
              item.name || ""
            ).trim();

          return (
            nombre === prefijo ||
            nombre.startsWith(
              `${prefijo} `
            )
          );
        }
      );

    /*
     * Si ya existe físicamente,
     * solo volvemos a vincularla.
     */
    if (
      existente?.id
    ) {
      const {
        error:
          actualizarError,
      } = await supabase
        .from(
          "clientes_inventario"
        )
        .update({
          carpeta_cliente:
            existente.name,
          onedrive_folder_id:
            existente.id,
          activo:
            true,
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          cliente.id
        );

      if (
        actualizarError
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "La carpeta existe, pero no se pudo volver a vincular.",
            detalle:
              actualizarError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        success: true,
        creada: false,
        vinculada: true,
        carpeta: {
          id:
            existente.id,
          nombre:
            existente.name,
        },
        mensaje:
          "La carpeta ya existía y fue vinculada nuevamente.",
      });
    }

    /*
     * 7. Crear carpeta nueva.
     */
    const crearResponse =
      await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
          rootFolderId
        )}/children`,
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
              name:
                nombreCarpeta,
              folder: {},
              "@microsoft.graph.conflictBehavior":
                "fail",
            }),
          cache:
            "no-store",
        }
      );

    const crearData =
      await leerJsonSeguro(
        crearResponse
      );

    if (
      !crearResponse.ok ||
      !crearData?.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo crear la carpeta del cliente en OneDrive.",
          detalle:
            crearData ||
            `HTTP ${crearResponse.status}`,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 8. Guardar nuevo ID en Supabase.
     */
    const {
      error:
        guardarError,
    } = await supabase
      .from(
        "clientes_inventario"
      )
      .update({
        carpeta_cliente:
          crearData.name ||
          nombreCarpeta,
        onedrive_folder_id:
          crearData.id,
        activo:
          true,
        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        cliente.id
      );

    if (
      guardarError
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La carpeta fue creada en OneDrive, pero no se pudo guardar la vinculación.",
          detalle:
            guardarError.message,
          carpeta_creada: {
            id:
              crearData.id,
            nombre:
              crearData.name ||
              nombreCarpeta,
          },
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      creada: true,
      vinculada: true,
      carpeta: {
        id:
          crearData.id,
        nombre:
          crearData.name ||
          nombreCarpeta,
      },
      cliente: {
        id_cliente:
          cliente.id_cliente,
        nombre:
          cliente.nombre,
      },
      mensaje:
        "Carpeta creada y vinculada correctamente.",
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error creando carpeta de cliente:",
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