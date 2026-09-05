import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_EXCEL = "Envios/control_cotizaciones.xlsx";
const CARPETA_COMPROBANTES =
  "Envios/Comprobantes_Pagos";

const HOJA_COTIZACIONES = "Cotizaciones";
const HOJA_HISTORIAL = "Historial_Pagos";

/* =========================================================
   CONEXIÓN ONEDRIVE
========================================================= */

function crearSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
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

  if (!clientId || !clientSecret) {
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
      .from("onedrive_connections")
      .update({
        refresh_token:
          nuevoRefreshToken,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", conexion.id);

    if (updateError) {
      console.error(
        "No se pudo actualizar refresh_token:",
        updateError
      );
    }
  }

  return accessToken;
}

/* =========================================================
   ONEDRIVE EXCEL
========================================================= */

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

async function subirExcel(
  accessToken: string,
  buffer: Buffer
) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_EXCEL
    )}:/content`;

  const response =
    await fetch(url, {
      method: "PUT",

      headers: {
        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },

      body:
        new Uint8Array(buffer),

      cache: "no-store",
    });

  if (!response.ok) {
    const detalle =
      await response.text();

    throw new Error(
      `No se pudo actualizar control_cotizaciones.xlsx. ${detalle}`
    );
  }
}

/* =========================================================
   COMPROBANTES
========================================================= */

async function asegurarCarpetaComprobantes(
  accessToken: string
) {
  const consultar =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      CARPETA_COMPROBANTES
    )}`;

  const existe =
    await fetch(
      consultar,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache: "no-store",
      }
    );

  if (existe.ok) {
    return;
  }

  if (
    existe.status !== 404
  ) {
    const detalle =
      await existe.text();

    throw new Error(
      `No se pudo consultar la carpeta de comprobantes. ${detalle}`
    );
  }

  const crear =
    await fetch(
      "https://graph.microsoft.com/v1.0/me/drive/root:/Envios:/children",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          name:
            "Comprobantes_Pagos",

          folder: {},

          "@microsoft.graph.conflictBehavior":
            "fail",
        }),

        cache: "no-store",
      }
    );

  if (
    !crear.ok &&
    crear.status !== 409
  ) {
    const detalle =
      await crear.text();

    throw new Error(
      `No se pudo crear Comprobantes_Pagos. ${detalle}`
    );
  }
}

function timestampTijuana() {
  const partes =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/Tijuana",

        year: "numeric",
        month: "2-digit",
        day: "2-digit",

        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",

        hour12: false,
      }
    ).formatToParts(
      new Date()
    );

  const valores:
    Record<string, string> =
    {};

  for (
    const parte of partes
  ) {
    if (
      parte.type !==
      "literal"
    ) {
      valores[
        parte.type
      ] = parte.value;
    }
  }

  return `${valores.year}${valores.month}${valores.day}_${valores.hour}${valores.minute}${valores.second}_${Date.now()
    .toString()
    .slice(-4)}`;
}

function limpiarNombreArchivo(
  valor: string
) {
  return valor
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    )
    .replace(
      /_+/g,
      "_"
    );
}

function extensionArchivo(
  archivo: File
) {
  const nombre =
    archivo.name || "";

  const extension =
    nombre
      .split(".")
      .pop()
      ?.toLowerCase();

  if (
    extension === "jpg" ||
    extension === "jpeg" ||
    extension === "png" ||
    extension === "webp"
  ) {
    return extension;
  }

  if (
    archivo.type ===
    "image/png"
  ) {
    return "png";
  }

  if (
    archivo.type ===
    "image/webp"
  ) {
    return "webp";
  }

  return "jpg";
}

