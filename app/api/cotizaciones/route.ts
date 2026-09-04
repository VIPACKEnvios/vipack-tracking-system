import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_EXCEL =
  "Envios/control_cotizaciones.xlsx";

const HOJA_COTIZACIONES =
  "Cotizaciones";

const HOJA_DETALLE =
  "Detalle_Cajas";

type ConexionOneDrive = {
  id: number;
  refresh_token: string;
};

type CajaCotizacionBody = {
  numero?: number;
  largo?: number;
  ancho?: number;
  alto?: number;
  pesoReal?: number;
  pesoVolumetrico?: number;
  pesoCobrable?: number;
  precioAereo?: number | null;
  precioTerrestre?: number | null;
};

type NuevaCotizacionBody = {
  cliente?: string;
  telefono?: string;
  cajas?: CajaCotizacionBody[];
  totalAereo?: number;
  totalTerrestre?: number;
  enviarAereo?: boolean;
  enviarTerrestre?: boolean;
  observaciones?: string;
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

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Faltan variables de configuración de Supabase."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
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
        body: new URLSearchParams({
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

  return {
    response,
    data:
      await leerJsonSeguro(
        response
      ),
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
      data?.error_description ||
        data?.error ||
        "No se pudo renovar el acceso a OneDrive."
    );
  }

  const accessToken =
    data?.access_token;

  const nuevoRefreshToken =
    data?.refresh_token;

  if (!accessToken) {
    throw new Error(
      "Microsoft no devolvió access_token."
    );
  }

  if (
    nuevoRefreshToken &&
    nuevoRefreshToken !==
      conexion.refresh_token
  ) {
    const {
      error: updateError,
    } = await supabase
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

    if (updateError) {
      console.error(
        "No se pudo actualizar refresh_token:",
        updateError
      );
    }
  }

  return accessToken;
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
        cache: "no-store",
      }
    );

  if (!response.ok) {
    const detalle =
      await response.text();

    throw new Error(
      `No se pudo descargar control_cotizaciones.xlsx. ${detalle}`
    );
  }

  return await response
    .arrayBuffer();
}

