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

type CarpetaOneDrive = {
  id: string;
  name: string;
  folder?: {
    childCount?: number;
  };
};

type ClienteExcel = {
  id_cliente: number;
  nombre: string;
  carpeta_cliente: string;
  telefono_whatsapp: string | null;
};

type ClienteSupabase = {
  id: number;
  id_cliente: number;
  nombre: string;
  carpeta_cliente: string | null;
  onedrive_folder_id: string | null;
  token_inventario: string | null;
  activo: boolean;
};

function normalizar(
  valor: unknown
) {
  return String(valor || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

function numeroCliente(
  valor: number
) {
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
        .replace(
          /^#/,
          ""
        )
    );

  if (
    !Number.isFinite(numero) ||
    numero <= 0
  ) {
    return null;
  }

  return Math.trunc(numero);
}

function convertirTelefono(
  valor: unknown
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const texto =
    String(valor)
      .trim();

  return texto || null;
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

async function renovarTokenOneDrive(
  clientId: string,
  clientSecret: string,
  refreshToken: string
) {
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
              refreshToken,

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

  return {
    response:
      tokenResponse,

    data:
      tokenData,
  };
}

async function leerClientesExcel(
  accessToken: string
): Promise<ClienteExcel[]> {
  /*
   * Microsoft Graph permite descargar el archivo
   * directamente por ruta usando /content.
   *
   * fetch() en Node sigue automáticamente la
   * redirección 302 al enlace de descarga temporal.
   */
  const excelUrl =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_EXCEL
    )}:/content`;

  const excelResponse =
    await fetch(
      excelUrl,
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
    !excelResponse.ok
  ) {
    let detalle = "";

    try {
      detalle =
        await excelResponse.text();
    } catch {
      detalle = "";
    }

    throw new Error(
      detalle
        ? `No se pudo descargar ${RUTA_EXCEL}. HTTP ${excelResponse.status}: ${detalle}`
        : `No se pudo descargar ${RUTA_EXCEL}. HTTP ${excelResponse.status}.`
    );
  }

  const arrayBuffer =
    await excelResponse.arrayBuffer();

  const workbook =
    XLSX.read(
      Buffer.from(
        arrayBuffer
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
    throw new Error(
      `El Excel no contiene la hoja "${HOJA_CLIENTES}".`
    );
  }

  const filas =
    XLSX.utils.sheet_to_json<
      Record<string, unknown>
    >(
      hoja,
      {
        defval: null,
        raw: false,
      }
    );

  const clientes:
    ClienteExcel[] = [];

  for (
    const fila of filas
  ) {
    const idCliente =
      convertirIdCliente(
        fila["ID Cliente"]
      );

    const nombre =
      String(
        fila["Nombre"] ||
          ""
      ).trim();

    const carpetaExcel =
      String(
        fila[
          "CarpetaCliente"
        ] ||
          ""
      ).trim();

    if (
      !idCliente ||
      !nombre
    ) {
      continue;
    }

    const prefijo =
      numeroCliente(
        idCliente
      );

    const carpetaCliente =
      carpetaExcel ||
      `${prefijo} ${nombre}`;

    clientes.push({
      id_cliente:
        idCliente,

      nombre,

      carpeta_cliente:
        carpetaCliente,

      telefono_whatsapp:
        convertirTelefono(
          fila[
            "TelefonoWhatsApp"
          ]
        ),
    });
  }

  /*
   * Evitar duplicados dentro del propio Excel.
   * Si hubiera dos filas con el mismo ID Cliente,
   * conservamos la última.
   */
  const mapa =
    new Map<
      number,
      ClienteExcel
    >();

  for (
    const cliente of clientes
  ) {
    mapa.set(
      cliente.id_cliente,
      cliente
    );
  }

  return Array.from(
    mapa.values()
  ).sort(
    (a, b) =>
      a.id_cliente -
      b.id_cliente
  );
}

function buscarCarpetaCliente(
  cliente: ClienteExcel,
  carpetas: CarpetaOneDrive[]
) {
  const prefijo =
    numeroCliente(
      cliente.id_cliente
    );

  /*
   * PRIORIDAD 1:
   * número de cliente.
   *
   * Ejemplo:
   * 00091 Irasema Vazquez
   */
  const coincidenciasPorId =
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

  if (
    coincidenciasPorId.length >
    1
  ) {
    return {
      carpeta:
        null,

      metodo:
        null,

      duplicadas:
        coincidenciasPorId,
    };
  }

  if (
    coincidenciasPorId.length ===
    1
  ) {
    return {
      carpeta:
        coincidenciasPorId[0],

      metodo:
        "id_cliente" as const,

      duplicadas:
        [],
    };
  }

  /*
   * PRIORIDAD 2:
   * nombre completo de CarpetaCliente.
   *
   * Esta comparación ignora:
   * - mayúsculas/minúsculas
   * - acentos
   * - espacios repetidos
   */
  const esperado =
    normalizar(
      cliente.carpeta_cliente
    );

  if (!esperado) {
    return {
      carpeta:
        null,

      metodo:
        null,

      duplicadas:
        [],
    };
  }

  const coincidenciasNombre =
    carpetas.filter(
      (carpeta) =>
        normalizar(
          carpeta.name
        ) === esperado
    );

  if (
    coincidenciasNombre.length >
    1
  ) {
    return {
      carpeta:
        null,

      metodo:
        null,

      duplicadas:
        coincidenciasNombre,
    };
  }

  if (
    coincidenciasNombre.length ===
    1
  ) {
    return {
      carpeta:
        coincidenciasNombre[0],

      metodo:
        "nombre_exacto" as const,

      duplicadas:
        [],
    };
  }

  return {
    carpeta:
      null,

    metodo:
      null,

    duplicadas:
      [],
  };
}

export async function POST() {
  try {
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
     * 1. Obtener conexión
     * guardada de OneDrive.
     */
    const {
      data: conexion,
      error:
        connectionError,
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
      connectionError
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No se pudo consultar la conexión de OneDrive.",

          detalle:
            connectionError.message,
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
        { status: 400 }
      );
    }

    /*
     * 2. Renovar access_token.
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
        conexion.refresh_token
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
     * el refresh_token.
     */
    if (
      newRefreshToken &&
      newRefreshToken !==
        conexion.refresh_token
    ) {
      const {
        error:
          updateTokenError,
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
     * 3. LEER EL EXCEL MAESTRO
     * directamente desde OneDrive.
     *
     * Este es ahora el origen
     * de los clientes del ERP.
     */
    let clientesExcel:
      ClienteExcel[];

    try {
      clientesExcel =
        await leerClientesExcel(
          accessToken
        );
    } catch (error) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No se pudo leer el archivo maestro de clientes.",

          detalle:
            error instanceof Error
              ? error.message
              : "Error desconocido.",

          archivo:
            RUTA_EXCEL,

          hoja:
            HOJA_CLIENTES,
        },
        { status: 400 }
      );
    }

    if (
      clientesExcel.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "La hoja Clientes del Excel no contiene clientes válidos.",

          archivo:
            RUTA_EXCEL,
        },
        { status: 400 }
      );
    }

    /*
     * 4. Leer las carpetas que
     * AppSheet ya creó.
     *
     * El ERP NO crea, renombra
     * ni elimina carpetas.
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

          ruta:
            RUTA_CLIENTES,
        },
        { status: 400 }
      );
    }

    const rootFolderId =
      String(
        rootData.id
      );

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
            "No se pudieron leer las carpetas de clientes en OneDrive.",

          detalle:
            childrenData ||
            `HTTP ${childrenResponse.status}`,
        },
        { status: 400 }
      );
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
     * 5. Leer TODOS los registros
     * que ya existen en Supabase.
     *
     * No filtramos por activo porque
     * el Excel maestro vuelve a activar
     * al cliente si aparece ahí.
     */
    const {
      data:
        clientesSupabaseData,

      error:
        clientesError,
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
      .order(
        "id_cliente",
        {
          ascending: true,
        }
      );

    if (
      clientesError
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No se pudieron consultar los clientes en Supabase.",

          detalle:
            clientesError.message,
        },
        { status: 500 }
      );
    }

    const clientesSupabase =
      (
        clientesSupabaseData ||
        []
      ) as ClienteSupabase[];

    const mapaSupabase =
      new Map<
        number,
        ClienteSupabase
      >();

    for (
      const cliente of
      clientesSupabase
    ) {
      mapaSupabase.set(
        Number(
          cliente.id_cliente
        ),
        cliente
      );
    }

    const resultados:
      any[] = [];

    /*
     * 6. Sincronizar cada fila
     * de la hoja Clientes.
     *
     * Excel = fuente maestra.
     *
     * OneDrive/AppSheet =
     * fuente de la carpeta física.
     *
     * Supabase =
     * índice para el ERP.
     */
    for (
      const clienteExcel of
      clientesExcel
    ) {
      const existente =
        mapaSupabase.get(
          clienteExcel.id_cliente
        ) ||
        null;

      const busquedaCarpeta =
        buscarCarpetaCliente(
          clienteExcel,
          carpetas
        );

      if (
        busquedaCarpeta
          .duplicadas.length >
        1
      ) {
        resultados.push({
          id_cliente:
            clienteExcel.id_cliente,

          nombre:
            clienteExcel.nombre,

          carpeta_cliente:
            clienteExcel
              .carpeta_cliente,

          estado:
            "duplicado_onedrive",

          coincidencias:
            busquedaCarpeta
              .duplicadas.map(
                (item) => ({
                  id:
                    item.id,

                  nombre:
                    item.name,
                })
              ),
        });

        continue;
      }

      const carpetaEncontrada =
        busquedaCarpeta.carpeta;

      const metodo =
        busquedaCarpeta.metodo;

      const tokenInventario =
        existente
          ?.token_inventario ||
        randomUUID();

      const tokenGenerado =
        !existente
          ?.token_inventario;

      /*
       * La carpeta detectada directamente en OneDrive
       * tiene prioridad sobre el ID guardado en Supabase.
       *
       * Esto corrige IDs antiguos o inválidos que pueden
       * provocar itemNotFound / HTTP 404 al subir evidencias.
       *
       * Si por alguna razón no se detecta una carpeta física
       * en OneDrive, conservamos temporalmente el ID existente
       * para no romper clientes que aún requieran revisión.
       */
      const folderIdFinal =
        carpetaEncontrada?.id ||
        existente?.onedrive_folder_id ||
        null;

      const carpetaFinal =
        carpetaEncontrada?.name ||
        clienteExcel
          .carpeta_cliente;

      /*
       * 6A. CLIENTE NUEVO:
       * crear registro en Supabase.
       */
      if (!existente) {
        const {
          data:
            insertado,

          error:
            insertError,
        } = await supabase
          .from(
            "clientes_inventario"
          )
          .insert({
            id_cliente:
              clienteExcel.id_cliente,

            nombre:
              clienteExcel.nombre,

            carpeta_cliente:
              carpetaFinal,

            onedrive_folder_id:
              folderIdFinal,

            token_inventario:
              tokenInventario,

            activo:
              true,

            updated_at:
              new Date()
                .toISOString(),
          })
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
          .single();

        if (
          insertError
        ) {
          resultados.push({
            id_cliente:
              clienteExcel.id_cliente,

            nombre:
              clienteExcel.nombre,

            estado:
              "error",

            etapa:
              "crear_cliente_supabase",

            error:
              insertError.message,
          });

          continue;
        }

        if (insertado) {
          mapaSupabase.set(
            clienteExcel
              .id_cliente,
            insertado as ClienteSupabase
          );
        }

        resultados.push({
          id_cliente:
            clienteExcel.id_cliente,

          nombre:
            clienteExcel.nombre,

          carpeta_cliente:
            carpetaFinal,

          onedrive_folder_id:
            folderIdFinal,

          metodo,

          token_generado:
            true,

          estado:
            folderIdFinal
              ? "cliente_creado_vinculado"
              : "cliente_creado_pendiente",
        });

        continue;
      }

      /*
       * 6B. CLIENTE EXISTENTE:
       * actualizar datos desde Excel
       * y vincular carpeta si faltaba.
       */
      const {
        data:
          actualizado,

        error:
          updateError,
      } = await supabase
        .from(
          "clientes_inventario"
        )
        .update({
          nombre:
            clienteExcel.nombre,

          carpeta_cliente:
            carpetaFinal,

          onedrive_folder_id:
            folderIdFinal,

          token_inventario:
            tokenInventario,

          activo:
            true,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          existente.id
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
        .single();

      if (
        updateError
      ) {
        resultados.push({
          id_cliente:
            clienteExcel.id_cliente,

          nombre:
            clienteExcel.nombre,

          estado:
            "error",

          etapa:
            "actualizar_cliente_supabase",

          error:
            updateError.message,
        });

        continue;
      }

      if (actualizado) {
        mapaSupabase.set(
          clienteExcel.id_cliente,
          actualizado as ClienteSupabase
        );
      }

      const teniaCarpeta =
        Boolean(
          existente
            .onedrive_folder_id
        );

      const seVinculoAhora =
        !teniaCarpeta &&
        Boolean(
          folderIdFinal
        );

      resultados.push({
        id_cliente:
          clienteExcel.id_cliente,

        nombre:
          clienteExcel.nombre,

        carpeta_cliente:
          carpetaFinal,

        onedrive_folder_id:
          folderIdFinal,

        metodo,

        token_generado:
          tokenGenerado,

        estado:
          seVinculoAhora
            ? "sincronizado"
            : folderIdFinal
            ? "ya_sincronizado"
            : "pendiente_carpeta",
      });
    }

    /*
     * 7. Resumen.
     *
     * Conservamos algunas propiedades
     * que ya usa la pantalla actual.
     */
    const resumen = {
      total_clientes:
        resultados.length,

      clientes_excel:
        clientesExcel.length,

      clientes_nuevos:
        resultados.filter(
          (item) =>
            item.estado ===
              "cliente_creado_vinculado" ||
            item.estado ===
              "cliente_creado_pendiente"
        ).length,

      clientes_nuevos_vinculados:
        resultados.filter(
          (item) =>
            item.estado ===
            "cliente_creado_vinculado"
        ).length,

      carpetas_creadas:
        0,

      sincronizados:
        resultados.filter(
          (item) =>
            item.estado ===
              "sincronizado" ||
            item.estado ===
              "cliente_creado_vinculado"
        ).length,

      pendientes_carpeta:
        resultados.filter(
          (item) =>
            item.estado ===
              "pendiente_carpeta" ||
            item.estado ===
              "cliente_creado_pendiente"
        ).length,

      ya_sincronizados:
        resultados.filter(
          (item) =>
            item.estado ===
            "ya_sincronizado"
        ).length,

      tokens_generados:
        resultados.filter(
          (item) =>
            item.token_generado ===
            true
        ).length,

      duplicados_onedrive:
        resultados.filter(
          (item) =>
            item.estado ===
            "duplicado_onedrive"
        ).length,

      errores:
        resultados.filter(
          (item) =>
            item.estado ===
            "error"
        ).length,

      carpetas_onedrive:
        carpetas.length,

      archivo_origen:
        RUTA_EXCEL,

      hoja_origen:
        HOJA_CLIENTES,
    };

    return NextResponse.json({
      success: true,

      resumen,

      resultados,

      carpetas_detectadas:
        carpetas.map(
          (carpeta) => ({
            id:
              carpeta.id,

            nombre:
              carpeta.name,
          })
        ),
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error sync clientes Excel/OneDrive:",
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