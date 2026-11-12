"use client";

import * as XLSX from "xlsx";
import { useState, useRef, type ChangeEvent, type DragEvent } from "react";

type RegistroBazar = {
  nombre_responsable: string;
  telefono: string;
  direccion: string;
  nombre_bazar: string;
  correo: string;
  productos: string;
  facebook: string;
  referencia_1_nombre: string;
  referencia_1_telefono: string;
  referencia_2_nombre: string;
  referencia_2_telefono: string;
  estado: string;
  observaciones: string;
};
type Resultado = "nuevo" | "omitido" | "revision" | "incompleto" | "error";
type Detalle = { fila: number; nombre_bazar: string; resultado: Resultado; mensaje: string };
type ResumenDatos = {
  recibidos: number;
  nuevos: number;
  actualizados: number;
  omitidos: number;
  revision: number;
  incompletos: number;
  errores: number;
};
type Respuesta = { success: boolean; accion?: "analizar" | "importar"; resumen?: ResumenDatos; detalles?: Detalle[]; error?: string };
type Fase = "vacio" | "leyendo" | "analizando" | "listo" | "importando" | "terminado" | "error";

const ALIAS_COLUMNAS: Record<keyof RegistroBazar, string[]> = {
  nombre_responsable: [
    "nombre_responsable",
    "nombre completo",
    "nombre",
    "responsable",
  ],
  telefono: [
    "telefono",
    "número de teléfono",
    "numero de telefono",
    "teléfono",
    "celular",
  ],
  direccion: [
    "direccion",
    "dirección",
    "dirección completa",
    "direccion completa",
  ],
  nombre_bazar: [
    "nombre_bazar",
    "nombre del negocio o emprendimiento",
    "nombre del negocio",
    "negocio",
    "bazar",
  ],
  correo: [
    "correo",
    "correo electrónico1",
    "correo electronico1",
    "correo electrónico",
    "correo electronico",
    "email",
  ],
  productos: [
    "productos",
    "¿qué productos vende?",
    "que productos vende",
  ],
  facebook: [
    "facebook",
    "facebook del negocio",
  ],
  referencia_1_nombre: [
    "referencia_1_nombre",
    "1era referencia nombre",
  ],
  referencia_1_telefono: [
    "referencia_1_telefono",
    "1era referencia telefono",
  ],
  referencia_2_nombre: [
    "referencia_2_nombre",
    "2da referencia nombre",
  ],
  referencia_2_telefono: [
    "referencia_2_telefono",
    "2da referencia telefono",
  ],
  estado: [
    "estado",
    "estatus",
  ],
  observaciones: [
    "observaciones",
    "notas",
  ],
};

const ENCABEZADOS_REFERENCIA_1 = [
  "por favor, proporciona 1era referencia personales o comerciales. (nombre y núm. de teléfono)",
  "por favor proporciona 1era referencia personales o comerciales nombre y num de telefono",
];

const ENCABEZADOS_REFERENCIA_2 = [
  "por favor, proporciona 2da referencia personales o comerciales. (nombre y núm. de teléfono)",
  "por favor proporciona 2da referencia personales o comerciales nombre y num de telefono",
];