async function subirExcel(
  accessToken: string,
  buffer: Buffer
) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_EXCEL
    )}:/content`;

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
        body:
          new Uint8Array(
            buffer
          ),
        cache: "no-store",
      }
    );

  if (!response.ok) {
    const detalle =
      await response.text();

    throw new Error(
      `No se pudo guardar control_cotizaciones.xlsx. ${detalle}`
    );
  }

  return await leerJsonSeguro(
    response
  );
}

function limpiarTexto(
  valor: unknown
) {
  return String(valor ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizarTelefono(
  valor: unknown
) {
  const limpio =
    String(valor ?? "")
      .replace(/\D/g, "");

  if (!limpio) {
    return "";
  }

  if (
    limpio.startsWith("521") &&
    limpio.length === 13
  ) {
    return limpio;
  }

  if (
    limpio.startsWith("52") &&
    limpio.length === 12
  ) {
    return `521${limpio.slice(2)}`;
  }

  if (limpio.length === 10) {
    return `521${limpio}`;
  }

  return limpio;
}

function numeroSeguro(
  valor: unknown
) {
  const numero =
    Number(valor);

  return Number.isFinite(
    numero
  )
    ? numero
    : 0;
}

function generarFolio(
  existentes: Set<string>
) {
  const ahora =
    new Date();

  const yyyy =
    ahora.getFullYear();

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
    `COT-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;

  if (!existentes.has(base)) {
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

function fechaActual() {
  return new Date()
    .toLocaleString(
      "es-MX",
      {
        timeZone:
          "America/Tijuana",
        hour12: true,
      }
    );
}

export async function GET() {
  try {
    const accessToken =
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
        HOJA_COTIZACIONES
      ];

    if (!hoja) {
      return NextResponse.json(
        {
          success: false,
          error:
            `El Excel no contiene la hoja "${HOJA_COTIZACIONES}".`,
        },
        {
          status: 400,
        }
      );
    }

    const registros =
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

    return NextResponse.json({
      success: true,
      archivo:
        RUTA_EXCEL,
      registros,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error leyendo cotizaciones:",
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
      (await request.json()) as NuevaCotizacionBody;

    const cliente =
      limpiarTexto(
        body.cliente
      );

    const telefono =
      normalizarTelefono(
        body.telefono
      );

    const cajas =
      Array.isArray(
        body.cajas
      )
        ? body.cajas
        : [];

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

    if (!telefono) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El teléfono es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      cajas.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Debes agregar al menos una caja.",
        },
        {
          status: 400,
        }
      );
    }

    const accessToken =
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

    const hojaCotizaciones =
      workbook.Sheets[
        HOJA_COTIZACIONES
      ];

    const hojaDetalle =
      workbook.Sheets[
        HOJA_DETALLE
      ];

    if (
      !hojaCotizaciones ||
      !hojaDetalle
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `El Excel debe contener las hojas "${HOJA_COTIZACIONES}" y "${HOJA_DETALLE}".`,
        },
        {
          status: 400,
        }
      );
    }

    const cotizaciones =
      XLSX.utils
        .sheet_to_json<
          Record<
            string,
            unknown
          >
        >(
          hojaCotizaciones,
          {
            defval: "",
            raw: false,
          }
        );

    const detalle =
      XLSX.utils
        .sheet_to_json<
          Record<
            string,
            unknown
          >
        >(
          hojaDetalle,
          {
            defval: "",
            raw: false,
          }
        );

    const folios =
      new Set(
        cotizaciones.map(
          (fila) =>
            String(
              fila.Folio ||
                fila.folio ||
                ""
            ).trim()
        )
      );

    const folio =
      generarFolio(
        folios
      );

    const totalAereo =
      numeroSeguro(
        body.totalAereo
      );

    const totalTerrestre =
      numeroSeguro(
        body.totalTerrestre
      );

    const pesoRealTotal =
      cajas.reduce(
        (total, caja) =>
          total +
          numeroSeguro(
            caja.pesoReal
          ),
        0
      );

    const pesoVolumetricoTotal =
      cajas.reduce(
        (total, caja) =>
          total +
          numeroSeguro(
            caja.pesoVolumetrico
          ),
        0
      );

    const pesoCobrableTotal =
      cajas.reduce(
        (total, caja) =>
          total +
          numeroSeguro(
            caja.pesoCobrable
          ),
        0
      );

    const opciones =
      [
        body.enviarAereo
          ? "Aéreo"
          : "",
        body.enviarTerrestre
          ? "Terrestre"
          : "",
      ]
        .filter(Boolean)
        .join(" / ");

    const nuevaCotizacion = {
      Folio:
        folio,
      Fecha:
        fechaActual(),
      Cliente:
        cliente,
      Telefono:
        telefono,
      "No. de cajas":
        cajas.length,
      "Peso real total":
        pesoRealTotal,
      "Peso volumétrico total":
        pesoVolumetricoTotal,
      "Peso cobrable total":
        pesoCobrableTotal,
      "Cotización Aérea":
        totalAereo,
      "Cotización Terrestre":
        totalTerrestre,
      "Opciones enviadas":
        opciones,
      "Servicio elegido":
        "",
      "Precio final":
        "",
      "Estado de pago":
        "Pendiente",
      "Fecha de pago":
        "",
      "Método de pago":
        "",
      Observaciones:
        limpiarTexto(
          body.observaciones
        ),
    };

    const nuevasCotizaciones =
      [
        ...cotizaciones,
        nuevaCotizacion,
      ];

    const nuevasCajas =
      cajas.map(
        (caja, indice) => ({
          Folio:
            folio,
          Caja:
            numeroSeguro(
              caja.numero
            ) ||
            indice + 1,
          Largo:
            numeroSeguro(
              caja.largo
            ),
          Ancho:
            numeroSeguro(
              caja.ancho
            ),
          Alto:
            numeroSeguro(
              caja.alto
            ),
          "Peso real":
            numeroSeguro(
              caja.pesoReal
            ),
          "Peso volumétrico":
            numeroSeguro(
              caja.pesoVolumetrico
            ),
          "Peso cobrable":
            numeroSeguro(
              caja.pesoCobrable
            ),
          "Precio Aéreo":
            numeroSeguro(
              caja.precioAereo
            ),
          "Precio Terrestre":
            numeroSeguro(
              caja.precioTerrestre
            ),
        })
      );

    const nuevoDetalle =
      [
        ...detalle,
        ...nuevasCajas,
      ];

    workbook.Sheets[
      HOJA_COTIZACIONES
    ] =
      XLSX.utils
        .json_to_sheet(
          nuevasCotizaciones
        );

    workbook.Sheets[
      HOJA_DETALLE
    ] =
      XLSX.utils
        .json_to_sheet(
          nuevoDetalle
        );

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
      folio,
      mensaje:
        "Cotización guardada correctamente.",
      registro:
        nuevaCotizacion,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error guardando cotización:",
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