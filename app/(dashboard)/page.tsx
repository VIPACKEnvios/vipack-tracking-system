"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Bazar = {
  id: string;
  estado: string | null;
};

type EnvioPDF = {
  id: number;
  cliente: string | null;
  pdf: string | null;
};

type EstadoConteo = {
  estado: string;
  envios: number;
};

type MetodoDeteccion = "texto" | "cp" | "sin-detectar";

type ResultadoEstado = {
  estado: string;
  metodo: MetodoDeteccion;
  paqueteria: string;
};

type AuditoriaPDF = {
  id: number;
  cliente: string;
  archivo: string;
  paqueteria: string;
  estado: string;
  metodo: MetodoDeteccion;
};

const ESTADOS_MEXICO = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
] as const;

const ALIAS_ESTADOS: Record<string, string[]> = {
  "Aguascalientes": ["AGUASCALIENTES", "AGS"],
  "Baja California": ["BAJA CALIFORNIA", "B C", "BC"],
  "Baja California Sur": ["BAJA CALIFORNIA SUR", "B C S", "BCS"],
  "Campeche": ["CAMPECHE", "CAMP"],
  "Chiapas": ["CHIAPAS", "CHIS"],
  "Chihuahua": ["CHIHUAHUA", "CHIH"],
  "Ciudad de México": [
    "CIUDAD DE MEXICO",
    "CDMX",
    "DISTRITO FEDERAL",
    "DF",
  ],
  "Coahuila": ["COAHUILA", "COAH"],
  "Colima": ["COLIMA", "COL"],
  "Durango": ["DURANGO", "DGO"],
  "Estado de México": [
    "ESTADO DE MEXICO",
    "EDO DE MEXICO",
    "EDOMEX",
    "MEXICO MEX",
  ],
  "Guanajuato": ["GUANAJUATO", "GTO"],
  "Guerrero": ["GUERRERO", "GRO"],
  "Hidalgo": ["HIDALGO", "HGO"],
  "Jalisco": ["JALISCO", "JAL"],
  "Michoacán": ["MICHOACAN", "MICH"],
  "Morelos": ["MORELOS", "MOR"],
  "Nayarit": ["NAYARIT", "NAY"],
  "Nuevo León": ["NUEVO LEON", "NL", "N L"],
  "Oaxaca": ["OAXACA", "OAX"],
  "Puebla": ["PUEBLA", "PUE"],
  "Querétaro": ["QUERETARO", "QRO"],
  "Quintana Roo": ["QUINTANA ROO", "Q ROO", "QROO"],
  "San Luis Potosí": ["SAN LUIS POTOSI", "SLP"],
  "Sinaloa": ["SINALOA", "SIN"],
  "Sonora": ["SONORA", "SON"],
  "Tabasco": ["TABASCO", "TAB"],
  "Tamaulipas": ["TAMAULIPAS", "TAMPS", "TAMP"],
  "Tlaxcala": ["TLAXCALA", "TLAX"],
  "Veracruz": ["VERACRUZ", "VER"],
  "Yucatán": ["YUCATAN", "YUC"],
  "Zacatecas": ["ZACATECAS", "ZAC"],
};

function normalizarTexto(valor: string) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buscarEstadoEnBloque(textoBloque: string) {
  const texto = ` ${normalizarTexto(textoBloque)} `;

  const estadosOrdenados = [...ESTADOS_MEXICO].sort(
    (a, b) => b.length - a.length
  );

  for (const estado of estadosOrdenados) {
    const aliases = ALIAS_ESTADOS[estado] || [];
    const aliasesOrdenados = [...aliases].sort(
      (a, b) => b.length - a.length
    );

    for (const alias of aliasesOrdenados) {
      const limpio = normalizarTexto(alias);
      if (!limpio) continue;

      if (limpio.length <= 4) {
        const patron = new RegExp(
          `(?:^|\\s)${limpio.replace(/\s+/g, "\\s+")}(?:\\s|$)`,
          "i"
        );

        if (patron.test(texto)) {
          return estado;
        }
      } else if (texto.includes(` ${limpio} `)) {
        return estado;
      }
    }
  }

  return "";
}

