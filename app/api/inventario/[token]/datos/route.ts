import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_EXCEL =
  "Envios/control_recolecciones_bodega.xlsx";

const HOJA_CLIENTES =
  "Clientes";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

type DatosBody = {
  nombre?: string;
  telefono?: string;
  direccion?: string;
  referencia_domicilio?: string;
};

function limpiarTexto(valor: unknown) {
  return String(valor || "")
    .trim()
    .replace(/\s+/g, " ");
}

function limpiarTelefono(valor: unknown) {
  return String(valor || "").replace(/\D/g, "");
}

function convertirIdCliente(valor: unknown) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero = Number(
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

function numeroCliente(valor: number) {
  return String(valor).padStart(5, "0");
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

function obtenerSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !supabaseServiceRoleKey
  ) {
    throw new Error(
      "Falta configuración de Supabase."
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

async function obtenerClientePorToken(
  supabase: any,
  token: string
) {
  const {
    data: cliente,
    error,
  } = await supabase
    .from("clientes_inventario")
    .select(`
      id,
      id_cliente,
      nombre,
      carpeta_cliente,
      onedrive_folder_id,
      token_inventario,
      activo
    `)
    .eq("token_inventario", token)
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar el cliente: ${error.message}`
    );
  }

  return cliente;
}

async function obtenerSolicitudAprobada(
  supabase: any,
  clienteId: number
) {
  const {
    data,
    error,
  } = await supabase
    .from("solicitudes_clientes")
    .select(`
      id,
      folio,
      nombre,
      telefono,
      direccion,
      referencia_domicilio,
      estado,
      id_cliente_asignado,
      carpeta_cliente,
      onedrive_folder_id
    `)
    .eq("id_cliente_asignado", clienteId)
    .eq("estado", "aprobado")
    .order("updated_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudieron consultar los datos del cliente: ${error.message}`
    );
  }

  return data;
}

async function obtenerConexionOneDrive(
  supabase: any
) {
  const {
    data: conexion,
    error,
  } = await supabase
    .from("onedrive_connections")
    .select("id, refresh_token")
    .order("id", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (
    error ||
    !conexion?.refresh_token
  ) {
    throw new Error(
      "No existe una conexión activa con OneDrive."
    );
  }

  return conexion;
}

async function renovarToken(
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
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope:
          "openid profile offline_access User.Read Files.ReadWrite",
      }),
      cache: "no-store",
    }
  );

  const data =
    await leerJsonSeguro(response);

  if (
    !response.ok ||
    !data?.access_token
  ) {
    throw new Error(
      data?.error_description ||
        data?.error ||
        "No se pudo renovar el acceso a OneDrive."
    );
  }

  return {
    accessToken: String(
      data.access_token
    ),
    refreshToken:
      data?.refresh_token
        ? String(data.refresh_token)
        : null,
  };
}

async function descargarExcel(
  accessToken: string
) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_EXCEL
    )}:/content`;

  const response = await fetch(
    url,
    {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const detalle =
      await response.text();

    throw new Error(
      `No se pudo descargar ${RUTA_EXCEL}. HTTP ${response.status}. ${detalle}`
    );
  }

  return Buffer.from(
    await response.arrayBuffer()
  );
}

async function subirExcel(
  accessToken: string,
  contenido: Buffer
) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_EXCEL
    )}:/content`;

  const response = await fetch(
    url,
    {
      method: "PUT",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      body: new Uint8Array(contenido),
      cache: "no-store",
    }
  );

  const data =
    await leerJsonSeguro(response);

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `No se pudo actualizar el Excel. HTTP ${response.status}.`
    );
  }

  return data;
}

