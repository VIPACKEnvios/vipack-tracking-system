

import * as XLSX from "xlsx";
import {
  ChangeEvent,
  DragEvent,
  useMemo,
  useState,
} from "react";

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

type EstadoAnalisis =
  | "sin_archivo"
  | "analizando"
  | "listo"
  | "error";

type ResumenImportacion = {
  recibidos: number;
  nuevos: number;
  actualizados: number;
  omitidos: number;
  errores: number;
};

type DetalleImportacion = {
  nombre_bazar: string;
  resultado:
    | "nuevo"
    | "actualizado"
    | "omitido"
    | "error";
  mensaje: string;
};

type RespuestaImportacion = {
  success: boolean;
  resumen?: ResumenImportacion;
  detalles?: DetalleImportacion[];
  error?: string;
};

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
  const [archivo, setArchivo] =
    useState<File | null>(null);

  const [registros, setRegistros] =
    useState<RegistroBazar[]>([]);

  const [estadoAnalisis, setEstadoAnalisis] =
    useState<EstadoAnalisis>("sin_archivo");

  const [mensajeError, setMensajeError] =
    useState("");

  const [arrastrando, setArrastrando] =
    useState(false);

  const [importando, setImportando] =
    useState(false);

  const [
    resumenImportacion,
    setResumenImportacion,
  ] = useState<ResumenImportacion | null>(
    null
  );

  const [
    detallesImportacion,
    setDetallesImportacion,
  ] = useState<DetalleImportacion[]>([]);

  const [
    errorImportacion,
    setErrorImportacion,
  ] = useState("");

  const resumen = useMemo(() => {
    const completos = registros.filter(
      (registro) =>
        registro.nombre_bazar &&
        registro.nombre_responsable &&
        registro.telefono &&
        registro.direccion
    ).length;

    const incompletos =
      registros.length - completos;

    const nombresNormalizados = registros.map(
      (registro) =>
        normalizarTexto(registro.nombre_bazar)
    );

    const duplicados = nombresNormalizados.filter(
      (nombre, indice) =>
        nombre &&
        nombresNormalizados.indexOf(nombre) !==
          indice
    ).length;

    return {
      total: registros.length,
      completos,
      incompletos,
      duplicados,
    };
  }, [registros]);

  async function analizarArchivo(
    archivoSeleccionado: File
  ) {
    setArchivo(archivoSeleccionado);
    setEstadoAnalisis("analizando");
    setMensajeError("");
    setRegistros([]);
    setResumenImportacion(null);
    setDetallesImportacion([]);
    setErrorImportacion("");

    try {
      const extension =
        archivoSeleccionado.name
          .split(".")
          .pop()
          ?.toLowerCase();

      if (
        !extension ||
        !["xlsx", "xls", "csv"].includes(extension)
      ) {
        throw new Error(
          "Selecciona un archivo Excel o CSV válido."
        );
      }

      const contenido =
        await archivoSeleccionado.arrayBuffer();

      const libro = XLSX.read(contenido, {
        type: "array",
      });

      const primeraHoja =
        libro.SheetNames[0];

      if (!primeraHoja) {
        throw new Error(
          "El archivo no contiene hojas."
        );
      }

      const hoja =
        libro.Sheets[primeraHoja];

      const filas =
        XLSX.utils.sheet_to_json<
          Record<string, unknown>
        >(hoja, {
          defval: "",
          raw: false,
        });

      if (filas.length === 0) {
        throw new Error(
          "El archivo no contiene registros."
        );
      }

      const tieneColumnaBazar = Object.keys(
        filas[0]
      ).some((encabezado) =>
        ALIAS_COLUMNAS.nombre_bazar.some(
          (alias) =>
            normalizarEncabezado(encabezado) ===
            normalizarEncabezado(alias)
        )
      );

      if (!tieneColumnaBazar) {
        throw new Error(
          'No encontré la columna del nombre del bazar. Se acepta "nombre_bazar" o "Nombre del negocio o emprendimiento".'
        );
      }

      const registrosLimpios =
        filas
          .map(convertirRegistro)
          .filter(
            (registro) =>
              registro.nombre_bazar.trim()
                .length > 0
          );

      if (registrosLimpios.length === 0) {
        throw new Error(
          "No se encontraron bazares válidos."
        );
      }

      setRegistros(registrosLimpios);
      setEstadoAnalisis("listo");
    } catch (error) {
      console.error(
        "Error analizando archivo:",
        error
      );

      setEstadoAnalisis("error");

      setMensajeError(
        error instanceof Error
          ? error.message
          : "No fue posible analizar el archivo."
      );
    }
  }

  function seleccionarArchivo(
    evento: ChangeEvent<HTMLInputElement>
  ) {
    const archivoSeleccionado =
      evento.target.files?.[0];

    if (archivoSeleccionado) {
      analizarArchivo(archivoSeleccionado);
    }

    evento.target.value = "";
  }

  function soltarArchivo(
    evento: DragEvent<HTMLDivElement>
  ) {
    evento.preventDefault();
    setArrastrando(false);

    const archivoSeleccionado =
      evento.dataTransfer.files?.[0];

    if (archivoSeleccionado) {
      analizarArchivo(archivoSeleccionado);
    }
  }

  function limpiarArchivo() {
    setArchivo(null);
    setRegistros([]);
    setEstadoAnalisis("sin_archivo");
    setMensajeError("");
    setResumenImportacion(null);
    setDetallesImportacion([]);
    setErrorImportacion("");
  }

  async function iniciarImportacion() {
    if (
      importando ||
      registros.length === 0
    ) {
      return;
    }

    const confirmar = window.confirm(
      `Se importarán ${registros.length} bazares. Los existentes se actualizarán sin borrar sus documentos. ¿Deseas continuar?`
    );

    if (!confirmar) {
      return;
    }

    setImportando(true);
    setResumenImportacion(null);
    setDetallesImportacion([]);
    setErrorImportacion("");

    try {
      const respuesta = await fetch(
        "/api/importaciones/bazares",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            registros,
          }),
        }
      );

      const resultado: RespuestaImportacion =
        await respuesta.json();

      if (
        !respuesta.ok ||
        !resultado.success
      ) {
        throw new Error(
          resultado.error ||
            "No fue posible completar la importación."
        );
      }

      setResumenImportacion(
        resultado.resumen || null
      );

      setDetallesImportacion(
        resultado.detalles || []
      );
    } catch (error) {
      console.error(
        "Error importando bazares:",
        error
      );

      setErrorImportacion(
        error instanceof Error
          ? error.message
          : "No fue posible completar la importación."
      );
    } finally {
      setImportando(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-700">
            Herramientas
          </p>

          <h1 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">
            Importaciones
          </h1>

          <p className="mt-2 max-w-2xl text-slate-600">
            Importa registros al ERP, revisa la
            información y evita duplicados antes de
            guardarlos.
          </p>
        </header>

        <section className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Tipo de importación
            </p>

            <div className="mt-4 space-y-3">
              <button
                type="button"
                className="flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r from-[#072c74] to-cyan-700 p-4 text-left text-white shadow-lg"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl">
                  🏪
                </span>

                <div>
                  <p className="font-black">
                    Bazares
                  </p>

                  <p className="text-xs text-cyan-100">
                    Disponible
                  </p>
                </div>
              </button>

              <OpcionProximamente
                icono="🏷️"
                titulo="Tarifas"
              />
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">
                  Importar bazares
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Selecciona tu archivo
                </h2>

                <p className="mt-2 text-slate-600">
                  Puedes utilizar archivos Excel
                  `.xlsx`, `.xls` o `.csv`.
                </p>
              </div>

              <div
                onDragOver={(evento) => {
                  evento.preventDefault();
                  setArrastrando(true);
                }}
                onDragLeave={() =>
                  setArrastrando(false)
                }
                onDrop={soltarArchivo}
                className={`relative rounded-3xl border-2 border-dashed p-8 text-center transition md:p-12 ${
                  arrastrando
                    ? "border-cyan-500 bg-cyan-50"
                    : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50"
                }`}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 text-3xl text-white shadow-lg">
                  ↑
                </div>

                <p className="mt-5 text-xl font-black text-slate-900">
                  Arrastra tu archivo aquí
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  o selecciónalo desde tu computadora
                </p>

                <label className="mt-6 inline-flex cursor-pointer rounded-xl bg-[#072c74] px-6 py-3 font-bold text-white shadow-md transition hover:bg-blue-900">
                  Seleccionar archivo

                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={seleccionarArchivo}
                    className="hidden"
                  />
                </label>
              </div>

              {archivo && (
                <div className="mt-5 flex flex-col justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-black text-blue-950">
                      {archivo.name}
                    </p>

                    <p className="mt-1 text-sm text-blue-700">
                      {formatearTamano(
                        archivo.size
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={limpiarArchivo}
                    className="rounded-xl border border-red-200 bg-white px-4 py-2 font-bold text-red-700 hover:bg-red-50"
                  >
                    Quitar archivo
                  </button>
                </div>
              )}

              {estadoAnalisis ===
                "analizando" && (
                <div className="mt-5 rounded-2xl bg-amber-50 p-4 font-semibold text-amber-800">
                  Analizando archivo...
                </div>
              )}

              {estadoAnalisis === "error" && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
                  {mensajeError}
                </div>
              )}
            </section>

            {estadoAnalisis === "listo" && (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Resumen
                    titulo="Registros"
                    cantidad={resumen.total}
                    clase="border-blue-200 bg-blue-50 text-blue-800"
                  />

                  <Resumen
                    titulo="Completos"
                    cantidad={resumen.completos}
                    clase="border-emerald-200 bg-emerald-50 text-emerald-800"
                  />

                  <Resumen
                    titulo="Incompletos"
                    cantidad={resumen.incompletos}
                    clase="border-amber-200 bg-amber-50 text-amber-800"
                  />

                  <Resumen
                    titulo="Duplicados"
                    cantidad={resumen.duplicados}
                    clase="border-red-200 bg-red-50 text-red-800"
                  />
                </section>

                <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <header className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center">
                    <div>
                      <h2 className="text-xl font-black text-slate-950">
                        Vista previa
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Se muestran los primeros 50
                        registros.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={iniciarImportacion}
                      disabled={
                        registros.length === 0 ||
                        importando
                      }
                      className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 font-black text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {importando
                        ? "Importando bazares..."
                        : `Importar ${registros.length} bazares`}
                    </button>
                  </header>

                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-900 text-white">
                        <tr>
                          <th className="px-4 py-4 text-left">
                            #
                          </th>

                          <th className="px-4 py-4 text-left">
                            Bazar
                          </th>

                          <th className="px-4 py-4 text-left">
                            Responsable
                          </th>

                          <th className="px-4 py-4 text-left">
                            Teléfono
                          </th>

                          <th className="px-4 py-4 text-left">
                            Expediente
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {registros
                          .slice(0, 50)
                          .map(
                            (
                              registro,
                              indice
                            ) => {
                              const completo =
                                Boolean(
                                  registro.nombre_responsable &&
                                    registro.telefono &&
                                    registro.direccion
                                );

                              return (
                                <tr
                                  key={`${registro.nombre_bazar}-${indice}`}
                                  className="border-b border-slate-200 hover:bg-slate-50"
                                >
                                  <td className="px-4 py-4 text-sm text-slate-500">
                                    {indice + 1}
                                  </td>

                                  <td className="px-4 py-4 font-bold text-slate-900">
                                    {
                                      registro.nombre_bazar
                                    }
                                  </td>

                                  <td className="px-4 py-4 text-slate-700">
                                    {registro.nombre_responsable ||
                                      "Pendiente"}
                                  </td>

                                  <td className="px-4 py-4 text-slate-700">
                                    {registro.telefono ||
                                      "Pendiente"}
                                  </td>

                                  <td className="px-4 py-4">
                                    <span
                                      className={`rounded-full px-3 py-1 text-xs font-black ${
                                        completo
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-amber-100 text-amber-800"
                                      }`}
                                    >
                                      {completo
                                        ? "Completo"
                                        : "Pendiente"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            }
                          )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {errorImportacion && (
                  <section className="rounded-3xl border border-red-200 bg-red-50 p-6 font-semibold text-red-800">
                    {errorImportacion}
                  </section>
                )}

                {resumenImportacion && (
                  <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-black text-slate-950">
                      Importación terminada
                    </h2>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                      <Resumen
                        titulo="Recibidos"
                        cantidad={
                          resumenImportacion.recibidos
                        }
                        clase="border-blue-200 bg-blue-50 text-blue-800"
                      />

                      <Resumen
                        titulo="Nuevos"
                        cantidad={
                          resumenImportacion.nuevos
                        }
                        clase="border-emerald-200 bg-emerald-50 text-emerald-800"
                      />

                      <Resumen
                        titulo="Actualizados"
                        cantidad={
                          resumenImportacion.actualizados
                        }
                        clase="border-cyan-200 bg-cyan-50 text-cyan-800"
                      />

                      <Resumen
                        titulo="Omitidos"
                        cantidad={
                          resumenImportacion.omitidos
                        }
                        clase="border-amber-200 bg-amber-50 text-amber-800"
                      />

                      <Resumen
                        titulo="Errores"
                        cantidad={
                          resumenImportacion.errores
                        }
                        clase="border-red-200 bg-red-50 text-red-800"
                      />
                    </div>

                    <div className="mt-6 max-h-96 overflow-y-auto rounded-2xl border border-slate-200">
                      {detallesImportacion.map(
                        (detalle, indice) => (
                          <div
                            key={`${detalle.nombre_bazar}-${indice}`}
                            className="flex flex-col justify-between gap-2 border-b border-slate-200 p-4 last:border-b-0 sm:flex-row sm:items-center"
                          >
                            <div>
                              <p className="font-black text-slate-900">
                                {
                                  detalle.nombre_bazar
                                }
                              </p>

                              <p className="mt-1 text-sm text-slate-500">
                                {detalle.mensaje}
                              </p>
                            </div>

                            <ResultadoBadge
                              resultado={
                                detalle.resultado
                              }
                            />
                          </div>
                        )
                      )}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
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
      obtenerValorCampo(fila, "estado") ||
      "activo",

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

function Resumen({
  titulo,
  cantidad,
  clase,
}: {
  titulo: string;
  cantidad: number;
  clase: string;
}) {
  return (
    <article
      className={`rounded-2xl border p-5 shadow-sm ${clase}`}
    >
      <p className="text-sm font-bold">
        {titulo}
      </p>

      <p className="mt-2 text-3xl font-black">
        {cantidad}
      </p>
    </article>
  );
}

function OpcionProximamente({
  icono,
  titulo,
}: {
  icono: string;
  titulo: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-400">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200 text-xl">
        {icono}
      </span>

      <div className="flex-1">
        <p className="font-bold">
          {titulo}
        </p>

        <p className="text-xs">
          Próximamente
        </p>
      </div>
    </div>
  );
}

function ResultadoBadge({
  resultado,
}: {
  resultado: DetalleImportacion["resultado"];
}) {
  const estilos: Record<
    DetalleImportacion["resultado"],
    string
  > = {
    nuevo:
      "bg-emerald-100 text-emerald-800",
    actualizado:
      "bg-cyan-100 text-cyan-800",
    omitido:
      "bg-amber-100 text-amber-800",
    error:
      "bg-red-100 text-red-800",
  };

  const etiquetas: Record<
    DetalleImportacion["resultado"],
    string
  > = {
    nuevo: "Nuevo",
    actualizado: "Actualizado",
    omitido: "Omitido",
    error: "Error",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${estilos[resultado]}`}
    >
      {etiquetas[resultado]}
    </span>
  );
}