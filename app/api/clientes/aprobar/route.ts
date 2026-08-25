import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_CLIENTES =
  "Envios/Recoleccion por cliente";

const RUTA_EXCEL =
  "Envios/control_recolecciones_bodega.xlsx";

const HOJA_CLIENTES =
  "Clientes";

type AprobarBody = {
  solicitud_id?: number | string;
};

function limpiarTexto(valor: unknown) {
  return String(valor || "")
    .trim()
    .replace(/\s+/g, " ");
}

function numeroCliente(valor: number) {
  return String(valor).padStart(
    5,
    "0"
  );
}

function convertirIdCliente(
  valor: unknown
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero =
    Number(
      String(valor)
        .trim()
        .replace(/^#/, "")
    );

  if (
    !Number.isFinite(numero) ||
    numero <= 0
  ) {
    return null;
  }

  return Math.trunc(numero);
}

async function leerJsonSeguro(
  response: Response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function renovarToken(
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
      `No se pudo descargar ${RUTA_EXCEL}. HTTP ${response.status}. ${detalle}`
    );
  }

  return await response.arrayBuffer();
}

async function subirExcel(
  accessToken: string,
  contenido: Buffer
) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_EXCEL
    )}:/content`;

  /*
   * RequestInit de TypeScript no acepta directamente
   * Buffer<ArrayBufferLike> como BodyInit.
   * Creamos un ArrayBuffer real para enviar el XLSX.
   */
  const cuerpo =
    Uint8Array.from(
      contenido
    ).buffer;

  const response =
    await fetch(
      url,
      {
        method: "PUT",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: cuerpo,
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
        `No se pudo actualizar el Excel. HTTP ${response.status}.`
    );
  }

  return data;
}

async function obtenerCarpetaRaizClientes(
  accessToken: string
) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_CLIENTES
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

  if (
    !response.ok ||
    !data?.id
  ) {
    throw new Error(
      data?.error?.message ||
        `No se encontró la carpeta ${RUTA_CLIENTES}.`
    );
  }

  return String(
    data.id
  );
}

async function crearCarpetaCliente(
  accessToken: string,
  rootFolderId: string,
  nombreCarpeta: string
) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
      rootFolderId
    )}/children`;

  const response =
    await fetch(
      url,
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

  const data =
    await leerJsonSeguro(
      response
    );

  if (!response.ok) {
    const code =
      data?.error?.code;

    if (
      response.status === 409 ||
      code === "nameAlreadyExists"
    ) {
      throw new Error(
        `Ya existe una carpeta llamada "${nombreCarpeta}" en OneDrive. Revisa antes de aprobar para evitar duplicados.`
      );
    }

    throw new Error(
      data?.error?.message ||
        `No se pudo crear la carpeta del cliente. HTTP ${response.status}.`
    );
  }

  if (!data?.id) {
    throw new Error(
      "OneDrive creó la carpeta pero no devolvió su ID."
    );
  }

  return {
    id:
      String(data.id),
    name:
      String(
        data.name ||
        nombreCarpeta
      ),
  };
}

async function eliminarCarpeta(
  accessToken: string,
  folderId: string
) {
  try {
    await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
        folderId
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
  } catch (
    error
  ) {
    console.error(
      "No se pudo revertir la carpeta creada:",
      error
    );
  }
}