async function renombrarCarpeta(
  accessToken: string,
  folderId: string,
  nuevoNombre: string
) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
      folderId
    )}`,
    {
      method: "PATCH",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        name: nuevoNombre,
      }),
      cache: "no-store",
    }
  );

  const data =
    await leerJsonSeguro(response);

  if (!response.ok) {
    const codigo =
      data?.error?.code;

    if (
      response.status === 409 ||
      codigo === "nameAlreadyExists"
    ) {
      throw new Error(
        `Ya existe una carpeta llamada "${nuevoNombre}" en OneDrive.`
      );
    }

    throw new Error(
      data?.error?.message ||
        `No se pudo renombrar la carpeta. HTTP ${response.status}.`
    );
  }

  return data;
}

export async function GET(
  _request: Request,
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

    const supabase =
      obtenerSupabase();

    const cliente =
      await obtenerClientePorToken(
        supabase,
        token
      );

    if (!cliente?.id_cliente) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cliente no encontrado o acceso inactivo.",
        },
        { status: 404 }
      );
    }

    const solicitud =
      await obtenerSolicitudAprobada(
        supabase,
        Number(cliente.id_cliente)
      );

    return NextResponse.json({
      success: true,
      cliente: {
        id_cliente:
          Number(cliente.id_cliente),
        nombre:
          limpiarTexto(
            solicitud?.nombre ||
              cliente.nombre
          ),
        telefono:
          limpiarTelefono(
            solicitud?.telefono
          ),
        direccion:
          limpiarTexto(
            solicitud?.direccion
          ),
        referencia_domicilio:
          limpiarTexto(
            solicitud
              ?.referencia_domicilio
          ),
      },
    });
  } catch (error: unknown) {
    console.error(
      "Error GET datos cliente:",
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

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  let accessToken = "";
  let folderId = "";
  let nombreCarpetaAnterior = "";
  let carpetaRenombrada = false;
  let excelOriginal: Buffer | null = null;

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

    const body =
      (await request.json()) as DatosBody;

    const nombre =
      limpiarTexto(body?.nombre);

    const telefono =
      limpiarTelefono(
        body?.telefono
      );

    const direccion =
      limpiarTexto(
        body?.direccion
      );

    const referenciaDomicilio =
      limpiarTexto(
        body?.referencia_domicilio
      );

    if (nombre.length < 3) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ingresa tu nombre completo.",
        },
        { status: 400 }
      );
    }

    if (telefono.length !== 10) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El teléfono debe tener 10 dígitos.",
        },
        { status: 400 }
      );
    }

    if (!direccion) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ingresa tu dirección completa.",
        },
        { status: 400 }
      );
    }

    if (!referenciaDomicilio) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ingresa una referencia del domicilio.",
        },
        { status: 400 }
      );
    }

    const clientId =
      process.env.ONEDRIVE_CLIENT_ID;

    const clientSecret =
      process.env.ONEDRIVE_CLIENT_SECRET;

    if (
      !clientId ||
      !clientSecret
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta configuración de OneDrive.",
        },
        { status: 500 }
      );
    }

    const supabase =
      obtenerSupabase();

    const cliente =
      await obtenerClientePorToken(
        supabase,
        token
      );

    if (
      !cliente?.id_cliente ||
      !cliente?.onedrive_folder_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cliente no encontrado o sin carpeta vinculada.",
        },
        { status: 404 }
      );
    }

    const clienteId =
      Number(cliente.id_cliente);

    const solicitudActual =
      await obtenerSolicitudAprobada(
        supabase,
        clienteId
      );

    /*
     * Evitar que el nuevo teléfono
     * quede ligado a otro cliente
     * o a otra solicitud pendiente.
     */
    const {
      data: coincidenciasTelefono,
      error: telefonoError,
    } = await supabase
      .from("solicitudes_clientes")
      .select(
        "id, telefono, estado, id_cliente_asignado"
      )
      .eq("telefono", telefono)
      .in("estado", [
        "pendiente",
        "aprobado",
      ]);

    if (telefonoError) {
      throw new Error(
        `No se pudo validar el teléfono: ${telefonoError.message}`
      );
    }

    const telefonoOcupado =
      (
        coincidenciasTelefono || []
      ).some((item: any) => {
        if (
          solicitudActual &&
          Number(item.id) ===
            Number(solicitudActual.id)
        ) {
          return false;
        }

        return true;
      });

    if (telefonoOcupado) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Este número de teléfono ya pertenece a otro registro VIPACK.",
        },
        { status: 409 }
      );
    }

    const conexion =
      await obtenerConexionOneDrive(
        supabase
      );

    const tokens =
      await renovarToken(
        clientId,
        clientSecret,
        conexion.refresh_token
      );

    accessToken =
      tokens.accessToken;

    if (
      tokens.refreshToken &&
      tokens.refreshToken !==
        conexion.refresh_token
    ) {
      await supabase
        .from("onedrive_connections")
        .update({
          refresh_token:
            tokens.refreshToken,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", conexion.id);
    }

    excelOriginal =
      await descargarExcel(
        accessToken
      );

    const workbook =
      XLSX.read(
        excelOriginal,
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
        Record<string, unknown>
      >(
        hoja,
        {
          defval: "",
          raw: false,
        }
      );

    const indiceCliente =
      filas.findIndex(
        (fila) =>
          convertirIdCliente(
            fila["ID Cliente"]
          ) === clienteId
      );

    if (indiceCliente < 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            `No se encontró al cliente #${numeroCliente(
              clienteId
            )} en la hoja Clientes del Excel.`,
        },
        { status: 404 }
      );
    }

    const telefonoDuplicadoExcel =
      filas.some(
        (fila, index) =>
          index !== indiceCliente &&
          limpiarTelefono(
            fila[
              "TelefonoWhatsApp"
            ]
          ) === telefono
      );

    if (
      telefonoDuplicadoExcel
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Este teléfono ya pertenece a otro cliente en el Excel.",
        },
        { status: 409 }
      );
    }

    /*
     * Conservamos el MISMO número de cliente.
     * Solo cambia el nombre visible de la carpeta.
     */
    const nuevaCarpeta =
      `${numeroCliente(
        clienteId
      )} ${nombre}`;

    nombreCarpetaAnterior =
      limpiarTexto(
        cliente.carpeta_cliente
      );

    folderId =
      String(
        cliente.onedrive_folder_id
      );

    filas[indiceCliente] = {
      ...filas[indiceCliente],
      "ID Cliente":
        clienteId,
      Nombre:
        nombre,
      CarpetaCliente:
        nuevaCarpeta,
      TelefonoWhatsApp:
        telefono,
      Direccion:
        direccion,
      ReferenciaDomicilio:
        referenciaDomicilio,
    };

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
          bookType: "xlsx",
        }
      ) as Buffer;

    /*
     * 1. Renombrar carpeta física.
     * El folderId NO cambia.
     */
    if (
      nuevaCarpeta !==
      nombreCarpetaAnterior
    ) {
      await renombrarCarpeta(
        accessToken,
        folderId,
        nuevaCarpeta
      );

      carpetaRenombrada = true;
    }

    /*
     * 2. Actualizar Excel.
     */
    try {
      await subirExcel(
        accessToken,
        nuevoExcel
      );
    } catch (error) {
      if (
        carpetaRenombrada &&
        nombreCarpetaAnterior
      ) {
        try {
          await renombrarCarpeta(
            accessToken,
            folderId,
            nombreCarpetaAnterior
          );
        } catch (
          rollbackError
        ) {
          console.error(
            "No se pudo revertir el nombre de la carpeta:",
            rollbackError
          );
        }
      }

      throw error;
    }

    /*
     * 3. Actualizar índices en Supabase.
     * NO cambiamos:
     * - id_cliente
     * - onedrive_folder_id
     * - token_inventario
     */
    const {
      error:
        clienteUpdateError,
    } = await supabase
      .from("clientes_inventario")
      .update({
        nombre,
        carpeta_cliente:
          nuevaCarpeta,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        cliente.id
      );

    if (clienteUpdateError) {
      /*
       * Intentamos regresar Excel y carpeta
       * al estado anterior para no dejar
       * sistemas desincronizados.
       */
      if (excelOriginal) {
        try {
          await subirExcel(
            accessToken,
            excelOriginal
          );
        } catch (
          rollbackExcelError
        ) {
          console.error(
            "No se pudo revertir el Excel:",
            rollbackExcelError
          );
        }
      }

      if (
        carpetaRenombrada &&
        nombreCarpetaAnterior
      ) {
        try {
          await renombrarCarpeta(
            accessToken,
            folderId,
            nombreCarpetaAnterior
          );
        } catch (
          rollbackFolderError
        ) {
          console.error(
            "No se pudo revertir la carpeta:",
            rollbackFolderError
          );
        }
      }

      throw new Error(
        `No se pudo actualizar el inventario del cliente: ${clienteUpdateError.message}`
      );
    }

    /*
     * 4. Actualizar la solicitud aprobada
     * para que el panel administrativo
     * también muestre los datos corregidos.
     */
    if (solicitudActual?.id) {
      const {
        error:
          solicitudUpdateError,
      } = await supabase
        .from(
          "solicitudes_clientes"
        )
        .update({
          nombre,
          telefono,
          direccion,
          referencia_domicilio:
            referenciaDomicilio,
          carpeta_cliente:
            nuevaCarpeta,
          onedrive_folder_id:
            folderId,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          solicitudActual.id
        );

      if (
        solicitudUpdateError
      ) {
        console.error(
          "Datos principales actualizados, pero no se pudo actualizar solicitudes_clientes:",
          solicitudUpdateError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "Los datos principales se actualizaron, pero el historial administrativo requiere revisión.",
            requiere_revision:
              true,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      cliente: {
        id_cliente:
          clienteId,
        nombre,
        telefono,
        direccion,
        referencia_domicilio:
          referenciaDomicilio,
        carpeta_cliente:
          nuevaCarpeta,
        onedrive_folder_id:
          folderId,
      },
    });
  } catch (error: unknown) {
    console.error(
      "Error PATCH datos cliente:",
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