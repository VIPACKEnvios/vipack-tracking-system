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
  return String(valor ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numeroCliente(valor: number) {
  return String(valor).padStart(5, "0");
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

/*
 * Convierte cualquier teléfono recuperable a texto.
 *
 * Ejemplos:
 *
 * 9611978818
 * -> 5219611978818
 *
 * 529611978818
 * -> 5219611978818
 *
 * 5219611978818
 * -> 5219611978818
 *
 * Si Excel internamente conserva un número como
 * 5219611978818 aunque visualmente muestre
 * 5.21961E+12, raw:true permite recuperarlo.
 */
function normalizarTelefono(
  valor: unknown
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "";
  }

  let texto = "";

  if (
    typeof valor === "number" &&
    Number.isFinite(valor)
  ) {
    texto = Math.trunc(valor).toString();
  } else {
    texto = limpiarTexto(valor);

    /*
     * Por seguridad también manejamos
     * notación científica completa.
     *
     * Ejemplo:
     * 5.219611978818E+12
     */
    if (
      /^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(
        texto
      )
    ) {
      const numero = Number(texto);

      if (Number.isFinite(numero)) {
        texto = Math.trunc(
          numero
        ).toString();
      }
    }
  }

  let telefono = texto.replace(/\D/g, "");

  if (!telefono) {
    return "";
  }

  /*
   * 10 dígitos nacionales
   */
  if (telefono.length === 10) {
    return `521${telefono}`;
  }

  /*
   * 52 + 10 dígitos
   */
  if (
    telefono.length === 12 &&
    telefono.startsWith("52")
  ) {
    return `521${telefono.slice(2)}`;
  }

  /*
   * Formato que usa VIPACK:
   * 521 + 10 dígitos
   */
  if (
    telefono.length === 13 &&
    telefono.startsWith("521")
  ) {
    return telefono;
  }

  /*
   * No destruimos números antiguos,
   * extranjeros o con otro formato.
   */
  return telefono;
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

  const cuerpo =
    Uint8Array.from(
      contenido
    ).buffer;

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
      body: cuerpo,
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

async function obtenerCarpetaRaizClientes(
  accessToken: string
) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_CLIENTES
    )}?$select=id,name,folder`;

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

  const data =
    await leerJsonSeguro(response);

  if (
    !response.ok ||
    !data?.id
  ) {
    throw new Error(
      data?.error?.message ||
        `No se encontró la carpeta ${RUTA_CLIENTES}.`
    );
  }

  return String(data.id);
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

  const response = await fetch(
    url,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        name: nombreCarpeta,
        folder: {},
        "@microsoft.graph.conflictBehavior":
          "fail",
      }),
      cache: "no-store",
    }
  );

  const data =
    await leerJsonSeguro(response);

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
    id: String(data.id),
    name: String(
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
        cache: "no-store",
      }
    );
  } catch (error) {
    console.error(
      "No se pudo revertir la carpeta creada:",
      error
    );
  }
}

/*
 * Localiza TelefonoWhatsApp y fuerza
 * todas sus celdas como texto.
 *
 * Esto evita:
 * 5.21961E+12
 *
 * y mantiene:
 * 5219611978818
 */
function forzarTelefonosComoTexto(
  hoja: XLSX.WorkSheet
) {
  const referencia =
    hoja["!ref"];

  if (!referencia) {
    return;
  }

  const rango =
    XLSX.utils.decode_range(
      referencia
    );

  let columnaTelefono = -1;

  for (
    let columna = rango.s.c;
    columna <= rango.e.c;
    columna++
  ) {
    const direccion =
      XLSX.utils.encode_cell({
        r: rango.s.r,
        c: columna,
      });

    const celda =
      hoja[direccion];

    const encabezado =
      limpiarTexto(
        celda?.v
      );

    if (
      encabezado ===
      "TelefonoWhatsApp"
    ) {
      columnaTelefono =
        columna;
      break;
    }
  }

  if (
    columnaTelefono < 0
  ) {
    return;
  }

  for (
    let fila = rango.s.r + 1;
    fila <= rango.e.r;
    fila++
  ) {
    const direccion =
      XLSX.utils.encode_cell({
        r: fila,
        c: columnaTelefono,
      });

    const celda =
      hoja[direccion];

    if (!celda) {
      continue;
    }

    const telefono =
      normalizarTelefono(
        celda.v
      );

    if (!telefono) {
      continue;
    }

    /*
     * Forzamos STRING.
     */
    celda.t = "s";
    celda.v = telefono;

    /*
     * Formato Texto de Excel.
     */
    celda.z = "@";

    /*
     * Eliminamos representación
     * anterior cacheada.
     */
    delete celda.w;
  }
}

export async function POST(
  request: Request
) {
  let carpetaCreadaId = "";
  let accessTokenActivo = "";

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
     * 1. Leer solicitud pendiente.
     */
    const {
      data: solicitud,
      error: solicitudError,
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
        {
          status: 500,
        }
      );
    }

    if (!solicitud) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Solicitud no encontrada.",
        },
        {
          status: 404,
        }
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
        {
          status: 409,
        }
      );
    }

    /*
     * 2. Validar teléfono antes de
     * crear carpeta o modificar Excel.
     */
    const telefono =
      normalizarTelefono(
        solicitud.telefono
      );

    if (!telefono) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La solicitud no contiene un teléfono válido.",
        },
        {
          status: 400,
        }
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
      conexionError ||
      !conexion?.refresh_token
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No existe una conexión activa de OneDrive.",
          detalle:
            conexionError?.message ||
            null,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * 4. Renovar token.
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
      !tokenData?.access_token
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
        {
          status: 400,
        }
      );
    }

    const accessToken =
      String(
        tokenData.access_token
      );

    accessTokenActivo =
      accessToken;

    const nuevoRefreshToken =
      String(
        tokenData
          ?.refresh_token ||
        ""
      ).trim();

    if (
      nuevoRefreshToken &&
      nuevoRefreshToken !==
        conexion.refresh_token
    ) {
      const {
        error:
          refreshUpdateError,
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
        refreshUpdateError
      ) {
        console.error(
          "No se pudo guardar el refresh token renovado:",
          refreshUpdateError
        );
      }
    }

    /*
     * 5. Descargar Excel.
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
        {
          status: 400,
        }
      );
    }

    /*
     * IMPORTANTE:
     *
     * raw:true permite leer el
     * valor real de la celda.
     */
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
          raw: true,
        }
      );

    /*
     * 6. Evitar teléfono duplicado.
     */
    const existeTelefono =
      filas.some(
        (fila) => {
          const telefonoExistente =
            normalizarTelefono(
              fila[
                "TelefonoWhatsApp"
              ]
            );

          return (
            telefonoExistente ===
            telefono
          );
        }
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
        {
          status: 409,
        }
      );
    }

    /*
     * 7. Calcular siguiente ID.
     */
    let maxId = 0;

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

    if (!nombre) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La solicitud no contiene un nombre válido.",
        },
        {
          status: 400,
        }
      );
    }

    const carpetaCliente =
      `${numeroCliente(
        nuevoId
      )} ${nombre}`;

    /*
     * 8. Crear carpeta física
     * en OneDrive.
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
     * 9. Normalizar teléfonos antiguos.
     *
     * Si el Excel internamente conserva
     * el número completo, aquí queda
     * convertido a string.
     */
    for (
      const fila of filas
    ) {
      if (
        fila[
          "TelefonoWhatsApp"
        ] !==
        undefined &&
        fila[
          "TelefonoWhatsApp"
        ] !==
        null &&
        fila[
          "TelefonoWhatsApp"
        ] !==
        ""
      ) {
        fila[
          "TelefonoWhatsApp"
        ] =
          normalizarTelefono(
            fila[
              "TelefonoWhatsApp"
            ]
          );
      }
    }

    /*
     * 10. Agregar nuevo cliente.
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

    /*
     * 11. Reconstruir hoja.
     */
    const nuevaHoja =
      XLSX.utils.json_to_sheet(
        filas
      );

    /*
     * MUY IMPORTANTE:
     *
     * Fuerza toda la columna
     * TelefonoWhatsApp como TEXTO.
     */
    forzarTelefonosComoTexto(
      nuevaHoja
    );

    workbook.Sheets[
      HOJA_CLIENTES
    ] = nuevaHoja;

    /*
     * 12. Generar nuevo XLSX.
     */
    const nuevoExcel =
      XLSX.write(
        workbook,
        {
          type: "buffer",
          bookType: "xlsx",
        }
      );

    /*
     * 13. Subir Excel.
     */
    try {
      await subirExcel(
        accessToken,
        nuevoExcel
      );
    } catch (error) {
      await eliminarCarpeta(
        accessToken,
        carpeta.id
      );

      carpetaCreadaId = "";

      throw error;
    }

    /*
     * A partir de aquí el Excel
     * ya se actualizó correctamente.
     *
     * Evitamos que el catch general
     * elimine la carpeta por un error
     * posterior de Supabase.
     */
    carpetaCreadaId = "";

    /*
     * 14. Crear cliente de inventario
     * en Supabase.
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
        {
          status: 500,
        }
      );
    }

    /*
     * 15. Marcar solicitud aprobada.
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
        {
          status: 500,
        }
      );
    }

    /*
     * 16. Respuesta correcta.
     */
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
     * Solo eliminamos carpeta cuando
     * el proceso falló ANTES de que
     * el Excel quedara confirmado.
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
      {
        status: 500,
      }
    );
  }
}