export async function POST(
  request: Request
) {
  let carpetaCreadaId =
    "";

  let accessTokenActivo =
    "";

  try {
    const body =
      (await request.json()) as AprobarBody;

    const solicitudId =
      Number(
        body?.solicitud_id
      );

    if (
      !Number.isInteger(
        solicitudId
      ) ||
      solicitudId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La solicitud no es válida.",
        },
        { status: 400 }
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
     * 1. Leer solicitud pendiente.
     */
    const {
      data:
        solicitud,
      error:
        solicitudError,
    } =
      await supabase
        .from(
          "solicitudes_clientes"
        )
        .select(
          `
          id,
          folio,
          nombre,
          telefono,
          direccion,
          referencia_domicilio,
          estado
          `
        )
        .eq(
          "id",
          solicitudId
        )
        .maybeSingle();

    if (
      solicitudError
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo consultar la solicitud.",
          detalle:
            solicitudError.message,
        },
        { status: 500 }
      );
    }

    if (!solicitud) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Solicitud no encontrada.",
        },
        { status: 404 }
      );
    }

    if (
      solicitud.estado !==
      "pendiente"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Esta solicitud ya fue procesada.",
        },
        { status: 409 }
      );
    }

    /*
     * 2. Obtener conexión OneDrive.
     */
    const {
      data:
        conexion,
      error:
        conexionError,
    } =
      await supabase
        .from(
          "onedrive_connections"
        )
        .select(
          "id, refresh_token"
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

    if (
      conexionError ||
      !conexion
        ?.refresh_token
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No existe una conexión activa de OneDrive.",
          detalle:
            conexionError
              ?.message ||
            null,
        },
        { status: 500 }
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
      await renovarToken(
        clientId,
        clientSecret,
        conexion.refresh_token
      );

    if (
      !tokenResponse.ok ||
      !tokenData
        ?.access_token
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
            `HTTP ${tokenResponse.status}`,
        },
        { status: 400 }
      );
    }

    const accessToken =
      String(
        tokenData
          .access_token
      );

    accessTokenActivo =
      accessToken;

    const nuevoRefreshToken =
      tokenData
        ?.refresh_token;

    if (
      nuevoRefreshToken &&
      nuevoRefreshToken !==
        conexion.refresh_token
    ) {
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
    }

    /*
     * 4. Descargar Excel y calcular siguiente ID.
     */
    const excelBuffer =
      await descargarExcel(
        accessToken
      );

    const workbook =
      XLSX.read(
        Buffer.from(
          excelBuffer
        ),
        {
          type: "buffer",
        }
      );

    const hoja =
      workbook.Sheets[
        HOJA_CLIENTES
      ];

    if (!hoja) {
      return NextResponse.json(
        {
          success: false,
          error:
            `El Excel no contiene la hoja "${HOJA_CLIENTES}".`,
        },
        { status: 400 }
      );
    }

    const filas =
      XLSX.utils.sheet_to_json<
        Record<
          string,
          unknown
        >
      >(
        hoja,
        {
          defval: "",
          raw: false,
        }
      );

    /*
     * Evitar duplicar teléfono en el Excel.
     */
    const telefono =
      String(
        solicitud.telefono ||
        ""
      ).replace(
        /\D/g,
        ""
      );

    const existeTelefono =
      filas.some(
        (fila) =>
          String(
            fila[
              "TelefonoWhatsApp"
            ] ||
            ""
          )
            .replace(
              /\D/g,
              ""
            ) ===
          telefono
      );

    if (
      existeTelefono
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Este teléfono ya aparece en la hoja Clientes del Excel.",
        },
        { status: 409 }
      );
    }

    let maxId =
      0;

    for (
      const fila of filas
    ) {
      const id =
        convertirIdCliente(
          fila[
            "ID Cliente"
          ]
        );

      if (
        id &&
        id > maxId
      ) {
        maxId = id;
      }
    }

    const nuevoId =
      maxId + 1;

    const nombre =
      limpiarTexto(
        solicitud.nombre
      );

    const carpetaCliente =
      `${numeroCliente(
        nuevoId
      )} ${nombre}`;

    /*
     * 5. Crear carpeta física en OneDrive.
     */
    const rootFolderId =
      await obtenerCarpetaRaizClientes(
        accessToken
      );

    const carpeta =
      await crearCarpetaCliente(
        accessToken,
        rootFolderId,
        carpetaCliente
      );

    carpetaCreadaId =
      carpeta.id;

    /*
     * 6. Agregar nueva fila al Excel.
     *
     * Si Dirección o ReferenciaDomicilio no existían
     * como columnas, XLSX las agregará al guardar.
     */
    filas.push({
      "ID Cliente":
        nuevoId,
      Nombre:
        nombre,
      CarpetaCliente:
        carpetaCliente,
      TelefonoWhatsApp:
        telefono,
      Direccion:
        limpiarTexto(
          solicitud.direccion
        ),
      ReferenciaDomicilio:
        limpiarTexto(
          solicitud
            .referencia_domicilio
        ),
    });

    const nuevaHoja =
      XLSX.utils.json_to_sheet(
        filas
      );

    workbook.Sheets[
      HOJA_CLIENTES
    ] = nuevaHoja;

    const nuevoExcel =
      XLSX.write(
        workbook,
        {
          type: "buffer",
          bookType:
            "xlsx",
        }
      );

    try {
      await subirExcel(
        accessToken,
        nuevoExcel
      );
    } catch (
      error
    ) {
      await eliminarCarpeta(
        accessToken,
        carpeta.id
      );

      carpetaCreadaId =
        "";

      throw error;
    }

    /*
     * 7. Crear cliente de inventario en Supabase.
     */
    const tokenInventario =
      randomUUID();

    const {
      error:
        clienteInsertError,
    } =
      await supabase
        .from(
          "clientes_inventario"
        )
        .insert({
          id_cliente:
            nuevoId,
          nombre,
          carpeta_cliente:
            carpetaCliente,
          onedrive_folder_id:
            carpeta.id,
          token_inventario:
            tokenInventario,
          activo:
            true,
          updated_at:
            new Date()
              .toISOString(),
        });

    if (
      clienteInsertError
    ) {
      console.error(
        "El Excel y OneDrive se actualizaron, pero falló clientes_inventario:",
        clienteInsertError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "El cliente se agregó al Excel y se creó su carpeta, pero no se pudo crear su inventario en Supabase.",
          detalle:
            clienteInsertError.message,
          requiere_revision:
            true,
          id_cliente:
            nuevoId,
          carpeta:
            carpetaCliente,
        },
        { status: 500 }
      );
    }

    /*
     * 8. Marcar solicitud como aprobada.
     */
    const {
      error:
        solicitudUpdateError,
    } =
      await supabase
        .from(
          "solicitudes_clientes"
        )
        .update({
          estado:
            "aprobado",
          id_cliente_asignado:
            nuevoId,
          carpeta_cliente:
            carpetaCliente,
          onedrive_folder_id:
            carpeta.id,
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          solicitud.id
        );

    if (
      solicitudUpdateError
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El cliente fue creado, pero no se pudo actualizar el estado de la solicitud.",
          detalle:
            solicitudUpdateError.message,
          requiere_revision:
            true,
          id_cliente:
            nuevoId,
          carpeta:
            carpetaCliente,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cliente: {
        id_cliente:
          nuevoId,
        nombre,
        telefono,
        direccion:
          solicitud.direccion,
        referencia_domicilio:
          solicitud
            .referencia_domicilio,
        carpeta_cliente:
          carpetaCliente,
        onedrive_folder_id:
          carpeta.id,
        token_inventario:
          tokenInventario,
      },
    });
  } catch (
    error: unknown
  ) {
    /*
     * Si ocurrió un error antes de actualizar Excel
     * y quedó una carpeta recién creada, intentamos
     * eliminarla para evitar basura.
     */
    if (
      carpetaCreadaId &&
      accessTokenActivo
    ) {
      await eliminarCarpeta(
        accessTokenActivo,
        carpetaCreadaId
      );
    }

    console.error(
      "Error API clientes/aprobar:",
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