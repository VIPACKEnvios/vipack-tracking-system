import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_EXCEL =
  "Envios/control_recolecciones_bodega.xlsx";

const HOJA_SOLICITUDES =
  "Solicitudes";

type ConexionOneDrive = {
  id: number;
  drive_id: string | null;
  refresh_token: string;
};

type NuevaRecoleccionBody = {
  cliente?: string;
  telefono?: string;
  bodega?: string;
  direccion?: string;
  mercancia?: string;
  cantidad?: string;
  fechaRecoleccion?: string;
  observaciones?: string;
};

type ActualizarRecoleccionBody = {
  folio?: string;
  ordenRuta?: string | null;
  estado?: string | null;
};

const ESTADOS_VALIDOS = new Set([
  "Pendiente",
  "En ruta",
  "Recolectada",
  "No lista",
  "Reprogramada",
  "Cancelada",
]);

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

        cache: "no-store",
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
    error: connectionError,
  } = await supabase
    .from("onedrive_connections")
    .select(
      "id, drive_id, refresh_token"
    )
    .order(
      "id",
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();

  if (connectionError) {
    throw new Error(
      `No se pudo consultar la conexión de OneDrive: ${connectionError.message}`
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
    throw new Error(
      tokenData
        ?.error_description ||
        tokenData?.error ||
        "No se pudo renovar el acceso a OneDrive."
    );
  }

  const accessToken =
    tokenData
      ?.access_token;

  const newRefreshToken =
    tokenData
      ?.refresh_token;

  if (!accessToken) {
    throw new Error(
      "Microsoft no devolvió access_token."
    );
  }

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
        "No se pudo actualizar refresh_token:",
        updateTokenError
      );
    }
  }

  return {
    accessToken,
    conexion:
      conexion as ConexionOneDrive,
  };
}

async function descargarExcel(
  accessToken: string
) {
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
    const detalle =
      await excelResponse.text();

    throw new Error(
      `No se pudo descargar el Excel de recolecciones. ${detalle}`
    );
  }

  return await excelResponse
    .arrayBuffer();
}

