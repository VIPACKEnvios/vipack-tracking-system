import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_EXCEL = "Envios/control_cotizaciones.xlsx";

const HOJA_SELLOS = "Sellos_Diarios";
const HOJA_PAGOS_SELLOS = "Pagos_Sellos";

const PRECIO_G = 650;
const PRECIO_C = 350;
const PRECIO_M = 550;

/* =========================================================
   TIPOS
========================================================= */

type FilaSello = {
  id: string;
  fecha: string;
  semana: string;
  g: number;
  c: number;
  m: number;
  precioG: number;
  precioC: number;
  precioM: number;
  cajas: number;
  total: number;
  fechaRegistro: string;
};

type FilaPagoSello = {
  idPago: string;
  fecha: string;
  semana: string;
  monto: number;
  referencia: string;
  observaciones: string;
  estadoMovimiento: "Activo" | "Anulado";
  motivoAnulacion: string;
  fechaAnulacion: string;
};

/* =========================================================
   UTILIDADES
========================================================= */

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function numero(valor: unknown) {
  if (
    typeof valor === "number" &&
    Number.isFinite(valor)
  ) {
    return valor;
  }

  const limpio = String(valor ?? "")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .trim();

  if (!limpio) {
    return 0;
  }

  const n = Number(limpio);

  return Number.isFinite(n) ? n : 0;
}

function enteroNoNegativo(valor: unknown) {
  const n = Math.floor(numero(valor));

  return Number.isFinite(n) && n > 0
    ? n
    : 0;
}

function redondear(valor: number) {
  return (
    Math.round(
      (valor + Number.EPSILON) * 100
    ) / 100
  );
}

function fechaHoraMexico() {
  return new Intl.DateTimeFormat(
    "es-MX",
    {
      timeZone: "America/Tijuana",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }
  ).format(new Date());
}

