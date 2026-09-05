import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_EXCEL = "Envios/control_cotizaciones.xlsx";
const HOJA_COTIZACIONES = "Cotizaciones";

function crearSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
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

  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan variables de configuración de OneDrive."
    );
  }

  const supabase = crearSupabase();

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

  if (error) {
    throw new Error(
      `No se pudo consultar OneDrive: ${error.message}`
    );
  }

  if (!conexion?.refresh_token) {
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
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
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

  if (!tokenResponse.ok) {
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
    await supabase
      .from("onedrive_connections")
      .update({
        refresh_token:
          nuevoRefreshToken,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", conexion.id);
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
    await fetch(url, {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

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
  return String(valor ?? "")
    .trim();
}

function numero(
  valor: unknown
) {
  if (
    typeof valor === "number" &&
    Number.isFinite(valor)
  ) {
    return valor;
  }

  const limpio =
    String(valor ?? "")
      .replace(/\$/g, "")
      .replace(/,/g, "")
      .trim();

  const n = Number(limpio);

  return Number.isFinite(n)
    ? n
    : 0;
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
          cellFormula: true,
          cellStyles: true,
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
          pagos: [],
          error:
            'No existe la hoja "Cotizaciones".',
        },
        {
          status: 400,
        }
      );
    }

    const rango =
      XLSX.utils.decode_range(
        hoja["!ref"] || "A1:R1"
      );

    const pagos = [];

    for (
      let fila = 2;
      fila <= rango.e.r + 1;
      fila += 1
    ) {
      const folio =
        texto(
          valorCelda(
            hoja,
            "A",
            fila
          )
        );

      if (!folio) {
        continue;
      }

      const fecha =
        texto(
          valorCelda(
            hoja,
            "B",
            fila
          )
        );

      const cliente =
        texto(
          valorCelda(
            hoja,
            "C",
            fila
          )
        );

      const whatsapp =
        texto(
          valorCelda(
            hoja,
            "D",
            fila
          )
        );

      const totalAereo =
        numero(
          valorCelda(
            hoja,
            "I",
            fila
          )
        );

      const totalTerrestre =
        numero(
          valorCelda(
            hoja,
            "J",
            fila
          )
        );

      const opciones =
        texto(
          valorCelda(
            hoja,
            "K",
            fila
          )
        );

      /*
       * L = monto definitivo a cobrar.
       * Si todavía está vacío:
       * - sólo Aéreo -> usamos total aéreo
       * - sólo Terrestre -> usamos total terrestre
       *
       * Cuando cotizamos ambas opciones,
       * todavía no asumimos cuál eligió
       * el cliente.
       */
      const montoDefinitivo =
        numero(
          valorCelda(
            hoja,
            "L",
            fila
          )
        );

      let total =
        montoDefinitivo;

      const tieneAereo =
        opciones
          .toLowerCase()
          .includes("aéreo") ||
        opciones
          .toLowerCase()
          .includes("aereo");

      const tieneTerrestre =
        opciones
          .toLowerCase()
          .includes("terrestre");

      if (
        total <= 0 &&
        tieneAereo &&
        !tieneTerrestre
      ) {
        total =
          totalAereo;
      }

      if (
        total <= 0 &&
        tieneTerrestre &&
        !tieneAereo
      ) {
        total =
          totalTerrestre;
      }

      /*
       * M ya se inicializa en 0
       * cuando se crea la cotización.
       */
      const pagado =
        numero(
          valorCelda(
            hoja,
            "M",
            fila
          )
        );

      const saldo =
        Math.max(
          total - pagado,
          0
        );

      let estado:
        | "Pendiente"
        | "Parcial"
        | "Pagado" =
        "Pendiente";

      if (
        total > 0 &&
        saldo <= 0
      ) {
        estado =
          "Pagado";
      } else if (
        pagado > 0
      ) {
        estado =
          "Parcial";
      }

      pagos.push({
        folio,
        cliente,
        whatsapp,
        fecha,

        total,
        pagado,
        saldo,
        estado,

        totalAereo,
        totalTerrestre,
        opciones,

        requiereSeleccionServicio:
          total <= 0 &&
          tieneAereo &&
          tieneTerrestre,
      });
    }

    pagos.reverse();

    return NextResponse.json({
      success: true,
      pagos,
      total: pagos.length,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error cargando pagos:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        pagos: [],
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido cargando pagos.",
      },
      {
        status: 500,
      }
    );
  }
}