function detectarPaqueteriaDesdeTexto(textoPDF: string) {
  const texto = normalizarTexto(textoPDF);

  if (
    texto.includes("DHL") ||
    texto.includes("WAYBILL") ||
    texto.includes("MYDHL")
  ) {
    return "DHL";
  }

  if (
    texto.includes("ESTAFETA") ||
    texto.includes("CODIGO DE RASTREO") ||
    texto.includes("CONFIRMACION")
  ) {
    return "ESTAFETA";
  }

  if (
    texto.includes("FEDEX") ||
    texto.includes("FEDERAL EXPRESS")
  ) {
    return "FEDEX";
  }

  if (
    texto.includes("PAQUETEXPRESS") ||
    texto.includes("PAQUETE EXPRESS")
  ) {
    return "PAQUETEXPRESS";
  }

  return "OTRA";
}

/*
 * Respaldo por código postal mexicano.
 * Se usa SOLO dentro del bloque del destinatario, nunca en todo el PDF.
 * Los rangos son deliberadamente amplios por entidad para rescatar guías
 * donde la paquetería imprime CP pero omite/abrevia el estado.
 */
const RANGOS_CP: Array<{
  min: number;
  max: number;
  estado: string;
}> = [
  { min: 1000, max: 16999, estado: "Ciudad de México" },
  { min: 20000, max: 20999, estado: "Aguascalientes" },
  { min: 21000, max: 22999, estado: "Baja California" },
  { min: 23000, max: 23999, estado: "Baja California Sur" },
  { min: 24000, max: 24999, estado: "Campeche" },
  { min: 25000, max: 27999, estado: "Coahuila" },
  { min: 28000, max: 28999, estado: "Colima" },
  { min: 29000, max: 30999, estado: "Chiapas" },
  { min: 31000, max: 33999, estado: "Chihuahua" },
  { min: 34000, max: 35999, estado: "Durango" },
  { min: 36000, max: 38999, estado: "Guanajuato" },
  { min: 39000, max: 41999, estado: "Guerrero" },
  { min: 42000, max: 43999, estado: "Hidalgo" },
  { min: 44000, max: 49999, estado: "Jalisco" },
  { min: 50000, max: 57999, estado: "Estado de México" },
  { min: 58000, max: 61999, estado: "Michoacán" },
  { min: 62000, max: 62999, estado: "Morelos" },
  { min: 63000, max: 63999, estado: "Nayarit" },
  { min: 64000, max: 67999, estado: "Nuevo León" },
  { min: 68000, max: 71999, estado: "Oaxaca" },
  { min: 72000, max: 75999, estado: "Puebla" },
  { min: 76000, max: 76999, estado: "Querétaro" },
  { min: 77000, max: 77999, estado: "Quintana Roo" },
  { min: 78000, max: 79999, estado: "San Luis Potosí" },
  { min: 80000, max: 82999, estado: "Sinaloa" },
  { min: 83000, max: 85999, estado: "Sonora" },
  { min: 86000, max: 86999, estado: "Tabasco" },
  { min: 87000, max: 89999, estado: "Tamaulipas" },
  { min: 90000, max: 90999, estado: "Tlaxcala" },
  { min: 91000, max: 96999, estado: "Veracruz" },
  { min: 97000, max: 97999, estado: "Yucatán" },
  { min: 98000, max: 99999, estado: "Zacatecas" },
];

function buscarEstadoPorCP(textoBloque: string) {
  const candidatos =
    String(textoBloque || "").match(/(?:^|\D)(\d{5})(?!\d)/g) || [];

  for (const candidato of candidatos) {
    const match = candidato.match(/\d{5}/);
    if (!match) continue;

    const cp = Number(match[0]);
    const rango = RANGOS_CP.find(
      (item) => cp >= item.min && cp <= item.max
    );

    if (rango) {
      return rango.estado;
    }
  }

  return "";
}

