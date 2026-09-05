import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_EXCEL =
  "Envios/control_cotizaciones.xlsx";

const HOJA_HISTORIAL =
  "Historial_Pagos";

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
      "Faltan variables para recuperar la conexión de OneDrive."
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

async function leerJsonSeguro(
  response: Response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
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
    .order("id", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar OneDrive: ${error.message}`
    );
  }

  if (
    !conexion?.refresh_token
  ) {
    throw new Error(
      "No existe una conexión activa de OneDrive."
    );
  }

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

        cache: "no-store",
      }
    );

  const tokenData =
    await leerJsonSeguro(
      tokenResponse
    );

  if (
    !tokenResponse.ok
  ) {
    throw new Error(
      tokenData?.error_description ||
        tokenData?.error ||
        "No se pudo renovar el acceso a OneDrive."
    );
  }

  const accessToken =
    tokenData?.access_token;

  if (!accessToken) {
    throw new Error(
      "Microsoft no devolvió access_token."
    );
  }

  const nuevoRefreshToken =
    tokenData?.refresh_token;

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
          new Date().toISOString(),
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

  return await response.arrayBuffer();
}

function texto(
  valor: unknown
) {
  return String(
    valor ?? ""
  ).trim();
}

function numero(
  valor: unknown
) {
  if (
    typeof valor ===
      "number" &&
    Number.isFinite(
      valor
    )
  ) {
    return valor;
  }

  const limpio =
    String(
      valor ?? ""
    )
      .replace(/\$/g, "")
      .replace(/,/g, "")
      .trim();

  const n =
    Number(limpio);

  return Number.isFinite(n)
    ? n
    : 0;
}

function redondear(
  valor: number
) {
  return (
    Math.round(
      (valor +
        Number.EPSILON) *
        100
    ) / 100
  );
}

function valorCelda(
  hoja: XLSX.WorkSheet,
  columna: string,
  fila: number
) {
  return hoja[
    `${columna}${fila}`
  ]?.v;
}

/*
Historial_Pagos

A ID Pago
B Fecha
C Folio
D Cliente
E WhatsApp
F Servicio
G Total
H Saldo Antes
I Monto Pagado
J Saldo Después
K Método
L Referencia
M Comprobante
N URL Comprobante
O Observaciones
*/

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(
        request.url
      );

    const folio =
      texto(
        url.searchParams.get(
          "folio"
        )
      );

    if (!folio) {
      return NextResponse.json(
        {
          success: false,
          historial: [],
          error:
            "El folio es obligatorio.",
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
          cellFormula: true,
          cellStyles: true,
        }
      );

    const hoja =
      workbook.Sheets[
        HOJA_HISTORIAL
      ];

    if (!hoja) {
      return NextResponse.json({
        success: true,
        historial: [],
        total: 0,
      });
    }

    const rango =
      XLSX.utils.decode_range(
        hoja["!ref"] ||
          "A1:O1"
      );

    const historial = [];

    for (
      let fila = 2;
      fila <=
      rango.e.r + 1;
      fila += 1
    ) {
      const folioFila =
        texto(
          valorCelda(
            hoja,
            "C",
            fila
          )
        );

      if (
        folioFila !==
        folio
      ) {
        continue;
      }

      historial.push({
        idPago:
          texto(
            valorCelda(
              hoja,
              "A",
              fila
            )
          ),

        fecha:
          texto(
            valorCelda(
              hoja,
              "B",
              fila
            )
          ),

        folio:
          folioFila,

        cliente:
          texto(
            valorCelda(
              hoja,
              "D",
              fila
            )
          ),

        whatsapp:
          texto(
            valorCelda(
              hoja,
              "E",
              fila
            )
          ),

        servicio:
          texto(
            valorCelda(
              hoja,
              "F",
              fila
            )
          ),

        total:
          redondear(
            numero(
              valorCelda(
                hoja,
                "G",
                fila
              )
            )
          ),

        saldoAntes:
          redondear(
            numero(
              valorCelda(
                hoja,
                "H",
                fila
              )
            )
          ),

        monto:
          redondear(
            numero(
              valorCelda(
                hoja,
                "I",
                fila
              )
            )
          ),

        saldoDespues:
          redondear(
            numero(
              valorCelda(
                hoja,
                "J",
                fila
              )
            )
          ),

        metodo:
          texto(
            valorCelda(
              hoja,
              "K",
              fila
            )
          ),

        referencia:
          texto(
            valorCelda(
              hoja,
              "L",
              fila
            )
          ),

        comprobante:
          texto(
            valorCelda(
              hoja,
              "M",
              fila
            )
          ),

        urlComprobante:
          texto(
            valorCelda(
              hoja,
              "N",
              fila
            )
          ),

        observaciones:
          texto(
            valorCelda(
              hoja,
              "O",
              fila
            )
          ),
      });
    }

    /*
     * Más reciente primero.
     */

    historial.reverse();

    return NextResponse.json({
      success: true,
      historial,
      total:
        historial.length,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error cargando historial de pagos:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        historial: [],

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido cargando historial.",
      },
      {
        status: 500,
      }
    );
  }
}