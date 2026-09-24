import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RUTA_EXCEL = "Envios/Paquetes_USA.xlsx";
const HOJA_PAQUETES = "Paquetes_USA";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey
);

type PaqueteUSA = {
  id: string;
  cliente: string;
  tokenCliente: string;
  rastreo: string;
  tienda: string;
  fechaRegistro: string;
  estatus: string;
  fechaRecibido: string;
  fechaCompra: string;
};

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function fechaTijuana(): string {
  const partes = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Tijuana",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const year =
    partes.find(
      (parte) => parte.type === "year"
    )?.value || "";

  const month =
    partes.find(
      (parte) => parte.type === "month"
    )?.value || "";

  const day =
    partes.find(
      (parte) => parte.type === "day"
    )?.value || "";

  return `${year}-${month}-${day}`;
}

/* =========================================================
   OBTENER ACCESS TOKEN DE ONEDRIVE
========================================================= */

async function obtenerAccessToken(): Promise<string> {
  const { data, error } = await supabase
    .from("onedrive_connections")
    .select("*")
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(
      `No se encontró la conexión de OneDrive: ${
        error?.message || "sin datos"
      }`
    );
  }

  const refreshToken =
    data.refresh_token ||
    data.refreshToken ||
    data.microsoft_refresh_token;

  if (!refreshToken) {
    throw new Error(
      "La conexión de OneDrive no tiene refresh_token."
    );
  }

  const clientId =
    process.env.MICROSOFT_CLIENT_ID;

  const clientSecret =
    process.env.MICROSOFT_CLIENT_SECRET;

  const tenantId =
    process.env.MICROSOFT_TENANT_ID ||
    "common";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan MICROSOFT_CLIENT_ID o MICROSOFT_CLIENT_SECRET."
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope:
      "offline_access Files.ReadWrite User.Read",
  });

  const respuesta = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    }
  );

  const resultado =
    await respuesta.json();

  if (
    !respuesta.ok ||
    !resultado.access_token
  ) {
    throw new Error(
      resultado.error_description ||
        resultado.error ||
        "No se pudo renovar el token de OneDrive."
    );
  }

  return resultado.access_token;
}

/* =========================================================
   DESCARGAR EXCEL
========================================================= */

async function descargarExcel(
  accessToken: string
): Promise<ArrayBuffer> {
  const ruta = RUTA_EXCEL
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const respuesta = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${ruta}:/content`,
    {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!respuesta.ok) {
    const detalle =
      await respuesta.text();

    throw new Error(
      `No se pudo descargar ${RUTA_EXCEL}. ${respuesta.status}: ${detalle}`
    );
  }

  return respuesta.arrayBuffer();
}

/* =========================================================
   SUBIR EXCEL
   IMPORTANTE:
   Convertimos Uint8Array a ArrayBuffer para evitar
   el error de TypeScript "No overload matches this call".
========================================================= */

async function subirExcel(
  accessToken: string,
  contenido: Uint8Array
): Promise<void> {
  const ruta = RUTA_EXCEL
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const arrayBuffer = new ArrayBuffer(
    contenido.byteLength
  );

  new Uint8Array(arrayBuffer).set(
    contenido
  );

  const respuesta = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${ruta}:/content`,
    {
      method: "PUT",

      headers: {
        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },

      body: arrayBuffer,
    }
  );

  if (!respuesta.ok) {
    const detalle =
      await respuesta.text();

    throw new Error(
      `No se pudo guardar ${RUTA_EXCEL}. ${respuesta.status}: ${detalle}`
    );
  }
}

/* =========================================================
   LEER PAQUETES DEL EXCEL
========================================================= */

function leerPaquetes(
  hoja: XLSX.WorkSheet
): PaqueteUSA[] {
  const filas =
    XLSX.utils.sheet_to_json<unknown[]>(
      hoja,
      {
        header: 1,
        defval: "",
        raw: false,
      }
    );

  if (filas.length <= 1) {
    return [];
  }

  return filas
    .slice(1)
    .map((fila) => {
      const columnas =
        Array.isArray(fila)
          ? fila
          : [];

      return {
        id: texto(columnas[0]),

        cliente:
          texto(columnas[1]),

        tokenCliente:
          texto(columnas[2]),

        rastreo:
          texto(columnas[3]),

        tienda:
          texto(columnas[4]),

        fechaRegistro:
          texto(columnas[5]),

        estatus:
          texto(columnas[6]),

        fechaRecibido:
          texto(columnas[7]),

        fechaCompra:
          texto(columnas[8]),
      };
    })
    .filter(
      (paquete) =>
        paquete.id ||
        paquete.rastreo
    );
}