function esFechaISO(valor: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function lunesDeSemana(fechaISO: string) {
  if (!esFechaISO(fechaISO)) {
    return "";
  }

  const [year, month, day] =
    fechaISO.split("-").map(Number);

  const fecha = new Date(
    Date.UTC(year, month - 1, day)
  );

  const diaSemana = fecha.getUTCDay();

  const diasDesdeLunes =
    diaSemana === 0
      ? 6
      : diaSemana - 1;

  fecha.setUTCDate(
    fecha.getUTCDate() - diasDesdeLunes
  );

  const yyyy = fecha.getUTCFullYear();
  const mm = String(
    fecha.getUTCMonth() + 1
  ).padStart(2, "0");
  const dd = String(
    fecha.getUTCDate()
  ).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
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

function asegurarRango(
  hoja: XLSX.WorkSheet,
  fila: number,
  ultimaColumna: number
) {
  const rangoActual =
    hoja["!ref"] ||
    `A1:${XLSX.utils.encode_col(
      ultimaColumna
    )}1`;

  const rango =
    XLSX.utils.decode_range(
      rangoActual
    );

  rango.e.r = Math.max(
    rango.e.r,
    fila - 1
  );

  rango.e.c = Math.max(
    rango.e.c,
    ultimaColumna
  );

  hoja["!ref"] =
    XLSX.utils.encode_range(rango);
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

function siguienteFilaLibre(
  hoja: XLSX.WorkSheet
) {
  if (!hoja["!ref"]) {
    return 2;
  }

  const rango =
    XLSX.utils.decode_range(
      hoja["!ref"]
    );

  for (
    let fila = 2;
    fila <= rango.e.r + 2;
    fila++
  ) {
    const id = texto(
      valorCelda(
        hoja,
        "A",
        fila
      )
    );

    if (!id) {
      return fila;
    }
  }

  return rango.e.r + 2;
}

/* =========================================================
   CONEXIÓN ONEDRIVE
========================================================= */

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

        body:
          new URLSearchParams({
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

/* =========================================================
   HOJAS DE EXCEL
========================================================= */

function crearHojaSellos() {
  return XLSX.utils.aoa_to_sheet([
    [
      "ID",
      "Fecha",
      "Semana",
      "G",
      "C",
      "M",
      "Precio G",
      "Precio C",
      "Precio M",
      "Total Cajas",
      "Total",
      "Fecha Registro",
    ],
  ]);
}

function crearHojaPagosSellos() {
  return XLSX.utils.aoa_to_sheet([
    [
      "ID Pago",
      "Fecha",
      "Semana",
      "Monto",
      "Referencia",
      "Observaciones",
      "Estado Movimiento",
      "Motivo Anulación",
      "Fecha Anulación",
    ],
  ]);
}

function obtenerHojaSellos(
  workbook: XLSX.WorkBook
) {
  let hoja =
    workbook.Sheets[
      HOJA_SELLOS
    ];

  if (!hoja) {
    hoja = crearHojaSellos();

    XLSX.utils.book_append_sheet(
      workbook,
      hoja,
      HOJA_SELLOS
    );
  }

  return hoja;
}

function obtenerHojaPagosSellos(
  workbook: XLSX.WorkBook
) {
  let hoja =
    workbook.Sheets[
      HOJA_PAGOS_SELLOS
    ];

  if (!hoja) {
    hoja =
      crearHojaPagosSellos();

    XLSX.utils.book_append_sheet(
      workbook,
      hoja,
      HOJA_PAGOS_SELLOS
    );
  }

  return hoja;
}

function leerSellos(
  hoja: XLSX.WorkSheet,
  semanaFiltro = ""
) {
  const resultado:
    FilaSello[] = [];

  if (!hoja["!ref"]) {
    return resultado;
  }

  const rango =
    XLSX.utils.decode_range(
      hoja["!ref"]
    );

  for (
    let fila = 2;
    fila <= rango.e.r + 1;
    fila++
  ) {
    const id = texto(
      valorCelda(
        hoja,
        "A",
        fila
      )
    );

    if (!id) {
      continue;
    }

    const fecha = texto(
      valorCelda(
        hoja,
        "B",
        fila
      )
    );

    const semana =
      texto(
        valorCelda(
          hoja,
          "C",
          fila
        )
      ) ||
      lunesDeSemana(fecha);

    if (
      semanaFiltro &&
      semana !== semanaFiltro
    ) {
      continue;
    }

    resultado.push({
      id,
      fecha,
      semana,

      g: numero(
        valorCelda(
          hoja,
          "D",
          fila
        )
      ),

      c: numero(
        valorCelda(
          hoja,
          "E",
          fila
        )
      ),

      m: numero(
        valorCelda(
          hoja,
          "F",
          fila
        )
      ),

      precioG:
        numero(
          valorCelda(
            hoja,
            "G",
            fila
          )
        ) || PRECIO_G,

      precioC:
        numero(
          valorCelda(
            hoja,
            "H",
            fila
          )
        ) || PRECIO_C,

      precioM:
        numero(
          valorCelda(
            hoja,
            "I",
            fila
          )
        ) || PRECIO_M,

      cajas: numero(
        valorCelda(
          hoja,
          "J",
          fila
        )
      ),

      total: numero(
        valorCelda(
          hoja,
          "K",
          fila
        )
      ),

      fechaRegistro: texto(
        valorCelda(
          hoja,
          "L",
          fila
        )
      ),
    });
  }

  resultado.sort(
    (a, b) =>
      a.fecha.localeCompare(
        b.fecha
      )
  );

  return resultado;
}

function leerPagosSellos(
  hoja: XLSX.WorkSheet,
  semanaFiltro = ""
) {
  const resultado:
    FilaPagoSello[] = [];

  if (!hoja["!ref"]) {
    return resultado;
  }

  const rango =
    XLSX.utils.decode_range(
      hoja["!ref"]
    );

  for (
    let fila = 2;
    fila <= rango.e.r + 1;
    fila++
  ) {
    const idPago = texto(
      valorCelda(
        hoja,
        "A",
        fila
      )
    );

    if (!idPago) {
      continue;
    }

    const semana = texto(
      valorCelda(
        hoja,
        "C",
        fila
      )
    );

    if (
      semanaFiltro &&
      semana !== semanaFiltro
    ) {
      continue;
    }

    const estado =
      texto(
        valorCelda(
          hoja,
          "G",
          fila
        )
      ) || "Activo";

    resultado.push({
      idPago,

      fecha: texto(
        valorCelda(
          hoja,
          "B",
          fila
        )
      ),

      semana,

      monto: numero(
        valorCelda(
          hoja,
          "D",
          fila
        )
      ),

      referencia: texto(
        valorCelda(
          hoja,
          "E",
          fila
        )
      ),

      observaciones: texto(
        valorCelda(
          hoja,
          "F",
          fila
        )
      ),

      estadoMovimiento:
        estado.toLowerCase() ===
        "anulado"
          ? "Anulado"
          : "Activo",

      motivoAnulacion: texto(
        valorCelda(
          hoja,
          "H",
          fila
        )
      ),

      fechaAnulacion: texto(
        valorCelda(
          hoja,
          "I",
          fila
        )
      ),
    });
  }

  return resultado;
}

function resumenSemana(
  dias: FilaSello[],
  pagos: FilaPagoSello[]
) {
  const total = redondear(
    dias.reduce(
      (acumulado, dia) =>
        acumulado +
        numero(dia.total),
      0
    )
  );

  const pagado = redondear(
    pagos
      .filter(
        (pago) =>
          pago.estadoMovimiento ===
          "Activo"
      )
      .reduce(
        (acumulado, pago) =>
          acumulado +
          numero(pago.monto),
        0
      )
  );

  const saldo = redondear(
    Math.max(
      total - pagado,
      0
    )
  );

  let estado:
    | "Pendiente"
    | "Parcial"
    | "Liquidado" =
    "Pendiente";

  if (
    total > 0 &&
    saldo <= 0
  ) {
    estado = "Liquidado";
  } else if (pagado > 0) {
    estado = "Parcial";
  }

  return {
    total,
    pagado,
    saldo,
    estado,
  };
}

/* =========================================================
   GET
   /api/sellos?semana=2026-09-07
========================================================= */

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const semana =
      texto(
        url.searchParams.get(
          "semana"
        )
      );

    if (
      semana &&
      !esFechaISO(semana)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La semana debe tener formato YYYY-MM-DD.",
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

    const hojaSellos =
      obtenerHojaSellos(
        workbook
      );

    const hojaPagos =
      obtenerHojaPagosSellos(
        workbook
      );

    const dias =
      leerSellos(
        hojaSellos,
        semana
      );

    const pagos =
      leerPagosSellos(
        hojaPagos,
        semana
      );

    const resumen =
      resumenSemana(
        dias,
        pagos
      );

    const todosLosDias =
      leerSellos(
        hojaSellos
      );

    const todosLosPagos =
      leerPagosSellos(
        hojaPagos
      );

    const semanasAnteriores =
      Array.from(
        new Set(
          todosLosDias
            .map(
              (dia) =>
                dia.semana ||
                lunesDeSemana(
                  dia.fecha
                )
            )
            .filter(
              (semanaDia) =>
                Boolean(
                  semanaDia
                ) &&
                (
                  !semana ||
                  semanaDia <
                    semana
                )
            )
        )
      ).sort();

    let saldoAtrasado = 0;

    for (
      const semanaAnterior
      of semanasAnteriores
    ) {
      const diasSemana =
        todosLosDias.filter(
          (dia) =>
            (
              dia.semana ||
              lunesDeSemana(
                dia.fecha
              )
            ) ===
            semanaAnterior
        );

      const pagosSemana =
        todosLosPagos.filter(
          (pago) =>
            pago.semana ===
            semanaAnterior
        );

      const resumenAnterior =
        resumenSemana(
          diasSemana,
          pagosSemana
        );

      saldoAtrasado +=
        resumenAnterior.saldo;
    }

    saldoAtrasado =
      redondear(
        saldoAtrasado
      );

    const saldoPendienteTotal =
      redondear(
        saldoAtrasado +
        resumen.saldo
      );

    return NextResponse.json({
      success: true,
      semana,
      dias,
      pagos,
      resumen,

      resumenAcumulado: {
        saldoAtrasado,
        saldoSemana:
          resumen.saldo,
        saldoPendienteTotal,
      },
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error cargando sellos:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        dias: [],
        pagos: [],

        resumen: {
          total: 0,
          pagado: 0,
          saldo: 0,
          estado:
            "Pendiente",
        },

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido cargando sellos.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   POST
   tipo = "dia"
   tipo = "pago"
========================================================= */

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const tipo =
      texto(
        body?.tipo
      ).toLowerCase();

    if (
      tipo !== "dia" &&
      tipo !== "pago"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'El tipo debe ser "dia" o "pago".',
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

    const hojaSellos =
      obtenerHojaSellos(
        workbook
      );

    const hojaPagos =
      obtenerHojaPagosSellos(
        workbook
      );

    /* =====================================================
       AGREGAR DÍA
    ===================================================== */

    if (tipo === "dia") {
      const fecha =
        texto(
          body?.fecha
        );

      if (
        !fecha ||
        !esFechaISO(fecha)
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Selecciona una fecha válida.",
          },
          {
            status: 400,
          }
        );
      }

      const g =
        enteroNoNegativo(
          body?.g
        );

      const c =
        enteroNoNegativo(
          body?.c
        );

      const m =
        enteroNoNegativo(
          body?.m
        );

      if (
        g + c + m <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Captura al menos una caja.",
          },
          {
            status: 400,
          }
        );
      }

      const semana =
        lunesDeSemana(
          fecha
        );

      const diasExistentes =
        leerSellos(
          hojaSellos
        );

      const yaExiste =
        diasExistentes.some(
          (dia) =>
            dia.fecha === fecha
        );

      if (yaExiste) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Ya existe un registro de sellos para esa fecha.",
          },
          {
            status: 409,
          }
        );
      }

      const cajas =
        g + c + m;

      const total =
        redondear(
          g * PRECIO_G +
            c * PRECIO_C +
            m * PRECIO_M
        );

      const id =
        `SEL-${Date.now()}`;

      const fila =
        siguienteFilaLibre(
          hojaSellos
        );

      escribirCelda(
        hojaSellos,
        `A${fila}`,
        id
      );

      escribirCelda(
        hojaSellos,
        `B${fila}`,
        fecha
      );

      escribirCelda(
        hojaSellos,
        `C${fila}`,
        semana
      );

      escribirCelda(
        hojaSellos,
        `D${fila}`,
        g
      );

      escribirCelda(
        hojaSellos,
        `E${fila}`,
        c
      );

      escribirCelda(
        hojaSellos,
        `F${fila}`,
        m
      );

      escribirCelda(
        hojaSellos,
        `G${fila}`,
        PRECIO_G
      );

      escribirCelda(
        hojaSellos,
        `H${fila}`,
        PRECIO_C
      );

      escribirCelda(
        hojaSellos,
        `I${fila}`,
        PRECIO_M
      );

      escribirCelda(
        hojaSellos,
        `J${fila}`,
        cajas
      );

      escribirCelda(
        hojaSellos,
        `K${fila}`,
        total
      );

      escribirCelda(
        hojaSellos,
        `L${fila}`,
        fechaHoraMexico()
      );

      asegurarRango(
        hojaSellos,
        fila,
        11
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

        dia: {
          id,
          fecha,
          semana,
          g,
          c,
          m,
          precioG: PRECIO_G,
          precioC: PRECIO_C,
          precioM: PRECIO_M,
          cajas,
          total,
        },

        mensaje:
          "Día de sellos guardado correctamente.",
      });
    }

    /* =====================================================
       AGREGAR PAGO
       El abono puede cubrir saldo atrasado + semana actual.
       Se distribuye automáticamente de la semana más antigua
       a la más reciente.
    ===================================================== */

    const semana =
      texto(
        body?.semana
      );

    if (
      !semana ||
      !esFechaISO(semana)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La semana es obligatoria.",
        },
        {
          status: 400,
        }
      );
    }

    const fecha =
      texto(
        body?.fecha
      );

    if (
      !fecha ||
      !esFechaISO(fecha)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Selecciona una fecha válida para el pago.",
        },
        {
          status: 400,
        }
      );
    }

    const monto =
      redondear(
        numero(
          body?.monto
        )
      );

    if (
      !Number.isFinite(monto) ||
      monto <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Captura un monto de pago válido.",
        },
        {
          status: 400,
        }
      );
    }

    const referencia =
      texto(
        body?.referencia
      );

    const observaciones =
      texto(
        body?.observaciones
      );

    const todosLosDias =
      leerSellos(
        hojaSellos
      );

    const todosLosPagos =
      leerPagosSellos(
        hojaPagos
      );

    const semanasConSellos =
      Array.from(
        new Set(
          todosLosDias
            .map(
              (dia) =>
                dia.semana ||
                lunesDeSemana(
                  dia.fecha
                )
            )
            .filter(
              (semanaDia) =>
                Boolean(
                  semanaDia
                ) &&
                semanaDia <=
                  semana
            )
        )
      ).sort();

    const pendientesPorSemana:
      Array<{
        semana: string;
        saldo: number;
      }> = [];

    for (
      const semanaPendiente
      of semanasConSellos
    ) {
      const diasSemana =
        todosLosDias.filter(
          (dia) =>
            (
              dia.semana ||
              lunesDeSemana(
                dia.fecha
              )
            ) ===
            semanaPendiente
        );

      const pagosSemana =
        todosLosPagos.filter(
          (pago) =>
            pago.semana ===
            semanaPendiente
        );

      const resumenPendiente =
        resumenSemana(
          diasSemana,
          pagosSemana
        );

      if (
        resumenPendiente.saldo >
        0
      ) {
        pendientesPorSemana.push({
          semana:
            semanaPendiente,
          saldo:
            resumenPendiente.saldo,
        });
      }
    }

    const pendienteTotal =
      redondear(
        pendientesPorSemana.reduce(
          (
            acumulado,
            pendiente
          ) =>
            acumulado +
            pendiente.saldo,
          0
        )
      );

    if (
      pendienteTotal <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No hay saldo pendiente para pagar hasta esta semana.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      monto >
      pendienteTotal
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `El pago no puede ser mayor al pendiente total de $${pendienteTotal.toLocaleString(
              "es-MX"
            )}.`,
        },
        {
          status: 400,
        }
      );
    }

    let restante =
      monto;

    const pagosCreados:
      FilaPagoSello[] = [];

    for (
      let indice = 0;
      indice <
      pendientesPorSemana.length &&
      restante > 0;
      indice++
    ) {
      const pendiente =
        pendientesPorSemana[
          indice
        ];

      const aplicar =
        redondear(
          Math.min(
            restante,
            pendiente.saldo
          )
        );

      if (
        aplicar <= 0
      ) {
        continue;
      }

      const idPago =
        `PSEL-${Date.now()}-${indice + 1}`;

      const fila =
        siguienteFilaLibre(
          hojaPagos
        );

      escribirCelda(
        hojaPagos,
        `A${fila}`,
        idPago
      );

      escribirCelda(
        hojaPagos,
        `B${fila}`,
        fecha
      );

      escribirCelda(
        hojaPagos,
        `C${fila}`,
        pendiente.semana
      );

      escribirCelda(
        hojaPagos,
        `D${fila}`,
        aplicar
      );

      escribirCelda(
        hojaPagos,
        `E${fila}`,
        referencia
      );

      escribirCelda(
        hojaPagos,
        `F${fila}`,
        observaciones
      );

      escribirCelda(
        hojaPagos,
        `G${fila}`,
        "Activo"
      );

      escribirCelda(
        hojaPagos,
        `H${fila}`,
        ""
      );

      escribirCelda(
        hojaPagos,
        `I${fila}`,
        ""
      );

      asegurarRango(
        hojaPagos,
        fila,
        8
      );

      pagosCreados.push({
        idPago,
        fecha,
        semana:
          pendiente.semana,
        monto:
          aplicar,
        referencia,
        observaciones,
        estadoMovimiento:
          "Activo",
        motivoAnulacion:
          "",
        fechaAnulacion:
          "",
      });

      restante =
        redondear(
          restante -
          aplicar
        );
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

    const pagosActualizados =
      leerPagosSellos(
        hojaPagos,
        semana
      );

    const diasSemanaActual =
      leerSellos(
        hojaSellos,
        semana
      );

    const resumen =
      resumenSemana(
        diasSemanaActual,
        pagosActualizados
      );

    return NextResponse.json({
      success: true,

      pago: {
        fecha,
        monto,
        referencia,
        observaciones,
      },

      pagosCreados,

      aplicadoDesdeSemana:
        pagosCreados[0]
          ?.semana ||
        semana,

      resumen,

      mensaje:
        pagosCreados.length > 1
          ? "Abono distribuido correctamente entre saldos atrasados y la semana actual."
          : "Pago de sellos guardado correctamente.",
    });

  } catch (
    error: unknown
  ) {
    console.error(
      "Error guardando sellos:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido guardando sellos.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   DELETE
   /api/sellos?id=SEL-...
========================================================= */

export async function DELETE(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const id =
      texto(
        url.searchParams.get(
          "id"
        )
      );

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El ID del registro es obligatorio.",
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

    const hojaSellos =
      obtenerHojaSellos(
        workbook
      );

    const rango =
      XLSX.utils.decode_range(
        hojaSellos["!ref"] ||
          "A1:L1"
      );

    let filaEncontrada = 0;
    let semana = "";

    for (
      let fila = 2;
      fila <= rango.e.r + 1;
      fila++
    ) {
      const idFila =
        texto(
          valorCelda(
            hojaSellos,
            "A",
            fila
          )
        );

      if (
        idFila === id
      ) {
        filaEncontrada =
          fila;

        semana =
          texto(
            valorCelda(
              hojaSellos,
              "C",
              fila
            )
          );

        break;
      }
    }

    if (!filaEncontrada) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se encontró el registro de sellos.",
        },
        {
          status: 404,
        }
      );
    }

    const hojaPagos =
      obtenerHojaPagosSellos(
        workbook
      );

    const pagos =
      leerPagosSellos(
        hojaPagos,
        semana
      );

    const tienePagosActivos =
      pagos.some(
        (pago) =>
          pago.estadoMovimiento ===
          "Activo" &&
          pago.monto > 0
      );

    if (tienePagosActivos) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No puedes eliminar un día de una semana que ya tiene pagos registrados.",
        },
        {
          status: 409,
        }
      );
    }

    for (
      let columna = 0;
      columna <= 11;
      columna++
    ) {
      const direccion =
        `${XLSX.utils.encode_col(
          columna
        )}${filaEncontrada}`;

      if (
        hojaSellos[
          direccion
        ]
      ) {
        delete hojaSellos[
          direccion
        ];
      }
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
      id,
      mensaje:
        "Registro de sellos eliminado correctamente.",
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error eliminando sellos:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido eliminando sellos.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   PATCH
   ANULAR PAGO DE SELLOS

   body:
   {
     idPago: "PSEL-...",
     motivo: "..."
   }
========================================================= */

export async function PATCH(
  request: Request
) {
  try {
    const body =
      await request.json();

    const idPago =
      texto(
        body?.idPago
      );

    const motivo =
      texto(
        body?.motivo
      );

    if (!idPago) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El ID del pago es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      motivo.length < 3
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Escribe el motivo de la anulación.",
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

    const hojaPagos =
      obtenerHojaPagosSellos(
        workbook
      );

    const rango =
      XLSX.utils.decode_range(
        hojaPagos["!ref"] ||
          "A1:I1"
      );

    let filaEncontrada = 0;
    let semana = "";
    let estadoActual = "";

    for (
      let fila = 2;
      fila <= rango.e.r + 1;
      fila++
    ) {
      const idFila =
        texto(
          valorCelda(
            hojaPagos,
            "A",
            fila
          )
        );

      if (
        idFila === idPago
      ) {
        filaEncontrada =
          fila;

        semana =
          texto(
            valorCelda(
              hojaPagos,
              "C",
              fila
            )
          );

        estadoActual =
          texto(
            valorCelda(
              hojaPagos,
              "G",
              fila
            )
          );

        break;
      }
    }

    if (!filaEncontrada) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se encontró el pago de sellos.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      estadoActual.toLowerCase() ===
      "anulado"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ese pago ya está anulado.",
        },
        {
          status: 409,
        }
      );
    }

    escribirCelda(
      hojaPagos,
      `G${filaEncontrada}`,
      "Anulado"
    );

    escribirCelda(
      hojaPagos,
      `H${filaEncontrada}`,
      motivo
    );

    escribirCelda(
      hojaPagos,
      `I${filaEncontrada}`,
      fechaHoraMexico()
    );

    asegurarRango(
      hojaPagos,
      filaEncontrada,
      8
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

    const hojaSellos =
      obtenerHojaSellos(
        workbook
      );

    const dias =
      leerSellos(
        hojaSellos,
        semana
      );

    const pagos =
      leerPagosSellos(
        hojaPagos,
        semana
      );

    const resumen =
      resumenSemana(
        dias,
        pagos
      );

    return NextResponse.json({
      success: true,
      idPago,
      semana,
      resumen,
      mensaje:
        "Pago de sellos anulado correctamente.",
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "Error anulando pago de sellos:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido anulando pago de sellos.",
      },
      {
        status: 500,
      }
    );
  }
}