function extraerBloqueDestinatario(
  textoPDF: string,
  paqueteria: string
) {
  const texto = String(textoPDF || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (paqueteria === "DHL") {
    const patrones = [
      /\bRECEIVER\s*:?\s*([\s\S]*?)(?=\bPRODUCT\s+DETAILS\b|\bPAYER\s+DETAILS\b|\bFEATURES\b|\bSHIPMENT\s+DETAILS\b|\bWAYBILL\b|$)/i,
      /\bSHIP\s+TO\s*:?\s*([\s\S]*?)(?=\bSHIP\s+FROM\b|\bWAYBILL\b|\bCONTENTS\b|\bPRODUCT\b|\bREFERENCE\b|$)/i,
      /\bTO\s*:?\s*([\s\S]*?)(?=\bCONTACT\s*:|\bDAY\s+TIME\b|\bREF\s*:|\bWAYBILL\b|\bCONTENTS\b|\bFROM\s*:|$)/i,
    ];

    for (const patron of patrones) {
      const match = texto.match(patron);
      if (match?.[1]) return match[1];
    }
  }

  if (paqueteria === "ESTAFETA") {
    const patrones = [
      /\bDESTINATARIO\b\s*:?\s*([\s\S]*?)(?=\bREMITENTE\b|\bORIGEN\b|\bCONTENIDO\b|\bREFERENCIA\b|\bCODIGO\s+DE\s+RASTREO\b|\bRASTREO\b|\bSERVICIO\b|$)/i,
      /\bCONSIGNATARIO\b\s*:?\s*([\s\S]*?)(?=\bREMITENTE\b|\bORIGEN\b|\bCONTENIDO\b|\bREFERENCIA\b|\bRASTREO\b|\bSERVICIO\b|$)/i,
      /\bRECIBE\b\s*:?\s*([\s\S]*?)(?=\bREMITENTE\b|\bORIGEN\b|\bCONTENIDO\b|\bREFERENCIA\b|\bRASTREO\b|\bSERVICIO\b|$)/i,
    ];

    for (const patron of patrones) {
      const match = texto.match(patron);
      if (match?.[1]) return match[1];
    }
  }

  if (paqueteria === "FEDEX") {
    const match = texto.match(
      /\b(?:SHIP\s+TO|RECIPIENT|CONSIGNEE)\b\s*:?\s*([\s\S]*?)(?=\b(?:SHIP\s+FROM|SENDER|TRACKING|PACKAGE|SERVICE|REF)\b|$)/i
    );

    if (match?.[1]) return match[1];
  }

  if (paqueteria === "PAQUETEXPRESS") {
    const match = texto.match(
      /\b(?:DESTINATARIO|CONSIGNATARIO|RECIBE|ENTREGAR\s+A)\b\s*:?\s*([\s\S]*?)(?=\b(?:REMITENTE|ORIGEN|CONTENIDO|REFERENCIA|RASTREO|SERVICIO)\b|$)/i
    );

    if (match?.[1]) return match[1];
  }

  const generico = texto.match(
    /\b(?:DESTINATARIO|RECEIVER|RECIPIENT|CONSIGNEE|SHIP\s+TO|ENTREGAR\s+A)\b\s*:?\s*([\s\S]*?)(?=\b(?:REMITENTE|SHIPPER|SENDER|SHIP\s+FROM|ORIGEN|PRODUCT|TRACKING|WAYBILL|GUIA|GU[IÍ]A)\b|$)/i
  );

  return generico?.[1] || "";
}

function detectarEstadoDestinatario(
  textoPDF: string
): ResultadoEstado {
  const paqueteria =
    detectarPaqueteriaDesdeTexto(textoPDF);

  const bloqueDestinatario =
    extraerBloqueDestinatario(
      textoPDF,
      paqueteria
    );

  if (!bloqueDestinatario) {
    return {
      estado: "",
      metodo: "sin-detectar",
      paqueteria,
    };
  }

  const porTexto =
    buscarEstadoEnBloque(
      bloqueDestinatario
    );

  if (porTexto) {
    return {
      estado: porTexto,
      metodo: "texto",
      paqueteria,
    };
  }

  const porCP =
    buscarEstadoPorCP(
      bloqueDestinatario
    );

  if (porCP) {
    return {
      estado: porCP,
      metodo: "cp",
      paqueteria,
    };
  }

  return {
    estado: "",
    metodo: "sin-detectar",
    paqueteria,
  };
}

async function extraerTextoPDFDesdeUrl(
  pdfUrl: string
) {
  const pdfjs =
    await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc =
    new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

  const response = await fetch(
    pdfUrl,
    {
      cache: "force-cache",
    }
  );

  if (!response.ok) {
    throw new Error(
      `No se pudo descargar PDF (${response.status})`
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  const pdf =
    await pdfjs
      .getDocument({
        data: arrayBuffer,
      })
      .promise;

  let texto = "";

  /*
   * Para detectar destino normalmente basta con las primeras 2 hojas.
   * DHL coloca el destinatario en la hoja 1 y nuevamente en la hoja 2.
   * Esto evita leer PDFs muy largos innecesariamente.
   */
  const paginasALeer =
    Math.min(
      pdf.numPages,
      4
    );

  for (
    let pagina = 1;
    pagina <= paginasALeer;
    pagina++
  ) {
    const page =
      await pdf.getPage(
        pagina
      );

    const content =
      await page.getTextContent();

    texto +=
      content.items
        .map(
          (item: any) =>
            item?.str || ""
        )
        .join(" ") + " ";
  }

  return texto;
}

export default function DashboardPage() {
  const [cargando, setCargando] =
    useState(true);

  const [cargandoEstados, setCargandoEstados] =
    useState(true);

  const [totalBazares, setTotalBazares] =
    useState(0);

  const [bazaresActivos, setBazaresActivos] =
    useState(0);

  const [
    bazaresPendientes,
    setBazaresPendientes,
  ] = useState(0);

  const [
    estadosConteo,
    setEstadosConteo,
  ] = useState<EstadoConteo[]>([]);

  const [
    pdfsProcesados,
    setPdfsProcesados,
  ] = useState(0);

  const [
    pdfsSinEstado,
    setPdfsSinEstado,
  ] = useState(0);

  const [
    auditoriaPDFs,
    setAuditoriaPDFs,
  ] = useState<AuditoriaPDF[]>([]);

  const [
    mostrarAuditoria,
    setMostrarAuditoria,
  ] = useState(false);

  useEffect(() => {
    async function cargarResumen() {
      try {
        const respuesta = await fetch(
          "/api/admin/bazares",
          {
            cache: "no-store",
          }
        );

        const resultado =
          await respuesta.json();

        if (
          !respuesta.ok ||
          !resultado.success
        ) {
          throw new Error(
            resultado.error ||
              "No fue posible cargar los bazares."
          );
        }

        const bazares: Bazar[] =
          resultado.bazares || [];

        const activos =
          bazares.filter(
            (bazar) =>
              String(
                bazar.estado || ""
              )
                .trim()
                .toLowerCase() ===
              "activo"
          ).length;

        const pendientes =
          bazares.filter(
            (bazar) =>
              String(
                bazar.estado || ""
              )
                .trim()
                .toLowerCase() ===
              "pendiente"
          ).length;

        setTotalBazares(
          bazares.length
        );

        setBazaresActivos(
          activos
        );

        setBazaresPendientes(
          pendientes
        );
      } catch (error) {
        console.error(
          "Error cargando resumen del dashboard:",
          error
        );
      } finally {
        setCargando(false);
      }
    }

    cargarResumen();
  }, []);

  useEffect(() => {
    async function cargarEstadosDesdePDF() {
      try {
        setCargandoEstados(
          true
        );

        const {
          data,
          error,
        } = await supabase
          .from("envios")
          .select(
            "id, cliente, pdf"
          )
          .not(
            "pdf",
            "is",
            null
          )
          .order(
            "id",
            {
              ascending: false,
            }
          );

        if (error) {
          throw error;
        }

        const envios =
          (data || []) as EnvioPDF[];

        const conteo =
          new Map<
            string,
            number
          >();

        const auditoria: AuditoriaPDF[] = [];
        let procesados = 0;
        let sinEstado = 0;

        /*
         * Procesamos en lotes pequeños para no saturar navegador/red.
         */
        const TAMANO_LOTE = 5;

        for (
          let inicio = 0;
          inicio < envios.length;
          inicio += TAMANO_LOTE
        ) {
          const lote =
            envios.slice(
              inicio,
              inicio + TAMANO_LOTE
            );

          const resultados =
            await Promise.all(
              lote.map(
                async (envio) => {
                  if (!envio.pdf) {
                    return {
                      envio,
                      resultado: {
                        estado: "",
                        metodo: "sin-detectar" as MetodoDeteccion,
                        paqueteria: "OTRA",
                      },
                    };
                  }

                  try {
                    const texto =
                      await extraerTextoPDFDesdeUrl(
                        envio.pdf
                      );

                    return {
                      envio,
                      resultado:
                        detectarEstadoDestinatario(
                          texto
                        ),
                    };
                  } catch (error) {
                    console.warn(
                      `No se pudo analizar el PDF del envío ${envio.id}:`,
                      error
                    );

                    return {
                      envio,
                      resultado: {
                        estado: "",
                        metodo: "sin-detectar" as MetodoDeteccion,
                        paqueteria: "ERROR",
                      },
                    };
                  }
                }
              )
            );

          for (const item of resultados) {
            procesados++;

            const estado =
              item.resultado.estado;

            if (!estado) {
              sinEstado++;
            } else {
              conteo.set(
                estado,
                (conteo.get(
                  estado
                ) || 0) + 1
              );
            }

            auditoria.push({
              id: item.envio.id,
              cliente:
                item.envio.cliente ||
                "Sin cliente",
              archivo:
                item.envio.pdf
                  ?.split("/")
                  .pop()
                  ?.split("?")[0] ||
                `PDF ${item.envio.id}`,
              paqueteria:
                item.resultado
                  .paqueteria,
              estado:
                estado ||
                "Sin detectar",
              metodo:
                item.resultado.metodo,
            });
          }
        }

        const lista =
          Array.from(
            conteo.entries()
          )
            .map(
              ([
                estado,
                envios,
              ]) => ({
                estado,
                envios,
              })
            )
            .sort(
              (a, b) =>
                b.envios -
                a.envios
            );

        setEstadosConteo(
          lista
        );

        setPdfsProcesados(
          procesados
        );

        setPdfsSinEstado(
          sinEstado
        );

        setAuditoriaPDFs(
          auditoria
        );
      } catch (error) {
        console.error(
          "Error leyendo estados desde PDFs:",
          error
        );

        setEstadosConteo(
          []
        );
      } finally {
        setCargandoEstados(
          false
        );
      }
    }

    cargarEstadosDesdePDF();
  }, []);

  const totalEnviosConEstado =
    useMemo(
      () =>
        estadosConteo.reduce(
          (
            acumulado,
            item
          ) =>
            acumulado +
            item.envios,
          0
        ),
      [estadosConteo]
    );

  const estadosConPresencia =
    estadosConteo.length;

  const estadosSinPresencia =
    useMemo(
      () =>
        ESTADOS_MEXICO.filter(
          (estado) =>
            !estadosConteo.some(
              (item) =>
                item.estado ===
                estado
            )
        ),
      [estadosConteo]
    );

  const cobertura =
    Math.round(
      (estadosConPresencia /
        ESTADOS_MEXICO.length) *
        100
    );

  const maxEnvios =
    estadosConteo[0]?.envios ||
    1;

  const detectadosPorTexto =
    useMemo(
      () =>
        auditoriaPDFs.filter(
          (item) =>
            item.metodo === "texto"
        ).length,
      [auditoriaPDFs]
    );

  const detectadosPorCP =
    useMemo(
      () =>
        auditoriaPDFs.filter(
          (item) =>
            item.metodo === "cp"
        ).length,
      [auditoriaPDFs]
    );

  const auditoriaOrdenada =
    useMemo(
      () =>
        [...auditoriaPDFs].sort(
          (a, b) => {
            if (
              a.metodo === "sin-detectar" &&
              b.metodo !== "sin-detectar"
            ) {
              return -1;
            }

            if (
              a.metodo !== "sin-detectar" &&
              b.metodo === "sin-detectar"
            ) {
              return 1;
            }

            return b.id - a.id;
          }
        ),
      [auditoriaPDFs]
    );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-100 via-white to-blue-50 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">

        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#061b48] via-[#073b88] to-[#00a7a7] px-6 py-10 text-white shadow-2xl ring-1 ring-blue-300/30 md:px-10 md:py-12">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="absolute -bottom-24 right-24 h-60 w-60 rounded-full bg-blue-300/20 blur-2xl" />

          <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-sm font-bold text-white shadow-sm backdrop-blur">
                Panel principal
              </span>

              <h1 className="mt-5 text-3xl font-black tracking-tight text-white md:text-5xl">
                Bienvenida, Viridiana
              </h1>

              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-cyan-50 md:text-lg">
                Consulta operaciones, envíos y cobertura nacional de VIPACK desde un solo lugar.
              </p>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-white/25 bg-white/15 p-4 shadow-lg backdrop-blur">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-300 text-emerald-950 shadow-md">
                <IconoEstado />
              </div>

              <div>
                <p className="text-sm font-semibold text-cyan-50">
                  Estado del sistema
                </p>

                <p className="font-black text-white">
                  Operando correctamente
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TarjetaResumen
            titulo="Bazares registrados"
            cantidad={
              cargando
                ? "..."
                : String(
                    totalBazares
                  )
            }
            descripcion="Total de registros"
            icono={<IconoUsuarios />}
            claseIcono="bg-blue-600 text-white"
            claseBorde="border-blue-200"
            claseFondo="bg-gradient-to-br from-white to-blue-50"
          />

          <TarjetaResumen
            titulo="Bazares activos"
            cantidad={
              cargando
                ? "..."
                : String(
                    bazaresActivos
                  )
            }
            descripcion="Aprobados actualmente"
            icono={<IconoActivo />}
            claseIcono="bg-emerald-600 text-white"
            claseBorde="border-emerald-200"
            claseFondo="bg-gradient-to-br from-white to-emerald-50"
          />

          <TarjetaResumen
            titulo="Estados con envíos"
            cantidad={
              cargandoEstados
                ? "..."
                : String(
                    estadosConPresencia
                  )
            }
            descripcion={`${cobertura}% de cobertura nacional`}
            icono={<IconoMapa />}
            claseIcono="bg-cyan-600 text-white"
            claseBorde="border-cyan-200"
            claseFondo="bg-gradient-to-br from-white to-cyan-50"
          />

          <TarjetaResumen
            titulo="Oportunidades"
            cantidad={
              cargandoEstados
                ? "..."
                : String(
                    estadosSinPresencia.length
                  )
            }
            descripcion="Estados sin destinos confirmados"
            icono={<IconoObjetivo />}
            claseIcono="bg-violet-600 text-white"
            claseBorde="border-violet-200"
            claseFondo="bg-gradient-to-br from-white to-violet-50"
          />
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-3xl border border-blue-200 bg-white p-6 shadow-lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">
                  Cobertura nacional
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Estados con más envíos
                </h2>

                <p className="mt-2 text-sm font-medium text-slate-600">
                  Los estados se detectan únicamente del bloque del destinatario en los PDFs de las guías.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Envíos detectados
                </p>

                <p className="text-2xl font-black text-slate-950">
                  {cargandoEstados
                    ? "..."
                    : totalEnviosConEstado}
                </p>
              </div>
            </div>

            <div className="mt-7 space-y-4">
              {cargandoEstados && (
                <div className="rounded-2xl bg-slate-50 p-8 text-center font-semibold text-slate-500">
                  Leyendo destinos de los PDFs...
                </div>
              )}

              {!cargandoEstados &&
                estadosConteo.length ===
                  0 && (
                  <div className="rounded-2xl bg-slate-50 p-8 text-center font-semibold text-slate-500">
                    Todavía no se detectaron estados en los PDFs guardados.
                  </div>
                )}

              {!cargandoEstados &&
                estadosConteo
                  .slice(0, 12)
                  .map(
                    (
                      item,
                      index
                    ) => {
                      const porcentaje =
                        Math.max(
                          4,
                          Math.round(
                            (item.envios /
                              maxEnvios) *
                              100
                          )
                        );

                      return (
                        <div
                          key={
                            item.estado
                          }
                        >
                          <div className="mb-2 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-700">
                                {index + 1}
                              </span>

                              <p className="font-black text-slate-800">
                                {
                                  item.estado
                                }
                              </p>
                            </div>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                              {item.envios}{" "}
                              {item.envios ===
                              1
                                ? "envío"
                                : "envíos"}
                            </span>
                          </div>

                          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all"
                              style={{
                                width: `${porcentaje}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
            </div>
          </article>

          <article className="rounded-3xl border border-violet-200 bg-gradient-to-br from-white to-violet-50 p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-violet-700">
                  Expansión
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Estados por conquistar
                </h2>

                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  Estados sin destinos confirmados en los PDFs procesados. La lista mejora conforme se identifican más guías.
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md">
                <IconoObjetivo />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-violet-200 bg-white p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">
                    Cobertura actual
                  </p>

                  <p className="mt-1 text-4xl font-black text-slate-950">
                    {cargandoEstados
                      ? "..."
                      : `${cobertura}%`}
                  </p>
                </div>

                <p className="text-right text-sm font-bold text-violet-700">
                  {estadosConPresencia} de 32 estados
                </p>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-violet-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500"
                  style={{
                    width: `${cobertura}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {cargandoEstados ? (
                <span className="text-sm font-semibold text-slate-500">
                  Calculando oportunidades...
                </span>
              ) : (
                estadosSinPresencia.map(
                  (estado) => (
                    <span
                      key={estado}
                      className="rounded-full border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-800 shadow-sm"
                    >
                      {estado}
                    </span>
                  )
                )
              )}
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-2">
          <article className="rounded-3xl border border-amber-200 bg-gradient-to-br from-white to-amber-50 p-6 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-700">
                  Seguimiento
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Pendientes
                </h2>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md">
                <IconoReloj />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-white p-4 shadow-sm">
                <div>
                  <p className="font-black text-slate-950">
                    Bazares por revisar
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-600">
                    Registros pendientes de aprobación
                  </p>
                </div>

                <span className="rounded-xl bg-amber-100 px-4 py-2 text-3xl font-black text-amber-800">
                  {cargando
                    ? "..."
                    : bazaresPendientes}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-blue-300 bg-white p-4 shadow-sm">
                <div>
                  <p className="font-black text-slate-950">
                    PDFs analizados
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-600">
                    Guías analizadas por destinatario
                  </p>
                </div>

                <span className="rounded-xl bg-blue-100 px-4 py-2 text-3xl font-black text-blue-800">
                  {cargandoEstados
                    ? "..."
                    : pdfsProcesados}
                </span>
              </div>

              {!cargandoEstados && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-black text-slate-950">
                    Diagnóstico de lectura
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-emerald-50 p-3">
                      <p className="text-2xl font-black text-emerald-800">
                        {detectadosPorTexto}
                      </p>
                      <p className="text-xs font-bold text-emerald-700">
                        Por texto
                      </p>
                    </div>

                    <div className="rounded-xl bg-blue-50 p-3">
                      <p className="text-2xl font-black text-blue-800">
                        {detectadosPorCP}
                      </p>
                      <p className="text-xs font-bold text-blue-700">
                        Por C.P.
                      </p>
                    </div>

                    <div className="rounded-xl bg-orange-50 p-3">
                      <p className="text-2xl font-black text-orange-800">
                        {pdfsSinEstado}
                      </p>
                      <p className="text-xs font-bold text-orange-700">
                        Sin detectar
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setMostrarAuditoria(
                        (actual) => !actual
                      )
                    }
                    className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
                  >
                    {mostrarAuditoria
                      ? "Ocultar auditoría"
                      : "Revisar PDFs y destinos"}
                  </button>
                </div>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">
                  Estrategia
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Lectura comercial
                </h2>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
                <IconoActividad />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <Actividad
                titulo="Mercados fuertes"
                descripcion={
                  estadosConteo.length > 0
                    ? `Tus destinos con mayor movimiento empiezan por ${estadosConteo
                        .slice(0, 3)
                        .map(
                          (item) =>
                            item.estado
                        )
                        .join(
                          ", "
                        )}.`
                    : "Se mostrarán cuando existan estados detectados."
                }
                hora="PDFs"
                clasePunto="bg-emerald-500"
                claseFondo="bg-emerald-50"
              />

              <Actividad
                titulo="Nuevos mercados"
                descripcion={
                  estadosSinPresencia.length > 0
                    ? `Hay ${estadosSinPresencia.length} estados sin envíos detectados que pueden usarse para campañas de captación.`
                    : "Ya existe presencia detectada en los 32 estados."
                }
                hora="Marketing"
                clasePunto="bg-violet-500"
                claseFondo="bg-violet-50"
              />

              <Actividad
                titulo="Fuente real"
                descripcion="La cobertura usa únicamente el destinatario: primero lee el estado escrito y, si falta, usa el código postal del mismo bloque."
                hora="Automático"
                clasePunto="bg-blue-500"
                claseFondo="bg-blue-50"
              />
            </div>
          </article>
        </section>

        {mostrarAuditoria && (
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">
                  Auditoría
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Revisión de PDFs y destinos
                </h2>

                <p className="mt-2 text-sm font-medium text-slate-600">
                  Los PDFs sin detectar aparecen primero para poder corregir formatos faltantes.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-100 px-4 py-3">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Total revisado
                </p>
                <p className="text-2xl font-black text-slate-950">
                  {auditoriaPDFs.length}
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Paquetería</th>
                    <th className="px-4 py-3">Estado destino</th>
                    <th className="px-4 py-3">Método</th>
                  </tr>
                </thead>

                <tbody>
                  {auditoriaOrdenada.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-3 font-bold text-slate-500">
                          {item.id}
                        </td>

                        <td className="px-4 py-3 font-bold text-slate-900">
                          {item.cliente}
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-600">
                          {item.paqueteria}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={
                              item.estado ===
                              "Sin detectar"
                                ? "rounded-full bg-orange-100 px-3 py-1 font-black text-orange-800"
                                : "rounded-full bg-emerald-100 px-3 py-1 font-black text-emerald-800"
                            }
                          >
                            {item.estado}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-600">
                          {item.metodo ===
                          "texto"
                            ? "Texto destinatario"
                            : item.metodo ===
                              "cp"
                            ? "Código postal"
                            : "Pendiente"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mt-8 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-cyan-50 p-6 shadow-lg">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">
                Estado general
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Servicios conectados
              </h2>

              <p className="mt-2 font-medium text-slate-700">
                Los módulos internos, Supabase y el análisis de PDFs están disponibles.
              </p>
            </div>

            <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-5 py-4 shadow-sm">
              <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.15)]" />

              <div>
                <p className="font-black text-emerald-800">
                  Sistema operativo
                </p>

                <p className="text-sm font-semibold text-emerald-600">
                  Sin incidencias detectadas
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 py-6 text-center text-sm font-medium text-slate-500">
          VIPACK Envíos · Sistema interno de administración y operaciones
        </footer>
      </div>
    </div>
  );
}

function TarjetaResumen({
  titulo,
  cantidad,
  descripcion,
  icono,
  claseIcono,
  claseBorde,
  claseFondo,
}: {
  titulo: string;
  cantidad: string;
  descripcion: string;
  icono: React.ReactNode;
  claseIcono: string;
  claseBorde: string;
  claseFondo: string;
}) {
  return (
    <article
      className={`rounded-3xl border ${claseBorde} ${claseFondo} p-5 shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-600">
            {titulo}
          </p>

          <p className="mt-3 text-4xl font-black text-slate-950">
            {cantidad}
          </p>

          <p className="mt-1 text-sm font-medium text-slate-500">
            {descripcion}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${claseIcono} shadow-md`}
        >
          {icono}
        </div>
      </div>
    </article>
  );
}

function Actividad({
  titulo,
  descripcion,
  hora,
  clasePunto,
  claseFondo,
}: {
  titulo: string;
  descripcion: string;
  hora: string;
  clasePunto: string;
  claseFondo: string;
}) {
  return (
    <div
      className={`flex items-start gap-4 rounded-2xl p-4 ${claseFondo}`}
    >
      <span
        className={`mt-2 h-3 w-3 shrink-0 rounded-full ${clasePunto}`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-black text-slate-950">
            {titulo}
          </p>

          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
            {hora}
          </span>
        </div>

        <p className="mt-1 text-sm font-medium text-slate-600">
          {descripcion}
        </p>
      </div>
    </div>
  );
}

function IconoEstado() {
  return (
    <IconoBase>
      <path d="m5 12 4 4L19 6" />
    </IconoBase>
  );
}

function IconoUsuarios() {
  return (
    <IconoBase>
      <circle
        cx="9"
        cy="8"
        r="3"
      />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5a3 3 0 0 1 0 6" />
      <path d="M18 14a5 5 0 0 1 3 6" />
    </IconoBase>
  );
}

function IconoActivo() {
  return (
    <IconoBase>
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path d="m8 12 3 3 5-6" />
    </IconoBase>
  );
}

function IconoReloj() {
  return (
    <IconoBase>
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path d="M12 7v5l3 2" />
    </IconoBase>
  );
}

function IconoMapa() {
  return (
    <IconoBase>
      <path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </IconoBase>
  );
}

function IconoObjetivo() {
  return (
    <IconoBase>
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <circle
        cx="12"
        cy="12"
        r="5"
      />
      <circle
        cx="12"
        cy="12"
        r="1"
      />
    </IconoBase>
  );
}

function IconoActividad() {
  return (
    <IconoBase>
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </IconoBase>
  );
}

function IconoBase({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}