async function subirComprobante(
  accessToken: string,
  archivo: File,
  folio: string
) {
  await asegurarCarpetaComprobantes(
    accessToken
  );

  if (
    archivo.size >
    10 * 1024 * 1024
  ) {
    throw new Error(
      "La imagen del comprobante no puede superar 10 MB."
    );
  }

  const permitidos = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (
    archivo.type &&
    !permitidos.includes(
      archivo.type
    )
  ) {
    throw new Error(
      "El comprobante debe ser JPG, PNG o WEBP."
    );
  }

  const nombre =
    limpiarNombreArchivo(
      `${folio}_${timestampTijuana()}.${extensionArchivo(
        archivo
      )}`
    );

  const ruta =
    `${CARPETA_COMPROBANTES}/${nombre}`;

  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      ruta
    )}:/content`;

  const buffer =
    Buffer.from(
      await archivo.arrayBuffer()
    );

  const response =
    await fetch(
      url,
      {
        method: "PUT",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            archivo.type ||
            "application/octet-stream",
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
      `No se pudo subir el comprobante a OneDrive. ${detalle}`
    );
  }

  const data =
    await leerJsonSeguro(
      response
    );

  return {
    ruta,

    webUrl:
      typeof data?.webUrl ===
      "string"
        ? data.webUrl
        : "",
  };
}

/* =========================================================
   UTILIDADES
========================================================= */

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
    Number.isFinite(valor)
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

  if (!limpio) {
    return 0;
  }

  const n =
    Number(limpio);

  return Number.isFinite(n)
    ? n
    : 0;
}

function dineroRedondeado(
  valor: number
) {
  return Math.round(
    (valor +
      Number.EPSILON) *
      100
  ) / 100;
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

function escribirCelda(
  hoja: XLSX.WorkSheet,
  direccion: string,
  valor:
    | string
    | number
) {
  hoja[direccion] = {
    t:
      typeof valor ===
      "number"
        ? "n"
        : "s",

    v: valor,
  };
}

function asegurarRango(
  hoja: XLSX.WorkSheet,
  fila: number,
  ultimaColumna: number
) {
  const actual =
    XLSX.utils.decode_range(
      hoja["!ref"] ||
        "A1:A1"
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

function siguienteFilaLibre(
  hoja: XLSX.WorkSheet
) {
  const rango =
    XLSX.utils.decode_range(
      hoja["!ref"] ||
        "A1:A1"
    );

  for (
    let fila = 2;
    fila <=
    rango.e.r + 2;
    fila += 1
  ) {
    const valor =
      valorCelda(
        hoja,
        "A",
        fila
      );

    if (
      valor === undefined ||
      valor === null ||
      texto(valor) === ""
    ) {
      return fila;
    }
  }

  return rango.e.r + 2;
}

function buscarFilaPorFolio(
  hoja: XLSX.WorkSheet,
  folio: string
) {
  const rango =
    XLSX.utils.decode_range(
      hoja["!ref"] ||
        "A1:A1"
    );

  for (
    let fila = 2;
    fila <=
    rango.e.r + 1;
    fila += 1
  ) {
    const actual =
      texto(
        valorCelda(
          hoja,
          "A",
          fila
        )
      );

    if (
      actual === folio
    ) {
      return fila;
    }
  }

  return 0;
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

function normalizarServicio(
  valor: unknown
):
  | "Aéreo"
  | "Terrestre"
  | "" {
  const limpio =
    texto(valor)
      .toLowerCase();

  if (
    limpio.includes(
      "aéreo"
    ) ||
    limpio.includes(
      "aereo"
    )
  ) {
    return "Aéreo";
  }

  if (
    limpio.includes(
      "terrestre"
    )
  ) {
    return "Terrestre";
  }

  return "";
}

/* =========================================================
   HISTORIAL
========================================================= */

function obtenerOCrearHistorial(
  workbook: XLSX.WorkBook
) {
  let hoja =
    workbook.Sheets[
      HOJA_HISTORIAL
    ];

  if (hoja) {
    return hoja;
  }

  hoja =
    XLSX.utils.aoa_to_sheet(
      [
        [
          "ID Pago",
          "Fecha",
          "Folio",
          "Cliente",
          "WhatsApp",
          "Servicio",
          "Total",
          "Saldo Antes",
          "Monto Pagado",
          "Saldo Después",
          "Método",
          "Referencia",
          "Comprobante",
          "URL Comprobante",
          "Observaciones",
        ],
      ]
    );

  XLSX.utils.book_append_sheet(
    workbook,
    hoja,
    HOJA_HISTORIAL
  );

  return hoja;
}

type ResumenHistorial = {
  pagado: number;
  total: number;
  servicio:
    | "Aéreo"
    | "Terrestre"
    | "";
  ultimaFecha: string;
  ultimoMetodo: string;
  ultimaReferencia: string;
};

function resumenHistorialPorFolio(
  hoja:
    | XLSX.WorkSheet
    | undefined,
  folio: string
): ResumenHistorial {
  const resumen:
    ResumenHistorial = {
      pagado: 0,
      total: 0,
      servicio: "",
      ultimaFecha: "",
      ultimoMetodo: "",
      ultimaReferencia: "",
    };

  if (!hoja) {
    return resumen;
  }

  const rango =
    XLSX.utils.decode_range(
      hoja["!ref"] ||
        "A1:O1"
    );

  for (
    let fila = 2;
    fila <=
    rango.e.r + 1;
    fila += 1
  ) {
    const folioHistorial =
      texto(
        valorCelda(
          hoja,
          "C",
          fila
        )
      );

    if (
      folioHistorial !==
      folio
    ) {
      continue;
    }

    resumen.pagado =
      dineroRedondeado(
        resumen.pagado +
          numero(
            valorCelda(
              hoja,
              "I",
              fila
            )
          )
      );

    const totalMovimiento =
      numero(
        valorCelda(
          hoja,
          "G",
          fila
        )
      );

    if (
      totalMovimiento > 0
    ) {
      resumen.total =
        totalMovimiento;
    }

    const servicio =
      normalizarServicio(
        valorCelda(
          hoja,
          "F",
          fila
        )
      );

    if (servicio) {
      resumen.servicio =
        servicio;
    }

    resumen.ultimaFecha =
      texto(
        valorCelda(
          hoja,
          "B",
          fila
        )
      );

    resumen.ultimoMetodo =
      texto(
        valorCelda(
          hoja,
          "K",
          fila
        )
      );

    resumen.ultimaReferencia =
      texto(
        valorCelda(
          hoja,
          "L",
          fila
        )
      );
  }

  return resumen;
}

/* =========================================================
   GET
========================================================= */

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

    const historial =
      workbook.Sheets[
        HOJA_HISTORIAL
      ];

    const rango =
      XLSX.utils.decode_range(
        hoja["!ref"] ||
          "A1:R1"
      );

    const pagos = [];

    let necesitaReparacion =
      false;

    for (
      let fila = 2;
      fila <=
      rango.e.r + 1;
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
       * ESTRUCTURA REAL:
       *
       * L = Servicio elegido
       * M = Precio final
       * N = Estado de pago
       * O = Fecha de pago
       * P = Método de pago
       * Q = Referencia
       * R = Observaciones
       */

      let servicioElegido =
        normalizarServicio(
          valorCelda(
            hoja,
            "L",
            fila
          )
        );

      let precioFinal =
        numero(
          valorCelda(
            hoja,
            "M",
            fila
          )
        );

      const resumen =
        resumenHistorialPorFolio(
          historial,
          folio
        );

      /*
       * REPARA EL ERROR DE LA VERSIÓN ANTERIOR.
       *
       * La versión anterior escribió:
       * L = precio
       * M = pagado
       * O = servicio
       *
       * Si encontramos esa firma y existe historial,
       * restauramos las columnas correctas.
       */

      const valorL =
        valorCelda(
          hoja,
          "L",
          fila
        );

      const servicioEnO =
        normalizarServicio(
          valorCelda(
            hoja,
            "O",
            fila
          )
        );

      const lEsNumero =
        numero(valorL) >
          0 &&
        !normalizarServicio(
          valorL
        );

      if (
        lEsNumero &&
        servicioEnO &&
        resumen.pagado > 0
      ) {
        servicioElegido =
          resumen.servicio ||
          servicioEnO;

        precioFinal =
          resumen.total ||
          numero(valorL);

        const saldoReparado =
          dineroRedondeado(
            Math.max(
              precioFinal -
                resumen.pagado,
              0
            )
          );

        const estadoReparado =
          saldoReparado <= 0
            ? "Pagado"
            : "Parcial";

        escribirCelda(
          hoja,
          `L${fila}`,
          servicioElegido
        );

        escribirCelda(
          hoja,
          `M${fila}`,
          precioFinal
        );

        escribirCelda(
          hoja,
          `N${fila}`,
          estadoReparado
        );

        escribirCelda(
          hoja,
          `O${fila}`,
          resumen.ultimaFecha ||
            fechaTijuana()
        );

        if (
          resumen.ultimoMetodo
        ) {
          escribirCelda(
            hoja,
            `P${fila}`,
            resumen.ultimoMetodo
          );
        }

        if (
          resumen.ultimaReferencia
        ) {
          escribirCelda(
            hoja,
            `Q${fila}`,
            resumen.ultimaReferencia
          );
        }

        necesitaReparacion =
          true;
      }

      let total =
        precioFinal;

      if (
        total <= 0 &&
        resumen.total > 0
      ) {
        total =
          resumen.total;
      }

      if (
        !servicioElegido &&
        resumen.servicio
      ) {
        servicioElegido =
          resumen.servicio;
      }

      if (
        total <= 0 &&
        servicioElegido ===
          "Aéreo"
      ) {
        total =
          totalAereo;
      }

      if (
        total <= 0 &&
        servicioElegido ===
          "Terrestre"
      ) {
        total =
          totalTerrestre;
      }

      const opcionesLower =
        opciones.toLowerCase();

      const tieneAereo =
        opcionesLower.includes(
          "aéreo"
        ) ||
        opcionesLower.includes(
          "aereo"
        );

      const tieneTerrestre =
        opcionesLower.includes(
          "terrestre"
        );

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

      let pagado =
        resumen.pagado;

      /*
       * Compatibilidad con algún registro antiguo marcado
       * como Pagado antes de existir Historial_Pagos.
       */
      const estadoExcel =
        texto(
          valorCelda(
            hoja,
            "N",
            fila
          )
        );

      if (
        pagado <= 0 &&
        estadoExcel.toLowerCase() ===
          "pagado" &&
        total > 0
      ) {
        pagado =
          total;
      }

      pagado =
        dineroRedondeado(
          pagado
        );

      const saldo =
        dineroRedondeado(
          Math.max(
            total -
              pagado,
            0
          )
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

        total:
          dineroRedondeado(
            total
          ),

        pagado,
        saldo,
        estado,

        totalAereo,
        totalTerrestre,
        opciones,

        servicioElegido,

        requiereSeleccionServicio:
          total <= 0 &&
          tieneAereo &&
          tieneTerrestre,
      });
    }

    /*
     * Si detectamos la versión anterior equivocada,
     * la corregimos una sola vez en el Excel de OneDrive.
     */
    if (
      necesitaReparacion
    ) {
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
    }

    pagos.reverse();

    return NextResponse.json({
      success: true,
      pagos,
      total:
        pagos.length,
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

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: Request
) {
  try {
    const contentType =
      request.headers.get(
        "content-type"
      ) || "";

    let folio = "";
    let servicio = "";
    let monto = 0;
    let metodo = "";
    let referencia = "";
    let observaciones = "";

    let comprobante:
      | File
      | null = null;

    if (
      contentType.includes(
        "multipart/form-data"
      )
    ) {
      const formData =
        await request.formData();

      folio =
        texto(
          formData.get(
            "folio"
          )
        );

      servicio =
        texto(
          formData.get(
            "servicio"
          )
        );

      monto =
        numero(
          formData.get(
            "monto"
          )
        );

      metodo =
        texto(
          formData.get(
            "metodo"
          )
        );

      referencia =
        texto(
          formData.get(
            "referencia"
          )
        );

      observaciones =
        texto(
          formData.get(
            "observaciones"
          )
        );

      const archivo =
        formData.get(
          "comprobante"
        );

      if (
        archivo instanceof File &&
        archivo.size > 0
      ) {
        comprobante =
          archivo;
      }
    } else {
      const body =
        await request.json();

      folio =
        texto(
          body?.folio
        );

      servicio =
        texto(
          body?.servicio
        );

      monto =
        numero(
          body?.monto
        );

      metodo =
        texto(
          body?.metodo
        );

      referencia =
        texto(
          body?.referencia
        );

      observaciones =
        texto(
          body?.observaciones
        );
    }

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

    monto =
      dineroRedondeado(
        monto
      );

    if (
      monto <= 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "El monto del pago debe ser mayor a $0.",
        },
        {
          status: 400,
        }
      );
    }

    if (!metodo) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Selecciona el método de pago.",
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

    const hoja =
      workbook.Sheets[
        HOJA_COTIZACIONES
      ];

    if (!hoja) {
      throw new Error(
        'No existe la hoja "Cotizaciones".'
      );
    }

    const fila =
      buscarFilaPorFolio(
        hoja,
        folio
      );

    if (!fila) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No se encontró la cotización indicada.",
        },
        {
          status: 404,
        }
      );
    }

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

    const historial =
      obtenerOCrearHistorial(
        workbook
      );

    const resumen =
      resumenHistorialPorFolio(
        historial,
        folio
      );

    /*
     * Si la fila todavía tiene el error de la versión
     * anterior, primero recuperamos los datos correctos
     * desde Historial_Pagos.
     */

    const valorL =
      valorCelda(
        hoja,
        "L",
        fila
      );

    const servicioViejoEnO =
      normalizarServicio(
        valorCelda(
          hoja,
          "O",
          fila
        )
      );

    const lCorrupto =
      numero(valorL) >
        0 &&
      !normalizarServicio(
        valorL
      );

    let servicioGuardado =
      normalizarServicio(
        valorL
      );

    let totalGuardado =
      numero(
        valorCelda(
          hoja,
          "M",
          fila
        )
      );

    if (
      lCorrupto &&
      servicioViejoEnO &&
      resumen.pagado > 0
    ) {
      servicioGuardado =
        resumen.servicio ||
        servicioViejoEnO;

      totalGuardado =
        resumen.total ||
        numero(valorL);
    }

    let servicioFinal =
      servicioGuardado;

    let total =
      totalGuardado;

    /*
     * Una vez elegido un servicio en el primer pago,
     * queda bloqueado para evitar que otro abono cambie
     * de terrestre a aéreo accidentalmente.
     */

    const solicitado =
      normalizarServicio(
        servicio
      );

    if (
      servicioFinal
    ) {
      if (
        solicitado &&
        solicitado !==
          servicioFinal
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              `Esta cotización ya tiene seleccionado el servicio ${servicioFinal}.`,
          },
          {
            status: 400,
          }
        );
      }
    } else {
      servicioFinal =
        solicitado;

      if (
        !servicioFinal
      ) {
        const opcionesLower =
          opciones.toLowerCase();

        const tieneAereo =
          opcionesLower.includes(
            "aéreo"
          ) ||
          opcionesLower.includes(
            "aereo"
          );

        const tieneTerrestre =
          opcionesLower.includes(
            "terrestre"
          );

        if (
          tieneAereo &&
          !tieneTerrestre
        ) {
          servicioFinal =
            "Aéreo";
        }

        if (
          tieneTerrestre &&
          !tieneAereo
        ) {
          servicioFinal =
            "Terrestre";
        }
      }
    }

    if (
      !servicioFinal
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Selecciona Aéreo o Terrestre antes de registrar el pago.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      total <= 0
    ) {
      total =
        servicioFinal ===
        "Aéreo"
          ? totalAereo
          : totalTerrestre;
    }

    total =
      dineroRedondeado(
        total
      );

    if (
      total <= 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No existe un precio válido para el servicio seleccionado.",
        },
        {
          status: 400,
        }
      );
    }

    const pagadoAnterior =
      dineroRedondeado(
        resumen.pagado
      );

    const saldoAnterior =
      dineroRedondeado(
        Math.max(
          total -
            pagadoAnterior,
          0
        )
      );

    if (
      saldoAnterior <= 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Esta cotización ya está pagada.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      monto >
      saldoAnterior
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            `El pago no puede superar el saldo pendiente de $${saldoAnterior.toFixed(
              2
            )}.`,
        },
        {
          status: 400,
        }
      );
    }

    let rutaComprobante =
      "";

    let urlComprobante =
      "";

    if (
      comprobante
    ) {
      const resultado =
        await subirComprobante(
          accessToken,
          comprobante,
          folio
        );

      rutaComprobante =
        resultado.ruta;

      urlComprobante =
        resultado.webUrl;
    }

    const nuevoPagado =
      dineroRedondeado(
        pagadoAnterior +
          monto
      );

    const nuevoSaldo =
      dineroRedondeado(
        Math.max(
          total -
            nuevoPagado,
          0
        )
      );

    const nuevoEstado:
      | "Parcial"
      | "Pagado" =
      nuevoSaldo <= 0
        ? "Pagado"
        : "Parcial";

    const fechaMovimiento =
      fechaTijuana();

    /*
     * COTIZACIONES - ESTRUCTURA CORRECTA
     *
     * L Servicio elegido
     * M Precio final
     * N Estado de pago
     * O Fecha de pago
     * P Método de pago
     * Q Referencia
     * R Observaciones originales
     */

    escribirCelda(
      hoja,
      `L${fila}`,
      servicioFinal
    );

    escribirCelda(
      hoja,
      `M${fila}`,
      total
    );

    escribirCelda(
      hoja,
      `N${fila}`,
      nuevoEstado
    );

    escribirCelda(
      hoja,
      `O${fila}`,
      fechaMovimiento
    );

    escribirCelda(
      hoja,
      `P${fila}`,
      metodo
    );

    escribirCelda(
      hoja,
      `Q${fila}`,
      referencia
    );

    /*
     * NO sobrescribimos R.
     * Ahí permanecen las observaciones originales
     * de la cotización.
     *
     * Las observaciones del pago se guardan
     * en Historial_Pagos.
     */

    asegurarRango(
      hoja,
      fila,
      17
    );

    /* =====================================================
       NUEVO MOVIMIENTO EN HISTORIAL
    ===================================================== */

    const filaHistorial =
      siguienteFilaLibre(
        historial
      );

    const idPago =
      `PAG-${Date.now()}`;

    escribirCelda(
      historial,
      `A${filaHistorial}`,
      idPago
    );

    escribirCelda(
      historial,
      `B${filaHistorial}`,
      fechaMovimiento
    );

    escribirCelda(
      historial,
      `C${filaHistorial}`,
      folio
    );

    escribirCelda(
      historial,
      `D${filaHistorial}`,
      cliente
    );

    escribirCelda(
      historial,
      `E${filaHistorial}`,
      whatsapp
    );

    escribirCelda(
      historial,
      `F${filaHistorial}`,
      servicioFinal
    );

    escribirCelda(
      historial,
      `G${filaHistorial}`,
      total
    );

    escribirCelda(
      historial,
      `H${filaHistorial}`,
      saldoAnterior
    );

    escribirCelda(
      historial,
      `I${filaHistorial}`,
      monto
    );

    escribirCelda(
      historial,
      `J${filaHistorial}`,
      nuevoSaldo
    );

    escribirCelda(
      historial,
      `K${filaHistorial}`,
      metodo
    );

    escribirCelda(
      historial,
      `L${filaHistorial}`,
      referencia
    );

    escribirCelda(
      historial,
      `M${filaHistorial}`,
      rutaComprobante
    );

    escribirCelda(
      historial,
      `N${filaHistorial}`,
      urlComprobante
    );

    escribirCelda(
      historial,
      `O${filaHistorial}`,
      observaciones
    );

    asegurarRango(
      historial,
      filaHistorial,
      14
    );

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

      idPago,
      folio,

      servicio:
        servicioFinal,

      total,

      pagado:
        nuevoPagado,

      saldo:
        nuevoSaldo,

      estado:
        nuevoEstado,

      comprobante:
        rutaComprobante,

      mensaje:
        "Pago guardado correctamente.",
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error registrando pago:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido registrando pago.",
      },
      {
        status: 500,
      }
    );
  }
}