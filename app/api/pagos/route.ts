import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_EXCEL = "Envios/control_cotizaciones.xlsx";
const CARPETA_COMPROBANTES = "Envios/Comprobantes_Pagos";

const HOJA_COTIZACIONES = "Cotizaciones";
const HOJA_HISTORIAL = "Historial_Pagos";

/* =========================================================
   CONEXION ACTUAL A ONEDRIVE
   Supabase aqui SOLO conserva el refresh token existente.
   Pagos, Excel y comprobantes se guardan en OneDrive.
========================================================= */

function crearSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de configuración para recuperar la conexión de OneDrive."
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
      `No se pudo consultar la conexión de OneDrive: ${error.message}`
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
    const { error: updateError } =
      await supabase
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
   EXCEL ONEDRIVE
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
   COMPROBANTES EN ONEDRIVE
========================================================= */

async function asegurarCarpetaComprobantes(
  accessToken: string
) {
  const consultar =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      CARPETA_COMPROBANTES
    )}`;

  const existe =
    await fetch(consultar, {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },

      cache: "no-store",
    });

  if (existe.ok) {
    return;
  }

  if (existe.status !== 404) {
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
          name: "Comprobantes_Pagos",

          folder: {},

          "@microsoft.graph.conflictBehavior":
            "fail",
        }),

        cache: "no-store",
      }
    );

  if (!crear.ok && crear.status !== 409) {
    const detalle =
      await crear.text();

    throw new Error(
      `No se pudo crear la carpeta Comprobantes_Pagos. ${detalle}`
    );
  }
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

  const ultima =
    nombre
      .split(".")
      .pop()
      ?.toLowerCase();

  if (
    ultima === "jpg" ||
    ultima === "jpeg" ||
    ultima === "png" ||
    ultima === "webp"
  ) {
    return ultima;
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

  const tiposPermitidos =
    [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

  if (
    archivo.type &&
    !tiposPermitidos.includes(
      archivo.type
    )
  ) {
    throw new Error(
      "El comprobante debe ser JPG, PNG o WEBP."
    );
  }

  const ahora =
    new Date();

  const marca =
    [
      ahora.getFullYear(),
      String(
        ahora.getMonth() + 1
      ).padStart(2, "0"),
      String(
        ahora.getDate()
      ).padStart(2, "0"),

      "_",

      String(
        ahora.getHours()
      ).padStart(2, "0"),
      String(
        ahora.getMinutes()
      ).padStart(2, "0"),
      String(
        ahora.getSeconds()
      ).padStart(2, "0"),

      "_",

      String(
        ahora.getMilliseconds()
      ).padStart(3, "0"),
    ].join("");

  const extension =
    extensionArchivo(
      archivo
    );

  const nombre =
    limpiarNombreArchivo(
      `${folio}_${marca}.${extension}`
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
    await fetch(url, {
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
    });

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
    nombre,

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
  hoja: XLSX.WorkSheet,
  columna = "A"
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
      hoja[
        `${columna}${fila}`
      ]?.v;

    if (
      valor === undefined ||
      valor === null ||
      String(valor).trim() ===
        ""
    ) {
      return fila;
    }
  }

  return rango.e.r + 2;
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

/* =========================================================
   GET - LISTADO
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

    const rango =
      XLSX.utils.decode_range(
        hoja["!ref"] ||
          "A1:R1"
      );

    const pagos = [];

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
          total -
            pagado,
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

/* =========================================================
   POST - REGISTRAR ABONO
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

    /*
      Soporta el JSON que actualmente manda tu pantalla
      y también FormData cuando agreguemos la fotografía.
    */

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

    let total =
      numero(
        valorCelda(
          hoja,
          "L",
          fila
        )
      );

    let servicioFinal =
      texto(
        valorCelda(
          hoja,
          "O",
          fila
        )
      );

    if (
      total <= 0
    ) {
      const servicioLower =
        servicio.toLowerCase();

      if (
        servicioLower.includes(
          "aéreo"
        ) ||
        servicioLower.includes(
          "aereo"
        )
      ) {
        total =
          totalAereo;

        servicioFinal =
          "Aéreo";
      } else if (
        servicioLower.includes(
          "terrestre"
        )
      ) {
        total =
          totalTerrestre;

        servicioFinal =
          "Terrestre";
      }
    }

    if (
      total <= 0
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

    const pagadoAnterior =
      numero(
        valorCelda(
          hoja,
          "M",
          fila
        )
      );

    const saldoAnterior =
      Math.max(
        total -
          pagadoAnterior,
        0
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

    if (comprobante) {
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
      pagadoAnterior +
      monto;

    const nuevoSaldo =
      Math.max(
        total -
          nuevoPagado,
        0
      );

    const nuevoEstado =
      nuevoSaldo <= 0
        ? "Pagado"
        : nuevoPagado > 0
        ? "Parcial"
        : "Pendiente";

    /*
      Cotizaciones:
      L = Total definitivo
      M = Total pagado acumulado
      N = Estado
      O = Servicio elegido
      P = Último método
      Q = Última referencia
    */

    escribirCelda(
      hoja,
      `L${fila}`,
      total
    );

    escribirCelda(
      hoja,
      `M${fila}`,
      nuevoPagado
    );

    escribirCelda(
      hoja,
      `N${fila}`,
      nuevoEstado
    );

    escribirCelda(
      hoja,
      `O${fila}`,
      servicioFinal
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

    asegurarRango(
      hoja,
      fila,
      17
    );

    /*
      Historial independiente.
      Nunca se reemplaza un abono anterior.
    */

    const historial =
      obtenerOCrearHistorial(
        workbook
      );

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
      fechaTijuana()
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