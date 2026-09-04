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

type CajaBody = {
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
  cajas?: CajaBody[];
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
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

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

  if (!tokenResponse.ok) {
    throw new Error(
      tokenData
        ?.error_description ||
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
}

function texto(
  valor: unknown
) {
  return String(valor ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function numero(
  valor: unknown
) {
  const n =
    Number(valor);

  return Number.isFinite(n)
    ? n
    : 0;
}

function normalizarTelefono(
  valor: unknown
) {
  const limpio =
    String(valor ?? "")
      .replace(/\D/g, "");

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

function escribirCelda(
  hoja: XLSX.WorkSheet,
  direccion: string,
  valor: string | number
) {
  hoja[direccion] = {
    t:
      typeof valor === "number"
        ? "n"
        : "s",
    v: valor,
  };
}

function siguienteFilaLibre(
  hoja: XLSX.WorkSheet,
  columna: string
) {
  const rango =
    XLSX.utils.decode_range(
      hoja["!ref"] || "A1:A1"
    );

  for (
    let fila = 2;
    fila <=
    Math.max(
      rango.e.r + 1,
      500
    );
    fila += 1
  ) {
    const celda =
      hoja[
        `${columna}${fila}`
      ];

    if (
      !celda ||
      String(
        celda.v ?? ""
      ).trim() === ""
    ) {
      return fila;
    }
  }

  return rango.e.r + 2;
}

function asegurarRango(
  hoja: XLSX.WorkSheet,
  fila: number,
  ultimaColumna: number
) {
  const actual =
    XLSX.utils.decode_range(
      hoja["!ref"] || "A1:A1"
    );

  actual.e.r =
    Math.max(
      actual.e.r,
      fila - 1
    );

  actual.e.c =
    Math.max(
      actual.e.c,
      ultimaColumna
    );

  hoja["!ref"] =
    XLSX.utils.encode_range(
      actual
    );
}

function generarFolio(
  hoja: XLSX.WorkSheet
) {
  const ahora =
    new Date();

  const base =
    `COT-${ahora
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${String(
        ahora.getTime()
      ).slice(-6)}`;

  let folio = base;
  let contador = 1;

  const rango =
    XLSX.utils.decode_range(
      hoja["!ref"] || "A1:A1"
    );

  const existentes =
    new Set<string>();

  for (
    let r = 1;
    r <= rango.e.r;
    r += 1
  ) {
    const celda =
      hoja[
        XLSX.utils.encode_cell({
          r,
          c: 0,
        })
      ];

    if (celda?.v) {
      existentes.add(
        String(celda.v)
      );
    }
  }

  while (
    existentes.has(folio)
  ) {
    folio =
      `${base}-${contador}`;
    contador += 1;
  }

  return folio;
}

function fechaTijuana() {
  return new Intl.DateTimeFormat(
    "es-MX",
    {
      timeZone:
        "America/Tijuana",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }
  ).format(
    new Date()
  );
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as NuevaCotizacionBody;

    const cliente =
      texto(body.cliente);

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

    if (!cajas.length) {
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
          cellStyles: true,
          cellFormula: true,
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
            'control_cotizaciones.xlsx debe tener las hojas "Cotizaciones" y "Detalle_Cajas".',
        },
        {
          status: 400,
        }
      );
    }

    const folio =
      generarFolio(
        hojaCotizaciones
      );

    const filaCot =
      siguienteFilaLibre(
        hojaCotizaciones,
        "A"
      );

    escribirCelda(
      hojaCotizaciones,
      `A${filaCot}`,
      folio
    );

    escribirCelda(
      hojaCotizaciones,
      `B${filaCot}`,
      fechaTijuana()
    );

    escribirCelda(
      hojaCotizaciones,
      `C${filaCot}`,
      cliente
    );

    escribirCelda(
      hojaCotizaciones,
      `D${filaCot}`,
      telefono
    );

    // E-H se dejan con las fórmulas del archivo de control.
    escribirCelda(
      hojaCotizaciones,
      `I${filaCot}`,
      numero(
        body.totalAereo
      )
    );

    escribirCelda(
      hojaCotizaciones,
      `J${filaCot}`,
      numero(
        body.totalTerrestre
      )
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

    escribirCelda(
      hojaCotizaciones,
      `K${filaCot}`,
      opciones
    );

    escribirCelda(
      hojaCotizaciones,
      `L${filaCot}`,
      ""
    );

    escribirCelda(
      hojaCotizaciones,
      `M${filaCot}`,
      0
    );

    escribirCelda(
      hojaCotizaciones,
      `N${filaCot}`,
      "Pendiente"
    );

    escribirCelda(
      hojaCotizaciones,
      `O${filaCot}`,
      ""
    );

    escribirCelda(
      hojaCotizaciones,
      `P${filaCot}`,
      ""
    );

    escribirCelda(
      hojaCotizaciones,
      `Q${filaCot}`,
      ""
    );

    escribirCelda(
      hojaCotizaciones,
      `R${filaCot}`,
      texto(
        body.observaciones
      )
    );

    asegurarRango(
      hojaCotizaciones,
      filaCot,
      17
    );

    let filaDetalle =
      siguienteFilaLibre(
        hojaDetalle,
        "A"
      );

    for (
      let i = 0;
      i < cajas.length;
      i += 1
    ) {
      const caja =
        cajas[i];

      escribirCelda(
        hojaDetalle,
        `A${filaDetalle}`,
        folio
      );

      escribirCelda(
        hojaDetalle,
        `B${filaDetalle}`,
        numero(
          caja.numero
        ) ||
          i + 1
      );

      escribirCelda(
        hojaDetalle,
        `C${filaDetalle}`,
        numero(
          caja.largo
        )
      );

      escribirCelda(
        hojaDetalle,
        `D${filaDetalle}`,
        numero(
          caja.ancho
        )
      );

      escribirCelda(
        hojaDetalle,
        `E${filaDetalle}`,
        numero(
          caja.alto
        )
      );

      escribirCelda(
        hojaDetalle,
        `F${filaDetalle}`,
        numero(
          caja.pesoReal
        )
      );

      /*
       * G y H ya contienen fórmulas en el archivo:
       * G = volumétrico / 5000
       * H = mayor entre real y volumétrico
       * Si por alguna razón la fila no trae fórmula,
       * la agregamos aquí.
       */
      if (
        !hojaDetalle[
          `G${filaDetalle}`
        ]?.f
      ) {
        hojaDetalle[
          `G${filaDetalle}`
        ] = {
          t: "n",
          f:
            `IF(OR(C${filaDetalle}="",D${filaDetalle}="",E${filaDetalle}=""),"",C${filaDetalle}*D${filaDetalle}*E${filaDetalle}/5000)`,
        };
      }

      if (
        !hojaDetalle[
          `H${filaDetalle}`
        ]?.f
      ) {
        hojaDetalle[
          `H${filaDetalle}`
        ] = {
          t: "n",
          f:
            `IF(OR(F${filaDetalle}="",G${filaDetalle}=""),"",MAX(F${filaDetalle},G${filaDetalle}))`,
        };
      }

      escribirCelda(
        hojaDetalle,
        `I${filaDetalle}`,
        numero(
          caja.precioAereo
        )
      );

      escribirCelda(
        hojaDetalle,
        `J${filaDetalle}`,
        numero(
          caja.precioTerrestre
        )
      );

      asegurarRango(
        hojaDetalle,
        filaDetalle,
        9
      );

      filaDetalle += 1;
    }

    /*
     * Si la fila de Cotizaciones no tenía fórmulas
     * (por ejemplo, se usó una fila nueva después de la 500),
     * las agregamos usando el mismo diseño del Excel.
     */
    if (
      !hojaCotizaciones[
        `E${filaCot}`
      ]?.f
    ) {
      hojaCotizaciones[
        `E${filaCot}`
      ] = {
        t: "n",
        f:
          `COUNTIF(Detalle_Cajas!$A:$A,A${filaCot})`,
      };
    }

    if (
      !hojaCotizaciones[
        `F${filaCot}`
      ]?.f
    ) {
      hojaCotizaciones[
        `F${filaCot}`
      ] = {
        t: "n",
        f:
          `SUMIF(Detalle_Cajas!$A:$A,A${filaCot},Detalle_Cajas!$F:$F)`,
      };
    }

    if (
      !hojaCotizaciones[
        `G${filaCot}`
      ]?.f
    ) {
      hojaCotizaciones[
        `G${filaCot}`
      ] = {
        t: "n",
        f:
          `SUMIF(Detalle_Cajas!$A:$A,A${filaCot},Detalle_Cajas!$G:$G)`,
      };
    }

    if (
      !hojaCotizaciones[
        `H${filaCot}`
      ]?.f
    ) {
      hojaCotizaciones[
        `H${filaCot}`
      ] = {
        t: "n",
        f:
          `SUMIF(Detalle_Cajas!$A:$A,A${filaCot},Detalle_Cajas!$H:$H)`,
      };
    }

    const salida =
      XLSX.write(
        workbook,
        {
          type: "buffer",
          bookType: "xlsx",
          cellStyles: true,
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
        "Cotización guardada correctamente en Excel.",
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