export default function ImportacionesPage() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [registros, setRegistros] = useState<RegistroBazar[]>([]);
  const [fase, setFase] = useState<Fase>("vacio");
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [analisis, setAnalisis] = useState<Respuesta | null>(null);
  const [resultado, setResultado] = useState<Respuesta | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const solicitudActual = useRef(0);

  async function consultar(accion: "analizar" | "importar", filas: RegistroBazar[]): Promise<Respuesta> {
    const respuesta = await fetch("/api/importaciones/bazares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ accion, registros: filas }),
    });
    const datos = (await respuesta.json()) as Respuesta;
    if (!respuesta.ok || !datos.success || !datos.resumen || !Array.isArray(datos.detalles)) {
      throw new Error(datos.error || "No fue posible consultar la importación.");
    }
    return datos;
  }

  async function cargarArchivo(seleccionado: File) {
    const id = ++solicitudActual.current;
    setArchivo(seleccionado);
    setRegistros([]);
    setAnalisis(null);
    setResultado(null);
    setConfirmar(false);
    setError("");
    setFase("leyendo");
    try {
      const extension = seleccionado.name.split(".").pop()?.toLowerCase();
      if (!extension || !["xlsx", "xls", "csv"].includes(extension)) {
        throw new Error("Selecciona un archivo .xlsx, .xls o .csv.");
      }
      if (seleccionado.size > 10 * 1024 * 1024) {
        throw new Error("El archivo no debe superar 10 MB.");
      }
      const libro = XLSX.read(await seleccionado.arrayBuffer(), { type: "array" });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      if (!hoja) throw new Error("El archivo no contiene hojas de cálculo.");
      const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: "", raw: false });
      if (!filas.length) throw new Error("El archivo está vacío.");
      if (!Object.keys(filas[0]).some((encabezado) =>
        ALIAS_COLUMNAS.nombre_bazar.some((alias) => normalizarEncabezado(alias) === normalizarEncabezado(encabezado))
      )) throw new Error("No encontré la columna 'nombre_bazar' o 'Nombre del negocio o emprendimiento'.");
      if (filas.length > 500) throw new Error("Esta versión admite hasta 500 filas por archivo. Divide el Excel antes de continuar.");
      // No se eliminan filas sin nombre: la API debe mostrarlas como incompletas.
      const limpios = filas.map(convertirRegistro);
      if (id !== solicitudActual.current) return;
      setRegistros(limpios);
      setFase("analizando");
      const datos = await consultar("analizar", limpios);
      if (id !== solicitudActual.current) return;
      setAnalisis(datos);
      setFase("listo");
    } catch (e) {
      if (id !== solicitudActual.current) return;
      setError(e instanceof Error ? e.message : "No se pudo analizar el archivo.");
      setFase("error");
    }
  }

  function seleccionarArchivo(e: ChangeEvent<HTMLInputElement>) {
    const seleccionado = e.target.files?.[0];
    e.target.value = "";
    if (seleccionado && !ocupado) void cargarArchivo(seleccionado);
  }
  function soltarArchivo(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastrando(false);
    const seleccionado = e.dataTransfer.files?.[0];
    if (seleccionado && !ocupado) void cargarArchivo(seleccionado);
  }
  function limpiar() {
    ++solicitudActual.current;
    setArchivo(null); setRegistros([]); setAnalisis(null); setResultado(null);
    setConfirmar(false); setError(""); setFase("vacio");
  }
  async function importar() {
    if (fase !== "listo" || !confirmar || !analisis?.resumen?.nuevos) return;
    setFase("importando");
    setError("");
    try {
      // El servidor vuelve a comparar cada fila antes de intentar insertarla.
      const datos = await consultar("importar", registros);
      setResultado(datos);
      setFase("terminado");
      setConfirmar(false);
    } catch (e) {
      // Ante un error de red no se puede asegurar si hubo inserciones parciales.
      setError((e instanceof Error ? e.message : "Error desconocido") + " No vuelvas a importar sin analizar de nuevo el archivo y revisar los registros guardados.");
      setFase("error");
      setConfirmar(false);
    }
  }

  const ocupado = fase === "leyendo" || fase === "analizando" || fase === "importando";
  const vista = resultado ?? analisis;
  const detalles = vista?.detalles ?? [];
  const resumen = vista?.resumen;
  const estilos: Record<Resultado, string> = {
    nuevo: "bg-emerald-100 text-emerald-900",
    omitido: "bg-slate-200 text-slate-800",
    revision: "bg-orange-100 text-orange-900",
    incompleto: "bg-amber-100 text-amber-900",
    error: "bg-red-100 text-red-900",
  };
  const etiquetas: Record<Resultado, string> = {
    nuevo: resultado ? "Importado" : "Nuevo",
    omitido: "Existente / omitido",
    revision: "Revisión manual",
    incompleto: "Incompleto",
    error: "Error",
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-100 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-r from-[#08245b] via-[#183c86] to-[#52338f] p-7 text-white shadow-lg md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">VIPACK ENVÍOS · Herramientas ERP</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">Importación segura de bazares</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100 md:text-base">Compara los registros del Excel con Supabase antes de guardarlos. Los bazares existentes nunca se actualizan desde esta herramienta.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Tipo de importación</p>
            <div className="mt-4 rounded-2xl bg-[#092f77] p-4 text-white">
              <p className="text-lg font-black">🏪 Bazares</p>
              <p className="mt-1 text-sm text-cyan-100">Registro de nuevos bazares</p>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <p className="font-extrabold">Protecciones</p>
              <p>✓ Vista previa contra la base de datos</p>
              <p>✓ Sin actualizaciones de existentes</p>
              <p>✓ Nuevos con estado pendiente</p>
              <p>✓ Coincidencias dudosas para revisión</p>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Las importaciones simultáneas todavía requieren protección transaccional en Supabase. Evita ejecutarlas desde dos sesiones a la vez.</p>
          </aside>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <h2 className="text-xl font-black">1. Selecciona tu archivo</h2>
              <p className="mt-2 text-sm text-slate-600">Excel (.xlsx, .xls) o CSV · máximo 500 filas y 10 MB.</p>
              <div onDragOver={(e) => { e.preventDefault(); if (!ocupado) setArrastrando(true); }} onDragLeave={() => setArrastrando(false)} onDrop={soltarArchivo}
                className={`mt-5 rounded-2xl border-2 border-dashed p-8 text-center ${arrastrando ? "border-cyan-500 bg-cyan-50" : "border-slate-300 bg-slate-50"}`}>
                <div className="text-4xl">📄</div>
                <p className="mt-3 font-bold">Arrastra el archivo aquí o selecciónalo</p>
                <label className={`mt-4 inline-flex rounded-xl bg-[#092f77] px-6 py-3 text-sm font-extrabold text-white ${ocupado ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-blue-900"}`}>
                  Seleccionar archivo
                  <input className="hidden" type="file" accept=".xlsx,.xls,.csv" disabled={ocupado} onChange={seleccionarArchivo} />
                </label>
              </div>
              {archivo && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-50 p-4">
                <div><p className="break-all font-bold text-blue-950">{archivo.name}</p><p className="text-xs text-blue-800">{formatearTamano(archivo.size)}</p></div>
                <button type="button" disabled={ocupado} onClick={limpiar} className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-900 disabled:opacity-50">Quitar archivo</button>
              </div>}
              {ocupado && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 font-semibold text-amber-900">{fase === "leyendo" ? "Leyendo Excel…" : fase === "analizando" ? "Comparando con los bazares registrados…" : "Importando y verificando cada registro…"}</p>}
              {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">{error}</p>}
            </section>

            {resumen && <>
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black">{resultado ? "3. Resultado de importación" : "2. Resultado del análisis"}</h2>
                <p className="mt-2 text-sm text-slate-600">{resultado ? "Resultados informados por el servidor. Los errores deben revisarse manualmente." : "Clasificación basada en la base de datos actual. Se verificará nuevamente al importar."}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  <Tarjeta titulo="Filas" valor={resumen.recibidos} clase="bg-blue-50 text-blue-900" />
                  <Tarjeta titulo={resultado ? "Importados" : "Nuevos"} valor={resumen.nuevos} clase="bg-emerald-50 text-emerald-900" />
                  <Tarjeta titulo="Existentes" valor={resumen.omitidos} clase="bg-slate-100 text-slate-900" />
                  <Tarjeta titulo="Revisar" valor={resumen.revision} clase="bg-orange-50 text-orange-900" />
                  <Tarjeta titulo="Incompletos" valor={resumen.incompletos} clase="bg-amber-50 text-amber-900" />
                  <Tarjeta titulo="Errores" valor={resumen.errores} clase="bg-red-50 text-red-900" />
                </div>
                {!resultado && fase === "listo" && <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <p className="font-extrabold text-blue-950">Solo se intentarán guardar los {resumen.nuevos} registros clasificados como nuevos.</p>
                  <p className="mt-1 text-sm text-blue-900">Los existentes, incompletos y coincidencias dudosas no se importarán. Ningún registro existente será modificado.</p>
                  <label className="mt-4 flex items-start gap-3 text-sm font-semibold text-blue-950">
                    <input type="checkbox" className="mt-1 h-4 w-4" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} />
                    He revisado la vista previa y autorizo importar únicamente los nuevos.
                  </label>
                  <button type="button" onClick={() => void importar()} disabled={!confirmar || resumen.nuevos === 0} className="mt-4 rounded-xl bg-emerald-700 px-6 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Importar {resumen.nuevos} nuevos</button>
                </div>}
                {resultado && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 font-bold text-emerald-900">Operación finalizada. Para otra importación, selecciona un archivo nuevo.</p>}
              </section>

              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-5"><h2 className="text-xl font-black">Detalle por fila</h2><p className="mt-1 text-sm text-slate-600">Se muestran todas las {detalles.length} filas analizadas, incluidas las incompletas.</p></div>
                <div className="max-h-[560px] overflow-auto">
                  <table className="min-w-[860px] w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-900 text-white"><tr><th className="p-4">Fila</th><th className="p-4">Bazar</th><th className="p-4">Responsable</th><th className="p-4">Teléfono</th><th className="p-4">Clasificación</th><th className="p-4">Detalle</th></tr></thead>
                    <tbody>{detalles.map((detalle, i) => {
                      const registro = registros[detalle.fila - 1];
                      return <tr key={`${detalle.fila}-${i}`} className="border-b border-slate-100 align-top hover:bg-slate-50">
                        <td className="p-4 text-slate-500">{detalle.fila}</td>
                        <td className="p-4 font-extrabold">{detalle.nombre_bazar}</td>
                        <td className="p-4">{registro?.nombre_responsable || "—"}</td>
                        <td className="p-4">{registro?.telefono || "—"}</td>
                        <td className="p-4"><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-black ${estilos[detalle.resultado]}`}>{etiquetas[detalle.resultado]}</span></td>
                        <td className="p-4 text-slate-600">{detalle.mensaje}</td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>
              </section>
            </>}
          </div>
        </div>
      </div>
    </main>
  );
}

function Tarjeta({ titulo, valor, clase }: { titulo: string; valor: number; clase: string }) {
  return <div className={`rounded-2xl p-4 ${clase}`}><p className="text-xs font-extrabold">{titulo}</p><p className="mt-2 text-3xl font-black">{valor}</p></div>;
}

function convertirRegistro(
  fila: Record<string, unknown>
): RegistroBazar {
  const referencia1 = obtenerValorPorAlias(
    fila,
    ENCABEZADOS_REFERENCIA_1
  );

  const referencia2 = obtenerValorPorAlias(
    fila,
    ENCABEZADOS_REFERENCIA_2
  );

  const referencia1Separada =
    separarReferencia(referencia1);

  const referencia2Separada =
    separarReferencia(referencia2);

  return {
    nombre_responsable: obtenerValorCampo(
      fila,
      "nombre_responsable"
    ),

    telefono: limpiarTelefono(
      obtenerValorCampo(fila, "telefono")
    ),

    direccion: obtenerValorCampo(
      fila,
      "direccion"
    ),

    nombre_bazar: obtenerValorCampo(
      fila,
      "nombre_bazar"
    ),

    correo: obtenerValorCampo(
      fila,
      "correo"
    ).toLowerCase(),

    productos: obtenerValorCampo(
      fila,
      "productos"
    ),

    facebook: obtenerValorCampo(
      fila,
      "facebook"
    ),

    referencia_1_nombre:
      obtenerValorCampo(
        fila,
        "referencia_1_nombre"
      ) || referencia1Separada.nombre,

    referencia_1_telefono:
      limpiarTelefono(
        obtenerValorCampo(
          fila,
          "referencia_1_telefono"
        ) || referencia1Separada.telefono
      ),

    referencia_2_nombre:
      obtenerValorCampo(
        fila,
        "referencia_2_nombre"
      ) || referencia2Separada.nombre,

    referencia_2_telefono:
      limpiarTelefono(
        obtenerValorCampo(
          fila,
          "referencia_2_telefono"
        ) || referencia2Separada.telefono
      ),

    estado:
      "pendiente",

    observaciones: obtenerValorCampo(
      fila,
      "observaciones"
    ),
  };
}

function obtenerValorCampo(
  fila: Record<string, unknown>,
  campo: keyof RegistroBazar
) {
  return obtenerValorPorAlias(
    fila,
    ALIAS_COLUMNAS[campo]
  );
}

function obtenerValorPorAlias(
  fila: Record<string, unknown>,
  aliases: string[]
) {
  const entradas = Object.entries(fila);

  for (const alias of aliases) {
    const aliasNormalizado =
      normalizarEncabezado(alias);

    const coincidencia = entradas.find(
      ([encabezado]) =>
        normalizarEncabezado(encabezado) ===
        aliasNormalizado
    );

    if (coincidencia) {
      return limpiarValor(coincidencia[1]);
    }
  }

  return "";
}

function separarReferencia(valor: string) {
  const limpio = limpiarValor(valor);

  if (!limpio) {
    return {
      nombre: "",
      telefono: "",
    };
  }

  const telefonos =
    limpio.match(/\+?\d[\d\s().-]{6,}\d/g) ||
    [];

  const telefono = telefonos[0]
    ? limpiarTelefono(telefonos[0])
    : "";

  const nombre = limpiarValor(
    telefonos[0]
      ? limpio.replace(telefonos[0], "")
      : limpio
  )
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "");

  return {
    nombre,
    telefono,
  };
}

function normalizarEncabezado(valor: string) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u00a0]/g, " ")
    .replace(/[¿?]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function limpiarValor(valor: unknown) {
  return String(valor ?? "").trim();
}

function limpiarTelefono(valor: unknown) {
  return String(valor ?? "")
    .replace(/\D/g, "")
    .trim();
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function formatearTamano(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}