async function subirExcel(
  accessToken: string,
  buffer: Buffer
) {
  const excelUrl =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_EXCEL
    )}:/content`;

  const response =
    await fetch(
      excelUrl,
      {
        method: "PUT",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },

        body: new Uint8Array(
          buffer
        ),

        cache:
          "no-store",
      }
    );

  if (!response.ok) {
    const detalle =
      await response.text();

    throw new Error(
      `No se pudo guardar el Excel en OneDrive. ${detalle}`
    );
  }

  return await leerJsonSeguro(
    response
  );
}

function generarFolio(
  existentes: Set<string>
) {
  const ahora =
    new Date();

  const yy =
    String(
      ahora.getFullYear()
    ).slice(-2);

  const mm =
    String(
      ahora.getMonth() + 1
    ).padStart(2, "0");

  const dd =
    String(
      ahora.getDate()
    ).padStart(2, "0");

  const hh =
    String(
      ahora.getHours()
    ).padStart(2, "0");

  const mi =
    String(
      ahora.getMinutes()
    ).padStart(2, "0");

  const ss =
    String(
      ahora.getSeconds()
    ).padStart(2, "0");

  const base =
    `REC-${yy}${mm}${dd}-${hh}${mi}${ss}`;

  if (
    !existentes.has(base)
  ) {
    return base;
  }

  let contador = 1;

  while (
    existentes.has(
      `${base}-${contador}`
    )
  ) {
    contador += 1;
  }

  return `${base}-${contador}`;
}

function fechaSolicitudActual() {
  const ahora =
    new Date();

  const mes =
    ahora.getMonth() + 1;

  const dia =
    ahora.getDate();

  const anio =
    String(
      ahora.getFullYear()
    ).slice(-2);

  const horas =
    ahora.getHours();

  const minutos =
    String(
      ahora.getMinutes()
    ).padStart(2, "0");

  return `${mes}/${dia}/${anio} ${horas}:${minutos}`;
}


function normalizarEstadoPermitido(
  valor: unknown
) {
  const original =
    String(
      valor ?? ""
    ).trim();

  if (!original) {
    return "";
  }

  const lower =
    original.toLocaleLowerCase(
      "es"
    );

  const mapa:
    Record<
      string,
      string
    > = {
      pendiente:
        "Pendiente",
      "en ruta":
        "En ruta",
      recolectada:
        "Recolectada",
      "no lista":
        "No lista",
      reprogramada:
        "Reprogramada",
      cancelada:
        "Cancelada",
    };

  return (
    mapa[lower] ||
    original
  );
}

export async function GET() {
  try {
    const {
      accessToken,
    } =
      await obtenerAccessToken();

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
          type: "buffer",
        }
      );

    const hoja =
      workbook.Sheets[
        HOJA_SOLICITUDES
      ];

    if (!hoja) {
      return NextResponse.json(
        {
          success: false,

          error:
            `El Excel no contiene la hoja "${HOJA_SOLICITUDES}".`,
        },
        {
          status: 400,
        }
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
            defval: "",
            raw: false,
          }
        );

    const registros =
      filas.filter(
        (fila) => {
          return Object
            .values(
              fila
            )
            .some(
              (valor) =>
                String(
                  valor ?? ""
                )
                  .trim() !==
                ""
            );
        }
      );

    const contarEstado =
      (
        estado:
          string
      ) =>
        registros.filter(
          (fila) =>
            String(
              fila[
                "Estatus"
              ] || ""
            )
              .trim()
              .toLowerCase() ===
            estado
              .trim()
              .toLowerCase()
        ).length;

    const resumen = {
      total:
        registros.length,

      pendientes:
        contarEstado(
          "Pendiente"
        ),

      en_ruta:
        contarEstado(
          "En ruta"
        ),

      recolectadas:
        contarEstado(
          "Recolectada"
        ),

      no_lista:
        contarEstado(
          "No lista"
        ),

      reprogramadas:
        contarEstado(
          "Reprogramada"
        ),

      canceladas:
        contarEstado(
          "Cancelada"
        ),
    };

    return NextResponse.json({
      success: true,

      archivo:
        RUTA_EXCEL,

      hoja:
        HOJA_SOLICITUDES,

      resumen,

      registros,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error leyendo Excel de recolecciones:",
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
  request: Request
) {
  try {
    const body =
      (await request.json()) as NuevaRecoleccionBody;

    const cliente =
      String(
        body.cliente || ""
      ).trim();

    const bodega =
      String(
        body.bodega || ""
      ).trim();

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,

          error:
            "El cliente es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    if (!bodega) {
      return NextResponse.json(
        {
          success: false,

          error:
            "La bodega es obligatoria.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      accessToken,
    } =
      await obtenerAccessToken();

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
          type: "buffer",
        }
      );

    const hoja =
      workbook.Sheets[
        HOJA_SOLICITUDES
      ];

    if (!hoja) {
      return NextResponse.json(
        {
          success: false,

          error:
            `El Excel no contiene la hoja "${HOJA_SOLICITUDES}".`,
        },
        {
          status: 400,
        }
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
            defval: "",
            raw: false,
          }
        );

    const foliosExistentes =
      new Set(
        filas.map(
          (fila) =>
            String(
              fila.Folio || ""
            ).trim()
        )
      );

    const folio =
      generarFolio(
        foliosExistentes
      );

    const nuevaFila = {
      Folio:
        folio,

      "Fecha de solicitud":
        fechaSolicitudActual(),

      Cliente:
        cliente,

      TelefonoWhatsApp:
        String(
          body.telefono || ""
        ).trim(),

      "Lugar / Bodega de recolección":
        bodega,

      "Orden ruta":
        "",

      "Dirección de recolección":
        String(
          body.direccion || ""
        ).trim(),

      "Nota de recolección":
        "",

      Mercancía:
        String(
          body.mercancia || ""
        ).trim(),

      "Cantidad / Bultos":
        String(
          body.cantidad || ""
        ).trim(),

      "Fecha de recolección":
        String(
          body.fechaRecoleccion || ""
        ).trim(),

      Estatus:
        "Pendiente",

      Observaciones:
        String(
          body.observaciones || ""
        ).trim(),

      "Foto mercancía":
        "",
    };

    const nuevasFilas = [
      ...filas,
      nuevaFila,
    ];

    const nuevaHoja =
      XLSX.utils.json_to_sheet(
        nuevasFilas,
        {
          header: [
            "Folio",
            "Fecha de solicitud",
            "Cliente",
            "TelefonoWhatsApp",
            "Lugar / Bodega de recolección",
            "Orden ruta",
            "Dirección de recolección",
            "Nota de recolección",
            "Mercancía",
            "Cantidad / Bultos",
            "Fecha de recolección",
            "Estatus",
            "Observaciones",
            "Foto mercancía",
          ],

          skipHeader: false,
        }
      );

    workbook.Sheets[
      HOJA_SOLICITUDES
    ] = nuevaHoja;

    const salida =
      XLSX.write(
        workbook,
        {
          type: "buffer",
          bookType: "xlsx",
        }
      );

    await subirExcel(
      accessToken,
      salida
    );

    return NextResponse.json({
      success: true,

      mensaje:
        "Recolección creada correctamente.",

      folio,

      registro:
        nuevaFila,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error creando recolección:",
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

export async function PATCH(
  request: Request
) {
  try {
    const body =
      (await request.json()) as ActualizarRecoleccionBody;

    const folio =
      String(
        body.folio || ""
      ).trim();

    if (!folio) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El folio es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    const tieneOrdenRuta =
      Object.prototype.hasOwnProperty.call(
        body,
        "ordenRuta"
      );

    const tieneEstado =
      Object.prototype.hasOwnProperty.call(
        body,
        "estado"
      );

    if (
      !tieneOrdenRuta &&
      !tieneEstado
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Debes enviar ordenRuta, estado o ambos.",
        },
        {
          status: 400,
        }
      );
    }

    const ordenRuta =
      tieneOrdenRuta
        ? String(
            body.ordenRuta ?? ""
          ).trim()
        : null;

    const estado =
      tieneEstado
        ? normalizarEstadoPermitido(
            body.estado
          )
        : null;

    if (
      tieneEstado &&
      (
        !estado ||
        !ESTADOS_VALIDOS.has(
          estado
        )
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Estado inválido. Usa: Pendiente, En ruta, Recolectada, No lista, Reprogramada o Cancelada.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      tieneOrdenRuta &&
      ordenRuta &&
      !/^[A-Za-z0-9._-]{1,20}$/.test(
        ordenRuta
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La ruta contiene caracteres no permitidos.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      accessToken,
    } =
      await obtenerAccessToken();

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
          type: "buffer",
        }
      );

    const hoja =
      workbook.Sheets[
        HOJA_SOLICITUDES
      ];

    if (!hoja) {
      return NextResponse.json(
        {
          success: false,
          error:
            `El Excel no contiene la hoja "${HOJA_SOLICITUDES}".`,
        },
        {
          status: 400,
        }
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
            defval: "",
            raw: false,
          }
        );

    const indice =
      filas.findIndex(
        (fila) =>
          String(
            fila.Folio || ""
          ).trim() ===
          folio
      );

    if (
      indice === -1
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `No se encontró la recolección ${folio}.`,
        },
        {
          status: 404,
        }
      );
    }

    const actualizada = {
      ...filas[indice],
    };

    if (
      tieneOrdenRuta
    ) {
      actualizada[
        "Orden ruta"
      ] =
        ordenRuta || "";
    }

    if (
      tieneEstado
    ) {
      actualizada.Estatus =
        estado;
    }

    filas[indice] =
      actualizada;

    const nuevaHoja =
      XLSX.utils.json_to_sheet(
        filas,
        {
          header: [
            "Folio",
            "Fecha de solicitud",
            "Cliente",
            "TelefonoWhatsApp",
            "Lugar / Bodega de recolección",
            "Orden ruta",
            "Dirección de recolección",
            "Nota de recolección",
            "Mercancía",
            "Cantidad / Bultos",
            "Fecha de recolección",
            "Estatus",
            "Observaciones",
            "Foto mercancía",
          ],

          skipHeader:
            false,
        }
      );

    /*
     * Conservar el rango/orden de la hoja
     * y sustituir únicamente Solicitudes.
     */
    workbook.Sheets[
      HOJA_SOLICITUDES
    ] = nuevaHoja;

    const salida =
      XLSX.write(
        workbook,
        {
          type: "buffer",
          bookType:
            "xlsx",
        }
      );

    await subirExcel(
      accessToken,
      salida
    );

    return NextResponse.json({
      success: true,

      mensaje:
        "Recolección actualizada correctamente.",

      folio,

      registro:
        actualizada,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error actualizando recolección:",
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