/* =========================================================
   GET
   OBTENER TODOS LOS PAQUETES
========================================================= */

export async function GET() {
  try {
    const accessToken =
      await obtenerAccessToken();

    const archivo =
      await descargarExcel(
        accessToken
      );

    const workbook =
      XLSX.read(
        archivo,
        {
          type: "array",
          cellDates: false,
        }
      );

    const hoja =
      workbook.Sheets[
        HOJA_PAQUETES
      ];

    if (!hoja) {
      return NextResponse.json(
        {
          success: false,

          error:
            `No existe la hoja "${HOJA_PAQUETES}" dentro de Paquetes_USA.xlsx.`,
        },
        {
          status: 500,
        }
      );
    }

    const paquetes =
      leerPaquetes(hoja);

    const registrados =
      paquetes.filter(
        (paquete) =>
          paquete.estatus
            .toLowerCase() !==
          "recibido"
      ).length;

    const recibidos =
      paquetes.filter(
        (paquete) =>
          paquete.estatus
            .toLowerCase() ===
          "recibido"
      ).length;

    return NextResponse.json({
      success: true,

      paquetes,

      resumen: {
        total:
          paquetes.length,

        registrados,

        recibidos,
      },
    });
  } catch (error) {
    console.error(
      "GET admin paquetes USA:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los paquetes.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   PATCH
   MARCAR PAQUETE COMO RECIBIDO
========================================================= */

export async function PATCH(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const id =
      texto(body?.id);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Falta el ID del paquete.",
        },
        {
          status: 400,
        }
      );
    }

    const accessToken =
      await obtenerAccessToken();

    const archivo =
      await descargarExcel(
        accessToken
      );

    const workbook =
      XLSX.read(
        archivo,
        {
          type: "array",
          cellDates: false,
        }
      );

    const hoja =
      workbook.Sheets[
        HOJA_PAQUETES
      ];

    if (!hoja) {
      return NextResponse.json(
        {
          success: false,

          error:
            `No existe la hoja "${HOJA_PAQUETES}".`,
        },
        {
          status: 500,
        }
      );
    }

    const rango =
      XLSX.utils.decode_range(
        hoja["!ref"] ||
          "A1:I1"
      );

    let filaEncontrada = -1;

    /*
     * La fila 0 contiene los encabezados.
     * Por eso comenzamos en la fila 1.
     */
    for (
      let fila = 1;
      fila <= rango.e.r;
      fila++
    ) {
      const direccionId =
        XLSX.utils.encode_cell({
          r: fila,
          c: 0,
        });

      const celdaId =
        hoja[direccionId];

      if (
        texto(celdaId?.v) === id
      ) {
        filaEncontrada = fila;
        break;
      }
    }

    if (filaEncontrada === -1) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No se encontró el paquete.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Columna G = Estatus
     */
    const celdaEstatus =
      XLSX.utils.encode_cell({
        r: filaEncontrada,
        c: 6,
      });

    /*
     * Columna H = FechaRecibido
     */
    const celdaFechaRecibido =
      XLSX.utils.encode_cell({
        r: filaEncontrada,
        c: 7,
      });

    const fechaRecibido =
      fechaTijuana();

    hoja[celdaEstatus] = {
      t: "s",
      v: "Recibido",
    };

    hoja[celdaFechaRecibido] = {
      t: "s",
      v: fechaRecibido,
    };

    /*
     * Convertimos nuevamente todo el libro
     * a XLSX.
     */
    const contenido =
      XLSX.write(
        workbook,
        {
          type: "array",
          bookType: "xlsx",
        }
      );

    const bytes =
      new Uint8Array(
        contenido
      );

    await subirExcel(
      accessToken,
      bytes
    );

    return NextResponse.json({
      success: true,

      message:
        "Paquete marcado como recibido.",

      paquete: {
        id,
        estatus:
          "Recibido",
        fechaRecibido,
      },
    });
  } catch (error) {
    console.error(
      "PATCH admin paquetes USA:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el paquete.",
      },
      {
        status: 500,
      }
    );
  }
}