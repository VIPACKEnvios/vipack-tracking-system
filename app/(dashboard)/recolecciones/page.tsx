"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Estado =
  | "Pendiente"
  | "En ruta"
  | "Recolectada"
  | "No lista"
  | "Reprogramada"
  | "Cancelada"
  | string;

type RegistroExcel = {
  Folio?: unknown;
  "Fecha de solicitud"?: unknown;
  Cliente?: unknown;
  TelefonoWhatsApp?: unknown;
  "Lugar / Bodega de recolección"?: unknown;
  "Orden ruta"?: unknown;
  "Dirección de recolección"?: unknown;
  "Nota de recolección"?: unknown;
  Mercancía?: unknown;
  "Cantidad / Bultos"?: unknown;
  "Fecha de recolección"?: unknown;
  "Hora de cita"?: unknown;
  Estatus?: unknown;
  Observaciones?: unknown;
  "Foto mercancía"?: unknown;
};

type Recoleccion = {
  folio: string;
  fechaSolicitud: string;
  cliente: string;
  telefono: string;
  bodega: string;
  ordenRuta: string;
  direccion: string;
  nota: string;
  mercancia: string;
  cantidad: string;
  fechaRecoleccion: string;
  horaCita: string;
  estado: Estado;
  observaciones: string;
  foto: string;
};

type ClienteOption = {
  nombre: string;
  telefono: string;
};

type RespuestaApi = {
  success: boolean;
  registros?: RegistroExcel[];
  error?: string;
};

type EvidenciaArchivo = {
  id: string;
  nombre: string;
  tamaño: number;
  webUrl: string | null;
  modificado: string | null;
};

type RespuestaEvidencias = {
  success: boolean;
  folio?: string;
  resumen?: {
    notas: number;
    fotos: number;
    total: number;
  };
  notas?: EvidenciaArchivo[];
  fotos?: EvidenciaArchivo[];
  error?: string;
};

type VistaMovil =
  | "Solicitudes"
  | "Recolectadas";

type FiltroDesktop =
  | "Activas"
  | "Pendiente"
  | "En ruta"
  | "No lista"
  | "Reprogramada"
  | "Sin ruta"
  | "Recolectada"
  | "Problemas"
  | "Cancelada"
  | "Todas";

type FiltroMovil =
  | "Activas"
  | "Pendiente"
  | "En ruta"
  | "No lista"
  | "Reprogramada"
  | "Sin ruta";

type ResumenEvidenciaFila = {
  notas: number;
  fotos: number;
  cargado: boolean;
};

type EditorOperacion = {
  item: Recoleccion;
  tipo:
    | "ruta"
    | "estado"
    | "cita";
};

const ESTADOS_RECOLECCION: Estado[] = [
  "Pendiente",
  "En ruta",
  "Recolectada",
  "No lista",
  "Reprogramada",
  "Cancelada",
];

function txt(valor: unknown) {
  return String(
    valor ?? ""
  ).trim();
}

function normalizarEstado(
  valor: unknown
): Estado {
  const original = txt(valor);

  const estado =
    original.toLocaleLowerCase("es");

  if (!estado) {
    return "Pendiente";
  }

  if (estado === "pendiente") {
    return "Pendiente";
  }

  if (estado === "en ruta") {
    return "En ruta";
  }

  if (estado === "recolectada") {
    return "Recolectada";
  }

  if (estado === "no lista") {
    return "No lista";
  }

  if (estado === "reprogramada") {
    return "Reprogramada";
  }

  if (estado === "cancelada") {
    return "Cancelada";
  }

  return original;
}

function convertirRegistro(
  fila: RegistroExcel
): Recoleccion {
  return {
    folio:
      txt(fila.Folio),

    fechaSolicitud:
      txt(
        fila[
          "Fecha de solicitud"
        ]
      ),

    cliente:
      txt(fila.Cliente),

    telefono:
      txt(
        fila.TelefonoWhatsApp
      ),

    bodega:
      txt(
        fila[
          "Lugar / Bodega de recolección"
        ]
      ),

    ordenRuta:
      txt(
        fila["Orden ruta"]
      ),

    direccion:
      txt(
        fila[
          "Dirección de recolección"
        ]
      ),

    nota:
      txt(
        fila[
          "Nota de recolección"
        ]
      ),

    mercancia:
      txt(
        fila.Mercancía
      ),

    cantidad:
      txt(
        fila[
          "Cantidad / Bultos"
        ]
      ),

    fechaRecoleccion:
      txt(
        fila[
          "Fecha de recolección"
        ]
      ),

    horaCita:
      txt(
        fila[
          "Hora de cita"
        ]
      ),

    estado:
      normalizarEstado(
        fila.Estatus
      ),

    observaciones:
      txt(
        fila.Observaciones
      ),

    foto:
      txt(
        fila[
          "Foto mercancía"
        ]
      ),
  };
}

function esProblema(
  estado: Estado
) {
  return (
    estado === "No lista" ||
    estado === "Reprogramada"
  );
}

function esActiva(
  estado: Estado
) {
  return (
    estado === "Pendiente" ||
    estado === "En ruta" ||
    estado === "No lista" ||
    estado === "Reprogramada"
  );
}

function formatoFecha(
  fecha: string
) {
  if (!fecha) {
    return "Sin fecha";
  }

  const soloFecha =
    fecha.split(" ")[0];

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      soloFecha
    )
  ) {
    const [
      anio,
      mes,
      dia,
    ] =
      soloFecha.split("-");

    return `${dia}/${mes}/${anio}`;
  }

  const partes =
    soloFecha.split("/");

  if (
    partes.length !== 3
  ) {
    return fecha;
  }

  const mes =
    partes[0].padStart(
      2,
      "0"
    );

  const dia =
    partes[1].padStart(
      2,
      "0"
    );

  let anio =
    partes[2];

  if (
    anio.length === 2
  ) {
    anio =
      `20${anio}`;
  }

  return `${dia}/${mes}/${anio}`;
}

function fechaParaInput(
  fecha: string
) {
  if (!fecha) {
    return "";
  }

  const soloFecha =
    fecha.split(" ")[0];

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      soloFecha
    )
  ) {
    return soloFecha;
  }

  const partes =
    soloFecha.split("/");

  if (
    partes.length !== 3
  ) {
    return "";
  }

  const mes =
    partes[0].padStart(
      2,
      "0"
    );

  const dia =
    partes[1].padStart(
      2,
      "0"
    );

  let anio =
    partes[2];

  if (
    anio.length === 2
  ) {
    anio =
      `20${anio}`;
  }

  return `${anio}-${mes}-${dia}`;
}

function formatoHora(
  hora: string
) {
  if (!hora) {
    return "Sin hora";
  }

  const match =
    hora.match(
      /^(\d{1,2}):(\d{2})/
    );

  if (!match) {
    return hora;
  }

  const h =
    Number(match[1]);

  const periodo =
    h >= 12
      ? "PM"
      : "AM";

  return `${h % 12 || 12}:${match[2]} ${periodo}`;
}


function numeroRuta(
  valor: string
) {
  const numero =
    Number(
      valor
        .trim()
        .replace(
          /[^0-9.-]/g,
          ""
        )
    );

  return Number.isFinite(
    numero
  )
    ? numero
    : null;
}

function compararPorRutaYFecha(
  a: Recoleccion,
  b: Recoleccion
) {
  const rutaA =
    numeroRuta(
      a.ordenRuta
    );

  const rutaB =
    numeroRuta(
      b.ordenRuta
    );

  if (
    rutaA !== null &&
    rutaB !== null
  ) {
    return rutaB - rutaA;
  }

  if (
    rutaA !== null
  ) {
    return -1;
  }

  if (
    rutaB !== null
  ) {
    return 1;
  }

  return b.fechaSolicitud
    .localeCompare(
      a.fechaSolicitud
    );
}

function urlMapa(
  direccion: string
) {
  const valor =
    direccion.trim();

  if (!valor) {
    return "";
  }

  if (
    /^https?:\/\//i.test(
      valor
    )
  ) {
    return valor;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    valor
  )}`;
}

function urlWhatsApp(
  telefono: string
) {
  const limpio =
    telefono.replace(
      /\D/g,
      ""
    );

  if (!limpio) {
    return "";
  }

  return `https://wa.me/${limpio}`;
}

export default function RecoleccionesPage() {
  const [
    recolecciones,
    setRecolecciones,
  ] = useState<
    Recoleccion[]
  >([]);

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    actualizando,
    setActualizando,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    filtroDesktop,
    setFiltroDesktop,
  ] =
    useState<FiltroDesktop>(
      "Activas"
    );

  const [
    vistaMovil,
    setVistaMovil,
  ] =
    useState<VistaMovil>(
      "Solicitudes"
    );

  const [
    seleccionada,
    setSeleccionada,
  ] =
    useState<Recoleccion | null>(
      null
    );

  const [
    modalNueva,
    setModalNueva,
  ] = useState(false);

  const [
    filtroMovil,
    setFiltroMovil,
  ] =
    useState<FiltroMovil>(
      "Activas"
    );

  const [
    resumenEvidencias,
    setResumenEvidencias,
  ] = useState<
    Record<
      string,
      ResumenEvidenciaFila
    >
  >({});

  const [
    editorOperacion,
    setEditorOperacion,
  ] = useState<
    EditorOperacion | null
  >(null);


  const aplicarActualizacionLocal =
    useCallback(
      (
        folio: string,
        cambios: {
          ordenRuta?: string;
          estado?: Estado;
          fechaRecoleccion?: string;
          horaCita?: string;
        }
      ) => {
        setRecolecciones(
          (actuales) =>
            actuales.map(
              (registro) =>
                registro.folio ===
                folio
                  ? {
                      ...registro,
                      ...(cambios.ordenRuta !==
                      undefined
                        ? {
                            ordenRuta:
                              cambios.ordenRuta,
                          }
                        : {}),
                      ...(cambios.estado !==
                      undefined
                        ? {
                            estado:
                              cambios.estado,
                          }
                        : {}),
                      ...(cambios.fechaRecoleccion !==
                      undefined
                        ? {
                            fechaRecoleccion:
                              cambios.fechaRecoleccion,
                          }
                        : {}),
                      ...(cambios.horaCita !==
                      undefined
                        ? {
                            horaCita:
                              cambios.horaCita,
                          }
                        : {}),
                    }
                  : registro
            )
        );

        setSeleccionada(
          (actual) =>
            actual?.folio ===
            folio
              ? {
                  ...actual,
                  ...(cambios.ordenRuta !==
                  undefined
                    ? {
                        ordenRuta:
                          cambios.ordenRuta,
                      }
                    : {}),
                  ...(cambios.estado !==
                  undefined
                    ? {
                        estado:
                          cambios.estado,
                      }
                    : {}),
                  ...(cambios.fechaRecoleccion !==
                  undefined
                    ? {
                        fechaRecoleccion:
                          cambios.fechaRecoleccion,
                      }
                    : {}),
                  ...(cambios.horaCita !==
                  undefined
                    ? {
                        horaCita:
                          cambios.horaCita,
                      }
                    : {}),
                }
              : actual
        );
      },
      []
    );

  const cargar =
    useCallback(
      async (
        silencioso = false
      ) => {
        try {
          if (silencioso) {
            setActualizando(
              true
            );
          } else {
            setCargando(
              true
            );
          }

          setError("");

          const [
            response,
            eliminadasResponse,
          ] =
            await Promise.all([
              fetch(
                "/api/recolecciones",
                {
                  cache:
                    "no-store",
                }
              ),

              fetch(
                "/api/recolecciones/eliminadas",
                {
                  cache:
                    "no-store",
                }
              ),
            ]);

          const data =
            (await response.json()) as RespuestaApi;

          const eliminadasData =
            (await eliminadasResponse.json()) as {
              success?: boolean;
              folios?: string[];
              error?: string;
            };

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.error ||
                "No se pudieron cargar las recolecciones."
            );
          }

          if (
            !eliminadasResponse.ok ||
            !eliminadasData.success
          ) {
            throw new Error(
              eliminadasData.error ||
                "No se pudo consultar la lista de recolecciones eliminadas."
            );
          }

          const eliminados =
            new Set(
              Array.isArray(
                eliminadasData.folios
              )
                ? eliminadasData.folios
                : []
            );


          const filas =
            Array.isArray(
              data.registros
            )
              ? data.registros
              : [];

          const registros =
            filas
              .map(
                convertirRegistro
              )
              .filter(
                (item) =>
                  item.folio ||
                  item.cliente
              );

          setRecolecciones(
            registros.filter(
              (registro) =>
                !eliminados.has(
                  registro.folio
                )
            )
          );
        } catch (
          e: unknown
        ) {
          setError(
            e instanceof Error
              ? e.message
              : "Error desconocido."
          );
        } finally {
          setCargando(false);
          setActualizando(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resumen =
    useMemo(() => {
      const pendientes =
        recolecciones.filter(
          (r) =>
            r.estado ===
            "Pendiente"
        ).length;

      const enRuta =
        recolecciones.filter(
          (r) =>
            r.estado ===
            "En ruta"
        ).length;

      const recolectadas =
        recolecciones.filter(
          (r) =>
            r.estado ===
            "Recolectada"
        ).length;

      const problemas =
        recolecciones.filter(
          (r) =>
            esProblema(
              r.estado
            )
        ).length;

      const canceladas =
        recolecciones.filter(
          (r) =>
            r.estado ===
            "Cancelada"
        ).length;

      const noLista =
        recolecciones.filter(
          (r) =>
            r.estado ===
            "No lista"
        ).length;

      const reprogramadas =
        recolecciones.filter(
          (r) =>
            r.estado ===
            "Reprogramada"
        ).length;

      const sinRuta =
        recolecciones.filter(
          (r) =>
            esActiva(
              r.estado
            ) &&
            !r.ordenRuta.trim()
        ).length;

      return {
        pendientes,
        enRuta,
        recolectadas,
        problemas,
        canceladas,
        noLista,
        reprogramadas,
        sinRuta,
        total:
          recolecciones.length,
      };
    }, [recolecciones]);

  const coincideBusqueda =
    useCallback(
      (
        item: Recoleccion
      ) => {
        const q =
          busqueda
            .trim()
            .toLocaleLowerCase(
              "es"
            );

        if (!q) {
          return true;
        }

        const contenido = [
          item.folio,
          item.cliente,
          item.bodega,
          item.mercancia,
          item.cantidad,
          item.ordenRuta,
          item.observaciones,
        ]
          .join(" ")
          .toLocaleLowerCase(
            "es"
          );

        return contenido.includes(
          q
        );
      },
      [busqueda]
    );

  const desktop =
    useMemo(() => {
      return recolecciones
        .filter(
          (item) => {
            if (
              !coincideBusqueda(
                item
              )
            ) {
              return false;
            }

            if (
              filtroDesktop ===
              "Todas"
            ) {
              return true;
            }

            if (
              filtroDesktop ===
              "Activas"
            ) {
              return esActiva(
                item.estado
              );
            }

            if (
              filtroDesktop ===
              "Problemas"
            ) {
              return esProblema(
                item.estado
              );
            }

            if (
              filtroDesktop ===
              "Sin ruta"
            ) {
              return (
                esActiva(
                  item.estado
                ) &&
                !item.ordenRuta
                  .trim()
              );
            }

            return (
              item.estado ===
              filtroDesktop
            );
          }
        )
        .sort(
          compararPorRutaYFecha
        );
    }, [
      recolecciones,
      coincideBusqueda,
      filtroDesktop,
    ]);

  const movil =
    useMemo(() => {
      return recolecciones
        .filter(
          (item) => {
            if (
              !coincideBusqueda(
                item
              )
            ) {
              return false;
            }

            if (
              vistaMovil ===
              "Recolectadas"
            ) {
              return (
                item.estado ===
                "Recolectada"
              );
            }

            if (
              filtroMovil ===
              "Activas"
            ) {
              return esActiva(
                item.estado
              );
            }

            if (
              filtroMovil ===
              "Sin ruta"
            ) {
              return (
                esActiva(
                  item.estado
                ) &&
                !item.ordenRuta
                  .trim()
              );
            }

            return (
              item.estado ===
              filtroMovil
            );
          }
        )
        .sort(
          compararPorRutaYFecha
        );
    }, [
      recolecciones,
      coincideBusqueda,
      vistaMovil,
      filtroMovil,
    ]);

  /*
   * Carga los contadores reales de evidencias
   * solamente para las filas visibles. Se limita
   * a 40 folios para no saturar OneDrive.
   */
  useEffect(() => {
    const visibles =
      (
        vistaMovil ===
        "Recolectadas"
          ? movil
          : desktop
      )
        .slice(
          0,
          40
        )
        .filter(
          (item) =>
            Boolean(
              item.folio
            ) &&
            !resumenEvidencias[
              item.folio
            ]?.cargado
        );

    if (
      visibles.length === 0
    ) {
      return;
    }

    let cancelado =
      false;

    async function cargarResumenes() {
      const lote =
        4;

      for (
        let i = 0;
        i <
        visibles.length;
        i += lote
      ) {
        const grupo =
          visibles.slice(
            i,
            i + lote
          );

        const resultados =
          await Promise.all(
            grupo.map(
              async (
                item
              ) => {
                try {
                  const response =
                    await fetch(
                      `/api/recolecciones/${encodeURIComponent(
                        item.folio
                      )}/evidencias`,
                      {
                        cache:
                          "no-store",
                      }
                    );

                  const data =
                    (await response.json()) as RespuestaEvidencias;

                  if (
                    !response.ok ||
                    !data.success
                  ) {
                    throw new Error();
                  }

                  return {
                    folio:
                      item.folio,
                    notas:
                      data.resumen
                        ?.notas ??
                      0,
                    fotos:
                      data.resumen
                        ?.fotos ??
                      0,
                  };
                } catch {
                  return {
                    folio:
                      item.folio,
                    notas:
                      item.nota
                        ? 1
                        : 0,
                    fotos:
                      item.foto
                        ? 1
                        : 0,
                  };
                }
              }
            )
          );

        if (
          cancelado
        ) {
          return;
        }

        setResumenEvidencias(
          (actual) => {
            const siguiente =
              {
                ...actual,
              };

            for (
              const resultado
              of resultados
            ) {
              siguiente[
                resultado.folio
              ] = {
                notas:
                  resultado.notas,
                fotos:
                  resultado.fotos,
                cargado:
                  true,
              };
            }

            return siguiente;
          }
        );
      }
    }

    void cargarResumenes();

    return () => {
      cancelado = true;
    };
  }, [
    desktop,
    movil,
    vistaMovil,
    resumenEvidencias,
  ]);

  const eliminarDelSistema =
    useCallback(
      async (
        item: Recoleccion
      ) => {
        const confirmar =
          window.confirm(
            `¿Eliminar esta recolección de la vista de VIPACK?\n\n${item.folio}\n${item.cliente}\n\nLa fila NO se borrará del Excel y las evidencias NO se eliminarán.`
          );

        if (!confirmar) {
          return false;
        }

        const response =
          await fetch(
            "/api/recolecciones/eliminadas",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  folio:
                    item.folio,
                }),
            }
          );

        const data =
          (await response.json()) as {
            success?: boolean;
            error?: string;
          };

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "No se pudo eliminar la recolección de la vista."
          );
        }

        setRecolecciones(
          (actuales) =>
            actuales.filter(
              (registro) =>
                registro.folio !==
                item.folio
            )
        );

        setSeleccionada(
          null
        );

        return true;
      },
      []
    );

  const marcarComoRecolectada =
    useCallback(
      async (
        item: Recoleccion
      ) => {
        const confirmar =
          window.confirm(
            `¿Marcar como recolectada la mercancía de ${item.cliente}?`
          );

        if (!confirmar) {
          return false;
        }

        const response =
          await fetch(
            "/api/recolecciones",
            {
              method:
                "PATCH",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  folio:
                    item.folio,

                  estado:
                    "Recolectada",
                }),
            }
          );

        const data =
          (await response.json()) as {
            success?: boolean;
            error?: string;
            rutaAsignada?: string;
            registro?: {
              "Orden ruta"?: unknown;
            };
          };

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "No se pudo marcar la recolección como recolectada."
          );
        }

        const rutaDevuelta =
          String(
            data.rutaAsignada ??
              data.registro?.[
                "Orden ruta"
              ] ??
              item.ordenRuta ??
              ""
          ).trim();

        aplicarActualizacionLocal(
          item.folio,
          {
            estado:
              "Recolectada",

            ...(rutaDevuelta
              ? {
                  ordenRuta:
                    rutaDevuelta,
                }
              : {}),
          }
        );

        await cargar(true);

        return true;
      },
      [
        aplicarActualizacionLocal,
        cargar,
      ]
    );

  return (
    <div className="min-h-full bg-slate-100">
      {/* =========================
          ESCRITORIO
      ========================== */}

      <div className="hidden p-6 md:block xl:p-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                Operaciones
              </p>

              <h1 className="mt-1 text-3xl font-black text-slate-950">
                Recolecciones
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Control de
                solicitudes y
                recolecciones de
                VIPACK.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  void cargar(
                    true
                  )
                }
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm"
              >
                {actualizando
                  ? "Actualizando..."
                  : "Actualizar"}
              </button>

              <button
                type="button"
                onClick={() =>
                  setModalNueva(true)
                }
                className="rounded-2xl bg-[#072c74] px-5 py-3 text-sm font-black text-white shadow-lg"
              >
                + Nueva
                recolección
              </button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-8">
            <Resumen
              titulo="Pendientes"
              numero={
                resumen.pendientes
              }
              estilo="amber"
            />

            <Resumen
              titulo="En ruta"
              numero={
                resumen.enRuta
              }
              estilo="blue"
            />

            <Resumen
              titulo="No lista"
              numero={
                resumen.noLista
              }
              estilo="orange"
            />

            <Resumen
              titulo="Reprogramadas"
              numero={
                resumen.reprogramadas
              }
              estilo="violet"
            />

            <Resumen
              titulo="Sin ruta"
              numero={
                resumen.sinRuta
              }
              estilo="slate"
            />

            <Resumen
              titulo="Recolectadas"
              numero={
                resumen.recolectadas
              }
              estilo="green"
            />

            <Resumen
              titulo="Problemas"
              numero={
                resumen.problemas
              }
              estilo="red"
            />

            <Resumen
              titulo="Total"
              numero={
                resumen.total
              }
              estilo="slate"
            />
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    "Activas",
                    "Pendiente",
                    "En ruta",
                    "No lista",
                    "Reprogramada",
                    "Sin ruta",
                    "Recolectada",
                    "Problemas",
                    "Cancelada",
                    "Todas",
                  ].map(
                    (item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          setFiltroDesktop(
                            item as FiltroDesktop
                          )
                        }
                        className={`rounded-xl px-4 py-2 text-sm font-bold ${
                          filtroDesktop ===
                          item
                            ? "bg-[#072c74] text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>

                <Buscar
                  value={
                    busqueda
                  }
                  onChange={
                    setBusqueda
                  }
                />
              </div>
            </div>

            {cargando ? (
              <Cargando />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1380px]">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-[11px] font-black uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-4">
                        Ruta
                      </th>

                      <th className="px-4 py-4">
                        Folio
                      </th>

                      <th className="px-4 py-4">
                        Cliente
                      </th>

                      <th className="px-4 py-4">
                        Bodega
                      </th>

                      <th className="px-4 py-4">
                        Mercancía / bultos
                      </th>

                      <th className="px-4 py-4">
                        Fechas
                      </th>

                      <th className="px-4 py-4">
                        Evidencias
                      </th>

                      <th className="px-4 py-4">
                        Avisos
                      </th>

                      <th className="px-4 py-4">
                        Estado
                      </th>

                      <th className="px-4 py-4 text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {desktop.map(
                      (item) => {
                        const evidencia =
                          resumenEvidencias[
                            item.folio
                          ];

                        const notas =
                          evidencia
                            ?.cargado
                            ? evidencia.notas
                            : item.nota
                              ? 1
                              : 0;

                        const fotos =
                          evidencia
                            ?.cargado
                            ? evidencia.fotos
                            : item.foto
                              ? 1
                              : 0;

                        const mapa =
                          urlMapa(
                            item.direccion
                          );

                        const whatsapp =
                          urlWhatsApp(
                            item.telefono
                          );

                        return (
                          <tr
                            key={
                              item.folio
                            }
                            className="align-top hover:bg-slate-50"
                          >
                            <td className="px-4 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditorOperacion({
                                    item,
                                    tipo:
                                      "ruta",
                                  })
                                }
                                title={
                                  item.ordenRuta
                                    ? "Cambiar o quitar ruta"
                                    : "Asignar ruta"
                                }
                                className={
                                  item.ordenRuta
                                    ? "inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-[#072c74] px-2 font-black text-white transition hover:bg-blue-900"
                                    : "inline-flex rounded-lg border border-dashed border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 transition hover:bg-amber-100"
                                }
                              >
                                {item.ordenRuta
                                  ? item.ordenRuta
                                  : "Sin ruta"}
                              </button>
                            </td>

                            <td className="px-4 py-4">
                              <p className="text-xs font-black text-[#072c74]">
                                {
                                  item.folio
                                }
                              </p>

                              <p className="mt-1 text-[10px] font-semibold text-slate-400">
                                Solicitud:{" "}
                                {
                                  item.fechaSolicitud ||
                                  "—"
                                }
                              </p>
                            </td>

                            <td className="max-w-[230px] px-4 py-4">
                              <p className="font-black text-slate-900">
                                {
                                  item.cliente ||
                                  "Sin cliente"
                                }
                              </p>

                              {item.telefono && (
                                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                  {
                                    item.telefono
                                  }
                                </p>
                              )}
                            </td>

                            <td className="max-w-[210px] px-4 py-4 text-sm text-slate-600">
                              <p className="font-semibold">
                                {item.bodega ||
                                  "—"}
                              </p>

                              {item.direccion && (
                                <p className="mt-1 line-clamp-2 text-[10px] text-slate-400">
                                  {
                                    item.direccion
                                  }
                                </p>
                              )}
                            </td>

                            <td className="max-w-[230px] px-4 py-4">
                              <p className="line-clamp-2 text-sm font-semibold text-slate-700">
                                {item.mercancia ||
                                  "—"}
                              </p>

                              {item.cantidad && (
                                <p className="mt-1 text-[11px] font-black text-slate-500">
                                  Bultos:{" "}
                                  {
                                    item.cantidad
                                  }
                                </p>
                              )}
                            </td>

                            <td className="whitespace-nowrap px-4 py-4">
                              <p className="text-xs font-black text-slate-700">
                                Programada:{" "}
                                {formatoFecha(
                                  item.fechaRecoleccion
                                )}
                              </p>

                              <p className={`mt-1 text-[11px] font-black ${
                                item.horaCita
                                  ? "text-violet-700"
                                  : "text-slate-400"
                              }`}>
                                🕐{" "}
                                {formatoHora(
                                  item.horaCita
                                )}
                              </p>

                              <p className="mt-1 text-[10px] font-semibold text-slate-400">
                                Solicitada:{" "}
                                {
                                  item.fechaSolicitud ||
                                  "—"
                                }
                              </p>
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                                  notas > 0
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-slate-100 text-slate-400"
                                }`}>
                                  📄 {notas}{" "}
                                  {notas === 1
                                    ? "nota"
                                    : "notas"}
                                </span>

                                <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                                  fotos > 0
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-400"
                                }`}>
                                  📷 {fotos}{" "}
                                  {fotos === 1
                                    ? "foto"
                                    : "fotos"}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                {item.observaciones && (
                                  <span
                                    title={
                                      item.observaciones
                                    }
                                    className="inline-flex max-w-[150px] items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700"
                                  >
                                    ⚠️{" "}
                                    <span className="truncate">
                                      Observación
                                    </span>
                                  </span>
                                )}

                                {mapa && (
                                  <a
                                    href={mapa}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-lg bg-cyan-50 px-2 py-1 text-[10px] font-black text-cyan-700"
                                  >
                                    📍 Mapa
                                  </a>
                                )}
                              </div>

                              {!item.observaciones &&
                                !mapa && (
                                <span className="text-xs text-slate-300">
                                  —
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditorOperacion({
                                    item,
                                    tipo:
                                      "estado",
                                  })
                                }
                                title="Cambiar estado"
                                className="rounded-full transition hover:opacity-80"
                              >
                                <EstadoBadge
                                  estado={
                                    item.estado
                                  }
                                />
                              </button>
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex justify-end gap-1.5">
                                {whatsapp && (
                                  <a
                                    href={whatsapp}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Abrir WhatsApp"
                                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                                  >
                                    WhatsApp
                                  </a>
                                )}

                                {mapa && (
                                  <a
                                    href={mapa}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Abrir ubicación"
                                    className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 hover:bg-cyan-100"
                                  >
                                    📍
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    setSeleccionada(
                                      item
                                    )
                                  }
                                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
                                >
                                  Ver
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>

                {desktop.length ===
                  0 && (
                  <Vacio />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================
          TELÉFONO
      ========================== */}

      <div className="pb-24 md:hidden">
        <div className="sticky top-16 z-20 border-b border-slate-200 bg-white">
          <div className="px-4 pb-3 pt-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-700">
                  VIPACK
                </p>

                <h1 className="text-2xl font-black leading-tight text-slate-950">
                  Recolecciones
                </h1>
              </div>

              <button
                type="button"
                onClick={() =>
                  void cargar(
                    true
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600"
              >
                <IconoRefresh
                  activo={
                    actualizando
                  }
                />
              </button>
            </div>

            <Buscar
              value={busqueda}
              onChange={
                setBusqueda
              }
              movil
            />

            {vistaMovil ===
              "Solicitudes" && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {[
                  "Activas",
                  "Pendiente",
                  "En ruta",
                  "No lista",
                  "Reprogramada",
                  "Sin ruta",
                ].map(
                  (item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() =>
                        setFiltroMovil(
                          item as FiltroMovil
                        )
                      }
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black ${
                        filtroMovil ===
                        item
                          ? "bg-[#072c74] text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* RESUMEN MÓVIL */}

          <div className="grid grid-cols-3 border-t border-slate-100">
            <MiniResumen
              numero={
                resumen.pendientes
              }
              titulo="Pendientes"
              estilo="amber"
            />

            <MiniResumen
              numero={
                resumen.enRuta
              }
              titulo="En ruta"
              estilo="blue"
            />

            <MiniResumen
              numero={
                resumen.problemas
              }
              titulo="Problemas"
              estilo="red"
            />
          </div>
        </div>

        {error && (
          <div className="m-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="font-black text-red-800">
              Error
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>
          </div>
        )}

        {cargando ? (
          <Cargando />
        ) : (
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-bold text-slate-500">
                {movil.length}{" "}
                {vistaMovil ===
                "Solicitudes"
                  ? "solicitudes activas"
                  : "recolecciones"}
              </p>
            </div>

            <div className="space-y-3">
              {movil.map(
                (item) => (
                  <TarjetaMovil
                    key={
                      item.folio
                    }
                    item={item}
                    evidencia={
                      resumenEvidencias[
                        item.folio
                      ]
                    }
                    onVer={() =>
                      setSeleccionada(
                        item
                      )
                    }
                    onEditarRuta={() =>
                      setEditorOperacion({
                        item,
                        tipo:
                          "ruta",
                      })
                    }
                    onEditarEstado={() =>
                      setEditorOperacion({
                        item,
                        tipo:
                          "estado",
                      })
                    }
                    onMarcarRecolectada={() => {
                      void marcarComoRecolectada(
                        item
                      ).catch(
                        (
                          error: unknown
                        ) => {
                          window.alert(
                            error instanceof Error
                              ? error.message
                              : "No se pudo marcar como recolectada."
                          );
                        }
                      );
                    }}
                  />
                )
              )}
            </div>

            {movil.length ===
              0 && <Vacio />}
          </div>
        )}

        {/* BOTÓN FLOTANTE */}

        <button
          type="button"
          aria-label="Nueva recolección"
          onClick={() =>
            setModalNueva(true)
          }
          className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#072c74] text-3xl font-light text-white shadow-xl shadow-blue-950/30 active:scale-95"
        >
          +
        </button>

        {/* NAVEGACIÓN INFERIOR */}

        <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t border-slate-200 bg-white shadow-[0_-8px_25px_rgba(15,23,42,0.08)]">
          <button
            type="button"
            onClick={() =>
              setVistaMovil(
                "Solicitudes"
              )
            }
            className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-black ${
              vistaMovil ===
              "Solicitudes"
                ? "text-blue-700"
                : "text-slate-500"
            }`}
          >
            <IconoLista />

            Solicitudes

            {vistaMovil ===
              "Solicitudes" && (
              <span className="absolute bottom-0 h-1 w-16 rounded-t bg-blue-600" />
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              setVistaMovil(
                "Recolectadas"
              )
            }
            className={`relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-black ${
              vistaMovil ===
              "Recolectadas"
                ? "text-blue-700"
                : "text-slate-500"
            }`}
          >
            <IconoCheck />

            Recolectadas

            {vistaMovil ===
              "Recolectadas" && (
              <span className="absolute bottom-0 h-1 w-16 rounded-t bg-blue-600" />
            )}
          </button>
        </div>
      </div>

      {/* DETALLE */}

      {seleccionada && (
        <Detalle
          item={
            seleccionada
          }
          cerrar={() =>
            setSeleccionada(
              null
            )
          }
          onEditarRuta={() =>
            setEditorOperacion({
              item:
                seleccionada,
              tipo:
                "ruta",
            })
          }
          onEditarEstado={() =>
            setEditorOperacion({
              item:
                seleccionada,
              tipo:
                "estado",
            })
          }
          onEditarCita={() =>
            setEditorOperacion({
              item:
                seleccionada,
              tipo:
                "cita",
            })
          }
          onMarcarRecolectada={async () => {
            try {
              const ok =
                await marcarComoRecolectada(
                  seleccionada
                );

              if (ok) {
                setSeleccionada(
                  null
                );
              }
            } catch (
              error: unknown
            ) {
              window.alert(
                error instanceof Error
                  ? error.message
                  : "No se pudo marcar como recolectada."
              );
            }
          }}
          onEliminarDelSistema={async () => {
            try {
              await eliminarDelSistema(
                seleccionada
              );
            } catch (
              error: unknown
            ) {
              window.alert(
                error instanceof Error
                  ? error.message
                  : "No se pudo eliminar la recolección de la vista."
              );
            }
          }}
        />
      )}

      {editorOperacion && (
        <EditorRecoleccion
          item={
            editorOperacion.item
          }
          tipo={
            editorOperacion.tipo
          }
          onCerrar={() =>
            setEditorOperacion(
              null
            )
          }
          onGuardado={async (
            cambios
          ) => {
            aplicarActualizacionLocal(
              editorOperacion.item
                .folio,
              cambios
            );

            setEditorOperacion(
              null
            );

            await cargar(true);
          }}
        />
      )}

      {modalNueva && (
        <FormularioNuevaRecoleccion
          recolecciones={recolecciones}
          onCerrar={() =>
            setModalNueva(false)
          }
          onCreada={async () => {
            setModalNueva(false);
            await cargar(true);
          }}
        />
      )}
    </div>
  );
}

function FormularioNuevaRecoleccion({
  recolecciones,
  onCerrar,
  onCreada,
}: {
  recolecciones: Recoleccion[];
  onCerrar: () => void;
  onCreada: () => Promise<void>;
}) {
  const [cliente, setCliente] =
    useState("");

  const [telefono, setTelefono] =
    useState("");

  const [bodega, setBodega] =
    useState("");

  const [direccion, setDireccion] =
    useState("");

  const [mercancia, setMercancia] =
    useState("");

  const [cantidad, setCantidad] =
    useState("");

  const [
    fechaRecoleccion,
    setFechaRecoleccion,
  ] = useState("");

  const [
    horaCita,
    setHoraCita,
  ] = useState("");

  const [
    observaciones,
    setObservaciones,
  ] = useState("");

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    errorFormulario,
    setErrorFormulario,
  ] = useState("");

  const [
    clientesApi,
    setClientesApi,
  ] = useState<ClienteOption[]>([]);

  const [
    cargandoClientes,
    setCargandoClientes,
  ] = useState(true);

  const [
    clienteAbierto,
    setClienteAbierto,
  ] = useState(false);

  /*
   * Fallback seguro:
   * aunque /api/clientes todavía no exista o falle,
   * se construye la lista con los clientes que ya
   * aparecen en las recolecciones cargadas.
   */
  const clientesDeRecolecciones =
    useMemo(() => {
      const mapa =
        new Map<
          string,
          ClienteOption
        >();

      for (const item of recolecciones) {
        const nombre =
          item.cliente.trim();

        if (!nombre) {
          continue;
        }

        const key =
          nombre.toLocaleLowerCase(
            "es"
          );

        const actual =
          mapa.get(key);

        mapa.set(key, {
          nombre,
          telefono:
            actual?.telefono ||
            item.telefono.trim(),
        });
      }

      return Array.from(
        mapa.values()
      ).sort((a, b) =>
        a.nombre.localeCompare(
          b.nombre,
          "es"
        )
      );
    }, [recolecciones]);

  /*
   * Intenta cargar el catálogo maestro de clientes.
   * Es tolerante a respuestas como:
   *   { clientes: [...] }
   *   { registros: [...] }
   *   { data: [...] }
   *   [...]
   *
   * También acepta nombres de campos comunes:
   * nombre, name, cliente, Cliente, Nombre...
   */
  useEffect(() => {
    let cancelado = false;

    async function cargarClientes() {
      try {
        setCargandoClientes(true);

        const response =
          await fetch(
            "/api/clientes",
            {
              cache: "no-store",
            }
          );

        if (!response.ok) {
          return;
        }

        const data: unknown =
          await response.json();

        const raiz =
          data as
            | Record<
                string,
                unknown
              >
            | unknown[];

        const filas =
          Array.isArray(raiz)
            ? raiz
            : Array.isArray(
                  raiz?.clientes
                )
              ? raiz.clientes
              : Array.isArray(
                    raiz?.registros
                  )
                ? raiz.registros
                : Array.isArray(
                      raiz?.data
                    )
                  ? raiz.data
                  : [];

        const mapa =
          new Map<
            string,
            ClienteOption
          >();

        for (const fila of filas) {
          if (
            !fila ||
            typeof fila !== "object"
          ) {
            continue;
          }

          const item =
            fila as Record<
              string,
              unknown
            >;

          const nombre =
            txt(
              item.nombre ??
                item.Nombre ??
                item.name ??
                item.cliente ??
                item.Cliente ??
                item.razonSocial ??
                item.razon_social
            );

          if (!nombre) {
            continue;
          }

          const telefonoCliente =
            txt(
              item.telefono ??
                item.Telefono ??
                item.whatsapp ??
                item.WhatsApp ??
                item.telefonoWhatsApp ??
                item.TelefonoWhatsApp
            );

          const key =
            nombre.toLocaleLowerCase(
              "es"
            );

          const actual =
            mapa.get(key);

          mapa.set(key, {
            nombre,
            telefono:
              telefonoCliente ||
              actual?.telefono ||
              "",
          });
        }

        if (!cancelado) {
          setClientesApi(
            Array.from(
              mapa.values()
            ).sort((a, b) =>
              a.nombre.localeCompare(
                b.nombre,
                "es"
              )
            )
          );
        }
      } catch {
        /*
         * No bloqueamos el formulario.
         * Si falla el endpoint, se usa el
         * fallback de recolecciones.
         */
      } finally {
        if (!cancelado) {
          setCargandoClientes(
            false
          );
        }
      }
    }

    void cargarClientes();

    return () => {
      cancelado = true;
    };
  }, []);

  const clientes =
    useMemo(() => {
      const mapa =
        new Map<
          string,
          ClienteOption
        >();

      for (const item of [
        ...clientesDeRecolecciones,
        ...clientesApi,
      ]) {
        const key =
          item.nombre
            .trim()
            .toLocaleLowerCase(
              "es"
            );

        if (!key) {
          continue;
        }

        const actual =
          mapa.get(key);

        mapa.set(key, {
          nombre: item.nombre.trim(),
          telefono:
            item.telefono.trim() ||
            actual?.telefono ||
            "",
        });
      }

      return Array.from(
        mapa.values()
      ).sort((a, b) =>
        a.nombre.localeCompare(
          b.nombre,
          "es"
        )
      );
    }, [
      clientesApi,
      clientesDeRecolecciones,
    ]);

  const clientesFiltrados =
    useMemo(() => {
      const q =
        cliente
          .trim()
          .toLocaleLowerCase(
            "es"
          );

      // Mostrar TODO el catálogo maestro cuando no hay búsqueda.
      // Antes se limitaba a 50 clientes, por eso faltaban registros
      // del Excel en el selector de nueva recolección.
      if (!q) {
        return clientes;
      }

      // Buscar sobre el catálogo completo, sin recortar resultados.
      return clientes.filter((item) =>
        item.nombre
          .toLocaleLowerCase(
            "es"
          )
          .includes(q)
      );
    }, [cliente, clientes]);

  const bodegas =
    useMemo(() => {
      const valores =
        new Set<string>();

      for (const item of recolecciones) {
        const nombre =
          item.bodega.trim();

        if (nombre) {
          valores.add(nombre);
        }
      }

      return Array.from(
        valores
      ).sort((a, b) =>
        a.localeCompare(b, "es")
      );
    }, [recolecciones]);

  function seleccionarCliente(
    seleccionado: ClienteOption
  ) {
    setCliente(
      seleccionado.nombre
    );

    if (seleccionado.telefono) {
      setTelefono(
        seleccionado.telefono
      );
    }

    setClienteAbierto(false);
    setErrorFormulario("");
  }

  async function guardar() {
    const clienteLimpio =
      cliente.trim();

    const bodegaLimpia =
      bodega.trim();

    if (!clienteLimpio) {
      setErrorFormulario(
        "Selecciona o escribe el nombre del cliente."
      );
      return;
    }

    if (!bodegaLimpia) {
      setErrorFormulario(
        "Escribe la bodega de recolección."
      );
      return;
    }

    try {
      setGuardando(true);
      setErrorFormulario("");

      const response =
        await fetch(
          "/api/recolecciones",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                cliente:
                  clienteLimpio,

                telefono:
                  telefono.trim(),

                bodega:
                  bodegaLimpia,

                direccion:
                  direccion.trim(),

                mercancia:
                  mercancia.trim(),

                cantidad:
                  cantidad.trim(),

                fechaRecoleccion,

                horaCita,

                observaciones:
                  observaciones.trim(),
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "No se pudo crear la recolección."
        );
      }

      await onCreada();
    } catch (
      err: unknown
    ) {
      setErrorFormulario(
        err instanceof Error
          ? err.message
          : "No se pudo crear la recolección."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0"
      />

      <div className="relative z-10 max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-cyan-700">
              Recolecciones
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-950">
              Nueva recolección
            </h2>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl font-bold text-slate-600 disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 p-5">
          <SelectorCliente
            value={cliente}
            onChange={(value) => {
              setCliente(value);
              setClienteAbierto(true);

              /*
               * Si el usuario cambia manualmente
               * el nombre después de seleccionar,
               * evitamos conservar por accidente
               * el teléfono de otra persona.
               */
              const exacto =
                clientes.find(
                  (item) =>
                    item.nombre.toLocaleLowerCase(
                      "es"
                    ) ===
                    value
                      .trim()
                      .toLocaleLowerCase(
                        "es"
                      )
                );

              if (exacto) {
                if (
                  exacto.telefono
                ) {
                  setTelefono(
                    exacto.telefono
                  );
                }
              }
            }}
            abierto={clienteAbierto}
            setAbierto={
              setClienteAbierto
            }
            opciones={
              clientesFiltrados
            }
            cargando={
              cargandoClientes
            }
            onSeleccionar={
              seleccionarCliente
            }
          />

          <CampoFormulario
            titulo="Teléfono"
            value={telefono}
            onChange={setTelefono}
            placeholder="Número de WhatsApp"
            inputMode="tel"
          />

          <CampoFormulario
            titulo="Bodega *"
            value={bodega}
            onChange={setBodega}
            placeholder="Ej. Lady Ventas"
            list="vipack-bodegas"
          />

          <datalist id="vipack-bodegas">
            {bodegas.map(
              (nombre) => (
                <option
                  key={nombre}
                  value={nombre}
                />
              )
            )}
          </datalist>

          <CampoFormulario
            titulo="Dirección / ubicación"
            value={direccion}
            onChange={setDireccion}
            placeholder="Dirección o enlace de Google Maps"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoFormulario
              titulo="Mercancía"
              value={mercancia}
              onChange={setMercancia}
              placeholder="Ej. Venta de grupo"
            />

            <CampoFormulario
              titulo="Cantidad / Bultos"
              value={cantidad}
              onChange={setCantidad}
              placeholder="Ej. 2 bolsas / 15 piezas"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                Fecha programada de recolección
              </label>

              <input
                type="date"
                value={fechaRecoleccion}
                onChange={(event) =>
                  setFechaRecoleccion(
                    event.target.value
                  )
                }
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                Hora de cita
              </label>

              <input
                type="time"
                value={horaCita}
                onChange={(event) =>
                  setHoraCita(
                    event.target.value
                  )
                }
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />

              <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                Opcional si la bodega no maneja cita.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
              Observaciones
            </label>

            <textarea
              value={observaciones}
              onChange={(event) =>
                setObservaciones(
                  event.target.value
                )
              }
              rows={4}
              placeholder="Notas importantes de la recolección"
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {errorFormulario && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {errorFormulario}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() =>
                void guardar()
              }
              disabled={
                guardando ||
                !cliente.trim() ||
                !bodega.trim()
              }
              className="rounded-2xl bg-[#072c74] px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando
                ? "Guardando..."
                : "Crear recolección"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectorCliente({
  value,
  onChange,
  abierto,
  setAbierto,
  opciones,
  cargando,
  onSeleccionar,
}: {
  value: string;
  onChange: (
    value: string
  ) => void;
  abierto: boolean;
  setAbierto: (
    value: boolean
  ) => void;
  opciones: ClienteOption[];
  cargando: boolean;
  onSeleccionar: (
    cliente: ClienteOption
  ) => void;
}) {
  return (
    <div className="relative">
      <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
        Cliente *
      </label>

      <div className="relative">
        <input
          type="text"
          autoComplete="off"
          value={value}
          onFocus={() =>
            setAbierto(true)
          }
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          onKeyDown={(event) => {
            if (
              event.key ===
              "Escape"
            ) {
              setAbierto(false);
            }
          }}
          placeholder="Buscar o seleccionar cliente"
          className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />

        <button
          type="button"
          tabIndex={-1}
          aria-label="Mostrar clientes"
          onMouseDown={(event) =>
            event.preventDefault()
          }
          onClick={() =>
            setAbierto(!abierto)
          }
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`h-4 w-4 transition ${
              abierto
                ? "rotate-180"
                : ""
            }`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {abierto && (
        <div className="absolute left-0 right-0 z-[150] mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          {cargando &&
            opciones.length ===
              0 && (
              <p className="px-3 py-3 text-sm font-semibold text-slate-500">
                Cargando
                clientes...
              </p>
            )}

          {!cargando &&
            opciones.length ===
              0 && (
              <div className="px-3 py-3">
                <p className="text-sm font-black text-slate-700">
                  No hay
                  coincidencias
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Puedes escribir el
                  nombre manualmente.
                </p>
              </div>
            )}

          {opciones.map(
            (item) => (
              <button
                key={`${item.nombre}-${item.telefono}`}
                type="button"
                onMouseDown={(
                  event
                ) =>
                  event.preventDefault()
                }
                onClick={() =>
                  onSeleccionar(
                    item
                  )
                }
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">
                    {item.nombre}
                  </p>

                  {item.telefono && (
                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                      {
                        item.telefono
                      }
                    </p>
                  )}
                </div>

                <span className="shrink-0 text-xs font-black text-blue-700">
                  Elegir
                </span>
              </button>
            )
          )}
        </div>
      )}

      <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
        {cargando
          ? "Sincronizando catálogo de clientes..."
          : `${opciones.length} cliente${
              opciones.length ===
              1
                ? ""
                : "s"
            } disponible${
              opciones.length ===
              1
                ? ""
                : "s"
            } en esta búsqueda`}
      </p>
    </div>
  );
}

function CampoFormulario({
  titulo,
  value,
  onChange,
  placeholder,
  inputMode,
  list,
}: {
  titulo: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder: string;
  inputMode?:
    | "text"
    | "tel"
    | "email"
    | "numeric";
  list?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
        {titulo}
      </label>

      <input
        type="text"
        inputMode={inputMode}
        list={list}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function TarjetaMovil({
  item,
  evidencia,
  onVer,
  onEditarRuta,
  onEditarEstado,
  onMarcarRecolectada,
}: {
  item: Recoleccion;
  evidencia?:
    ResumenEvidenciaFila;
  onVer: () => void;
  onEditarRuta: () => void;
  onEditarEstado: () => void;
  onMarcarRecolectada: () => void;
}) {
  const notas =
    evidencia?.cargado
      ? evidencia.notas
      : item.nota
        ? 1
        : 0;

  const fotos =
    evidencia?.cargado
      ? evidencia.fotos
      : item.foto
        ? 1
        : 0;

  const mapa =
    urlMapa(
      item.direccion
    );

  const whatsapp =
    urlWhatsApp(
      item.telefono
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onVer}
        className="block w-full p-4 text-left"
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            item.ordenRuta
              ? "bg-[#072c74] text-white"
              : "border border-dashed border-amber-300 bg-amber-50 text-amber-700"
          }`}>
            {item.ordenRuta ? (
              <span className="text-lg font-black">
                {
                  item.ordenRuta
                }
              </span>
            ) : (
              <span className="text-[9px] font-black leading-tight">
                SIN
                <br />
                RUTA
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-black text-[#072c74]">
                  {item.folio}
                </p>

                <p className="mt-0.5 line-clamp-2 text-base font-black leading-tight text-slate-950">
                  {item.cliente ||
                    "Sin cliente"}
                </p>
              </div>

              <EstadoBadge
                estado={
                  item.estado
                }
              />
            </div>

            <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
              <IconoPin />

              <span className="truncate">
                {item.bodega ||
                  "Sin bodega"}
              </span>
            </div>

            {(item.mercancia ||
              item.cantidad) && (
              <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                {item.mercancia}

                {item.mercancia &&
                item.cantidad
                  ? " · "
                  : ""}

                {item.cantidad}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">
                📄 {notas}
              </span>

              <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                📷 {fotos}
              </span>

              {item.observaciones && (
                <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
                  ⚠️ Aviso
                </span>
              )}

              {mapa && (
                <span className="rounded-lg bg-cyan-50 px-2 py-1 text-[10px] font-black text-cyan-700">
                  📍 Ubicación
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <div>
            <p className="text-xs font-black text-slate-600">
              {formatoFecha(
                item.fechaRecoleccion ||
                  item.fechaSolicitud
              )}
            </p>

            <p className="mt-0.5 text-[10px] text-slate-400">
              Programada
            </p>

            <p className={`mt-1 text-[11px] font-black ${
              item.horaCita
                ? "text-violet-700"
                : "text-slate-400"
            }`}>
              🕐{" "}
              {formatoHora(
                item.horaCita
              )}
            </p>
          </div>

          <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">
            Ver detalle
          </span>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={
            onEditarRuta
          }
          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-xs font-black text-blue-700"
        >
          {item.ordenRuta
            ? `Ruta ${item.ordenRuta}`
            : "+ Asignar ruta"}
        </button>

        <button
          type="button"
          onClick={
            onEditarEstado
          }
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-black text-slate-700"
        >
          Cambiar estado
        </button>

        {item.estado !==
          "Recolectada" && (
          <button
            type="button"
            onClick={
              onMarcarRecolectada
            }
            className="col-span-2 rounded-xl bg-emerald-600 px-3 py-3 text-center text-xs font-black text-white"
          >
            ✓ Marcar como recolectada
          </button>
        )}

        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-black text-emerald-700"
          >
            WhatsApp
          </a>
        )}

        {mapa && (
          <a
            href={mapa}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-cyan-50 px-3 py-2 text-center text-xs font-black text-cyan-700"
          >
            📍 Abrir mapa
          </a>
        )}
      </div>
    </div>
  );
}

function Detalle({
  item,
  cerrar,
  onEditarRuta,
  onEditarEstado,
  onEditarCita,
  onMarcarRecolectada,
  onEliminarDelSistema,
}: {
  item: Recoleccion;
  cerrar: () => void;
  onEditarRuta: () => void;
  onEditarEstado: () => void;
  onEditarCita: () => void;
  onMarcarRecolectada: () => Promise<void>;
  onEliminarDelSistema: () => Promise<void>;
}) {
  const [
    notas,
    setNotas,
  ] = useState<
    EvidenciaArchivo[]
  >([]);

  const [
    fotos,
    setFotos,
  ] = useState<
    EvidenciaArchivo[]
  >([]);

  const [
    cargandoEvidencias,
    setCargandoEvidencias,
  ] = useState(true);

  const [
    marcandoRecolectada,
    setMarcandoRecolectada,
  ] = useState(false);

  const [
    eliminandoRecoleccion,
    setEliminandoRecoleccion,
  ] = useState(false);

  const [
    subiendoTipo,
    setSubiendoTipo,
  ] = useState<
    "nota" | "foto" | null
  >(null);

  const [
    eliminandoId,
    setEliminandoId,
  ] = useState<
    string | null
  >(null);

  const [
    errorEvidencias,
    setErrorEvidencias,
  ] = useState("");

  const [
    mensajeEvidencias,
    setMensajeEvidencias,
  ] = useState("");

  const [
    visor,
    setVisor,
  ] = useState<{
    tipo:
      "nota" | "foto";
    index: number;
  } | null>(null);

  async function confirmarRecolectada() {
    try {
      setMarcandoRecolectada(
        true
      );

      await onMarcarRecolectada();
    } finally {
      setMarcandoRecolectada(
        false
      );
    }
  }

  async function confirmarEliminacionVista() {
    try {
      setEliminandoRecoleccion(
        true
      );

      await onEliminarDelSistema();
    } finally {
      setEliminandoRecoleccion(
        false
      );
    }
  }

  const cargarEvidencias =
    useCallback(
      async () => {
        try {
          setCargandoEvidencias(
            true
          );
          setErrorEvidencias("");

          const response =
            await fetch(
              `/api/recolecciones/${encodeURIComponent(
                item.folio
              )}/evidencias`,
              {
                cache:
                  "no-store",
              }
            );

          const data =
            (await response.json()) as RespuestaEvidencias;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.error ||
                "No se pudieron cargar las evidencias."
            );
          }

          setNotas(
            Array.isArray(
              data.notas
            )
              ? data.notas
              : []
          );

          setFotos(
            Array.isArray(
              data.fotos
            )
              ? data.fotos
              : []
          );
        } catch (
          error: unknown
        ) {
          setErrorEvidencias(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las evidencias."
          );
        } finally {
          setCargandoEvidencias(
            false
          );
        }
      },
      [item.folio]
    );

  useEffect(() => {
    void cargarEvidencias();
  }, [cargarEvidencias]);

  async function subirEvidencias(
    tipo: "nota" | "foto",
    archivos:
      FileList |
      File[] |
      null
  ) {
    if (
      !archivos ||
      archivos.length === 0
    ) {
      return;
    }

    try {
      setSubiendoTipo(tipo);
      setErrorEvidencias("");
      setMensajeEvidencias("");

      const formData =
        new FormData();

      formData.append(
        "tipo",
        tipo
      );

      Array.from(
        archivos
      ).forEach(
        (archivo: File) => {
          formData.append(
            "archivos",
            archivo
          );
        }
      );

      const response =
        await fetch(
          `/api/recolecciones/${encodeURIComponent(
            item.folio
          )}/evidencias`,
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          error?: string;
          agregados?: number;
          archivos?: Array<{
            id?: string;
            nombre?: string;
            tamaño?: number;
            webUrl?: string | null;
          }>;
          destino?: {
            cliente?: string | null;
            carpeta?: string | null;
            ruta?: string;
          };
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "No se pudieron subir los archivos."
        );
      }

      const nuevos:
        EvidenciaArchivo[] =
        Array.isArray(
          data.archivos
        )
          ? data.archivos
              .filter(
                (archivo) =>
                  Boolean(
                    archivo?.id &&
                    archivo?.nombre
                  )
              )
              .map(
                (archivo) => ({
                  id:
                    String(
                      archivo.id
                    ),

                  nombre:
                    String(
                      archivo.nombre
                    ),

                  tamaño:
                    Number(
                      archivo.tamaño ||
                      0
                    ),

                  webUrl:
                    archivo.webUrl
                      ? String(
                          archivo.webUrl
                        )
                      : null,

                  modificado:
                    new Date()
                      .toISOString(),
                })
              )
          : [];

      /*
       * Mostrar de inmediato sin esperar
       * a volver a consultar OneDrive.
       */
      if (
        tipo === "nota"
      ) {
        setNotas(
          (actuales) => [
            ...actuales,
            ...nuevos.filter(
              (nuevo) =>
                !actuales.some(
                  (actual) =>
                    actual.id ===
                    nuevo.id
                )
            ),
          ]
        );
      } else {
        setFotos(
          (actuales) => [
            ...actuales,
            ...nuevos.filter(
              (nuevo) =>
                !actuales.some(
                  (actual) =>
                    actual.id ===
                    nuevo.id
                )
            ),
          ]
        );
      }

      const cantidad =
        data.agregados ??
        nuevos.length;

      setMensajeEvidencias(
        tipo === "nota"
          ? `✓ ${
              cantidad === 1
                ? "Nota subida correctamente."
                : `${cantidad} notas subidas correctamente.`
            }`
          : `✓ ${
              cantidad === 1
                ? "Foto subida correctamente"
                : `${cantidad} fotos subidas correctamente`
            }${
              data.destino?.cliente
                ? ` en la carpeta de ${data.destino.cliente}.`
                : "."
            }`
      );

      /*
       * Verificación secundaria. El backend
       * ya consulta primero la carpeta exacta,
       * así que el contador debe mantenerse.
       */
      window.setTimeout(
        () => {
          void cargarEvidencias();
        },
        1200
      );
    } catch (
      error: unknown
    ) {
      setMensajeEvidencias("");

      setErrorEvidencias(
        error instanceof Error
          ? error.message
          : "No se pudieron subir los archivos."
      );
    } finally {
      setSubiendoTipo(null);
    }
  }

  async function eliminarEvidencia(
    archivo:
      EvidenciaArchivo,
    tipo:
      "nota" | "foto"
  ) {
    const nombreTipo =
      tipo === "nota"
        ? "nota"
        : "foto";

    const confirmar =
      window.confirm(
        `¿Eliminar esta ${nombreTipo}?\n\n${archivo.nombre}\n\nEsta acción eliminará el archivo de OneDrive.`
      );

    if (!confirmar) {
      return;
    }

    try {
      setEliminandoId(
        archivo.id
      );
      setErrorEvidencias("");

      const response =
        await fetch(
          `/api/recolecciones/${encodeURIComponent(
            item.folio
          )}/evidencias`,
          {
            method:
              "DELETE",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                id:
                  archivo.id,
                tipo,
              }),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          error?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "No se pudo eliminar la evidencia."
        );
      }

      setVisor(null);

      await cargarEvidencias();
    } catch (
      error: unknown
    ) {
      setErrorEvidencias(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la evidencia."
      );
    } finally {
      setEliminandoId(null);
    }
  }

  const archivosVisor =
    visor?.tipo === "nota"
      ? notas
      : visor?.tipo === "foto"
        ? fotos
        : [];

  const archivoVisor =
    visor &&
    archivosVisor[
      visor.index
    ]
      ? archivosVisor[
          visor.index
        ]
      : null;

  function moverVisor(
    direccion:
      -1 | 1
  ) {
    if (
      !visor ||
      archivosVisor.length ===
        0
    ) {
      return;
    }

    const siguiente =
      (
        visor.index +
        direccion +
        archivosVisor.length
      ) %
      archivosVisor.length;

    setVisor({
      ...visor,
      index:
        siguiente,
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-end bg-slate-950/55 md:items-center md:justify-center md:p-5">
        <button
          type="button"
          onClick={cerrar}
          className="absolute inset-0"
          aria-label="Cerrar"
        />

        <div className="relative z-10 max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white md:max-w-3xl md:rounded-3xl">
          <div className="sticky top-0 z-20 flex items-start justify-between border-b border-slate-200 bg-white p-5">
            <div>
              <p className="text-xs font-black text-[#072c74]">
                {item.folio}
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-950">
                {item.cliente}
              </h2>
            </div>

            <button
              type="button"
              onClick={cerrar}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl"
            >
              ×
            </button>
          </div>

          <div className="p-5">
            <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">
                Control operativo
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={
                    onEditarRuta
                  }
                  className="flex items-center justify-between rounded-xl border border-blue-200 bg-white px-4 py-3 text-left transition hover:bg-blue-50"
                >
                  <span>
                    <span className="block text-[10px] font-black uppercase text-slate-400">
                      Ruta
                    </span>

                    <span className="mt-1 block text-sm font-black text-[#072c74]">
                      {item.ordenRuta
                        ? `Ruta ${item.ordenRuta}`
                        : "Sin ruta asignada"}
                    </span>
                  </span>

                  <span className="text-xs font-black text-blue-700">
                    {item.ordenRuta
                      ? "Cambiar"
                      : "Asignar"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={
                    onEditarEstado
                  }
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <span>
                    <span className="block text-[10px] font-black uppercase text-slate-400">
                      Estado
                    </span>

                    <span className="mt-1 block">
                      <EstadoBadge
                        estado={
                          item.estado
                        }
                      />
                    </span>
                  </span>

                  <span className="text-xs font-black text-slate-700">
                    Cambiar
                  </span>
                </button>

                <button
                  type="button"
                  onClick={
                    onEditarCita
                  }
                  className="flex items-center justify-between rounded-xl border border-violet-200 bg-white px-4 py-3 text-left transition hover:bg-violet-50"
                >
                  <span>
                    <span className="block text-[10px] font-black uppercase text-slate-400">
                      Cita
                    </span>

                    <span className="mt-1 block text-sm font-black text-violet-700">
                      {formatoFecha(
                        item.fechaRecoleccion
                      )}
                    </span>

                    <span className="mt-0.5 block text-xs font-black text-slate-500">
                      {formatoHora(
                        item.horaCita
                      )}
                    </span>
                  </span>

                  <span className="text-xs font-black text-violet-700">
                    Editar
                  </span>
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Dato
                titulo="Bodega"
                valor={
                  item.bodega
                }
              />

              <Dato
                titulo="Fecha"
                valor={formatoFecha(
                  item.fechaRecoleccion
                )}
              />

              <Dato
                titulo="Mercancía"
                valor={
                  item.mercancia
                }
              />

              <Dato
                titulo="Cantidad / Bultos"
                valor={
                  item.cantidad
                }
              />

              <Dato
                titulo="Teléfono"
                valor={
                  item.telefono
                }
              />

              <Dato
                titulo="Fecha solicitud"
                valor={
                  item.fechaSolicitud
                }
              />
            </div>

            {item.direccion && (
              <div className="mt-3">
                <Dato
                  titulo="Dirección"
                  valor={
                    item.direccion
                  }
                />
              </div>
            )}

            {item.observaciones && (
              <div className="mt-3">
                <Dato
                  titulo="Observaciones"
                  valor={
                    item.observaciones
                  }
                />
              </div>
            )}

            {item.estado !==
              "Recolectada" && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                  Finalizar recolección
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Cuando la mercancía ya esté contigo, marca esta solicitud como recolectada.
                </p>

                <button
                  type="button"
                  disabled={
                    marcandoRecolectada
                  }
                  onClick={() =>
                    void confirmarRecolectada()
                  }
                  className="mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-emerald-900/10 transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {marcandoRecolectada
                    ? "Guardando..."
                    : "✓ Marcar como recolectada"}
                </button>

                {item.estado !==
                  "En ruta" && (
                  <p className="mt-2 text-center text-[11px] font-semibold text-amber-700">
                    Estado actual: {item.estado}. También puedes cambiarlo manualmente desde Control operativo.
                  </p>
                )}
              </div>
            )}

            {item.estado ===
              "Recolectada" && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                <p className="text-sm font-black text-emerald-700">
                  ✓ Recolección completada
                </p>

                <p className="mt-1 text-xs font-semibold text-emerald-700/80">
                  Esta mercancía ya está marcada como recolectada.
                </p>
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-700">
                Quitar de la vista
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-600">
                Elimina esta recolección del panel de VIPACK sin borrar la fila del Excel, las notas ni las fotos.
              </p>

              <button
                type="button"
                disabled={
                  eliminandoRecoleccion
                }
                onClick={() =>
                  void confirmarEliminacionVista()
                }
                className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl border border-red-300 bg-white px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {eliminandoRecoleccion
                  ? "Eliminando..."
                  : "Eliminar del sistema"}
              </button>

              <p className="mt-2 text-center text-[10px] font-semibold text-red-700/75">
                El registro original seguirá disponible en control_recolecciones_bodega.xlsx.
              </p>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">
                    Evidencias
                  </p>

                  <h3 className="mt-1 text-lg font-black text-slate-950">
                    Evidencias de recolección
                  </h3>

                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {notas.length}{" "}
                    {notas.length === 1
                      ? "nota"
                      : "notas"}
                    {" · "}
                    {fotos.length}{" "}
                    {fotos.length === 1
                      ? "foto"
                      : "fotos"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void cargarEvidencias()
                  }
                  disabled={
                    cargandoEvidencias
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50"
                >
                  {cargandoEvidencias
                    ? "Cargando..."
                    : "Actualizar"}
                </button>
              </div>

              {errorEvidencias && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {errorEvidencias}
                </div>
              )}

              {mensajeEvidencias && (
                <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  <span>
                    {mensajeEvidencias}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setMensajeEvidencias(
                        ""
                      )
                    }
                    className="shrink-0 text-lg leading-none text-emerald-700"
                    aria-label="Cerrar mensaje"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <SeccionEvidencias
                  titulo="Notas de recolección"
                  subtitulo="Puedes seleccionar varias imágenes."
                  archivos={notas}
                  tipo="nota"
                  subiendo={
                    subiendoTipo ===
                    "nota"
                  }
                  eliminandoId={
                    eliminandoId
                  }
                  onSeleccionar={(
                    archivos
                  ) =>
                    void subirEvidencias(
                      "nota",
                      archivos
                    )
                  }
                  onVer={(
                    index
                  ) =>
                    setVisor({
                      tipo:
                        "nota",
                      index,
                    })
                  }
                  onEliminar={(
                    archivo
                  ) =>
                    void eliminarEvidencia(
                      archivo,
                      "nota"
                    )
                  }
                  legado={
                    item.nota
                  }
                />

                <SeccionEvidencias
                  titulo="Fotos de mercancía"
                  subtitulo="Puedes agregar varias fotos al mismo folio."
                  archivos={fotos}
                  tipo="foto"
                  subiendo={
                    subiendoTipo ===
                    "foto"
                  }
                  eliminandoId={
                    eliminandoId
                  }
                  onSeleccionar={(
                    archivos
                  ) =>
                    void subirEvidencias(
                      "foto",
                      archivos
                    )
                  }
                  onVer={(
                    index
                  ) =>
                    setVisor({
                      tipo:
                        "foto",
                      index,
                    })
                  }
                  onEliminar={(
                    archivo
                  ) =>
                    void eliminarEvidencia(
                      archivo,
                      "foto"
                    )
                  }
                  legado={
                    item.foto
                  }
                />
              </div>
            </div>

            <button
              type="button"
              onClick={cerrar}
              className="mt-6 w-full rounded-2xl bg-[#072c74] py-3.5 text-sm font-black text-white"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {visor &&
        archivoVisor && (
          <VisorEvidencia
            folio={
              item.folio
            }
            archivo={
              archivoVisor
            }
            posicion={
              visor.index + 1
            }
            total={
              archivosVisor.length
            }
            onCerrar={() =>
              setVisor(null)
            }
            onAnterior={() =>
              moverVisor(-1)
            }
            onSiguiente={() =>
              moverVisor(1)
            }
          />
        )}
    </>
  );
}

function SeccionEvidencias({
  titulo,
  subtitulo,
  archivos,
  tipo,
  subiendo,
  eliminandoId,
  onSeleccionar,
  onVer,
  onEliminar,
  legado,
}: {
  titulo: string;
  subtitulo: string;
  archivos: EvidenciaArchivo[];
  tipo: "nota" | "foto";
  subiendo: boolean;
  eliminandoId:
    string | null;
  onSeleccionar: (
    archivos:
      FileList |
      File[] |
      null
  ) => void;
  onVer: (
    index: number
  ) => void;
  onEliminar: (
    archivo:
      EvidenciaArchivo
  ) => void;
  legado: string;
}) {
  const [
    camaraAbierta,
    setCamaraAbierta,
  ] = useState(false);

  const inputArchivoId =
    `evidencias-archivo-${tipo}`;

  const inputGaleriaId =
    `evidencias-galeria-${tipo}`;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-900">
              {titulo}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {subtitulo}
            </p>
          </div>

          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#072c74] shadow-sm">
            {archivos.length}
          </span>
        </div>

        {/* =========================
            OPCIÓN 1: ARCHIVOS
        ========================== */}
        <input
          id={inputArchivoId}
          type="file"
          accept="image/*"
          multiple
          disabled={subiendo}
          className="hidden"
          onChange={(event) => {
            const files =
              event.target.files;

            onSeleccionar(
              files
            );

            event.currentTarget.value =
              "";
          }}
        />

        {/* =========================
            OPCIÓN 2: GALERÍA
        ========================== */}
        <input
          id={inputGaleriaId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          disabled={subiendo}
          className="hidden"
          onChange={(event) => {
            const files =
              event.target.files;

            onSeleccionar(
              files
            );

            event.currentTarget.value =
              "";
          }}
        />

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <label
            htmlFor={
              inputArchivoId
            }
            className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-center text-xs font-black transition ${
              subiendo
                ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:scale-[0.99]"
            }`}
          >
            <span className="text-lg">
              📁
            </span>

            <span>
              Subir archivo
            </span>
          </label>

          <label
            htmlFor={
              inputGaleriaId
            }
            className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-center text-xs font-black transition ${
              subiendo
                ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-[0.99]"
            }`}
          >
            <span className="text-lg">
              🖼️
            </span>

            <span>
              Elegir imágenes
            </span>
          </label>

          <button
            type="button"
            disabled={subiendo}
            onClick={() =>
              setCamaraAbierta(
                true
              )
            }
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#072c74] px-3 py-3 text-center text-xs font-black text-white transition hover:bg-blue-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <span className="text-lg">
              📷
            </span>

            <span>
              Tomar foto ahora
            </span>
          </button>
        </div>

        {subiendo && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-xs font-black text-blue-700">
            Subiendo evidencia...
          </div>
        )}

        {archivos.length >
        0 ? (
          <div className="mt-3 space-y-2">
            {archivos.map(
              (
                archivo,
                index
              ) => {
                const eliminando =
                  eliminandoId ===
                  archivo.id;

                return (
                  <div
                    key={
                      archivo.id ||
                      `${archivo.nombre}-${index}`
                    }
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          onVer(index)
                        }
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-700"
                        aria-label={`Ver ${archivo.nombre}`}
                      >
                        {index + 1}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-slate-800">
                          {
                            archivo.nombre
                          }
                        </p>

                        <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                          {formatoBytes(
                            archivo.tamaño
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onVer(index)
                        }
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"
                      >
                        Ver
                      </button>

                      <button
                        type="button"
                        disabled={
                          eliminando
                        }
                        onClick={() =>
                          onEliminar(
                            archivo
                          )
                        }
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50"
                      >
                        {eliminando
                          ? "Eliminando..."
                          : "Eliminar"}
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center">
            <p className="text-xs font-bold text-slate-500">
              {legado
                ? "Existe una evidencia histórica registrada en el Excel."
                : "Todavía no hay archivos para este folio."}
            </p>
          </div>
        )}
      </div>

      {camaraAbierta && (
        <CamaraEvidencia
          tipo={tipo}
          onCerrar={() =>
            setCamaraAbierta(
              false
            )
          }
          onCapturar={(
            archivo
          ) => {
            setCamaraAbierta(
              false
            );

            onSeleccionar([
              archivo,
            ]);
          }}
        />
      )}
    </>
  );
}

function CamaraEvidencia({
  tipo,
  onCerrar,
  onCapturar,
}: {
  tipo:
    "nota" | "foto";
  onCerrar: () => void;
  onCapturar: (
    archivo: File
  ) => void;
}) {
  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );

  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );

  const streamRef =
    useRef<MediaStream | null>(
      null
    );

  const [
    iniciando,
    setIniciando,
  ] = useState(true);

  const [
    errorCamara,
    setErrorCamara,
  ] = useState("");

  const detenerCamara =
    useCallback(() => {
      const stream =
        streamRef.current;

      if (stream) {
        stream
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );
      }

      streamRef.current =
        null;
    }, []);

  useEffect(() => {
    let activo = true;

    async function iniciarCamara() {
      try {
        setIniciando(true);
        setErrorCamara("");

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices
            .getUserMedia
        ) {
          throw new Error(
            "Este dispositivo o navegador no permite abrir la cámara desde la página."
          );
        }

        const stream =
          await navigator.mediaDevices
            .getUserMedia({
              video: {
                facingMode: {
                  ideal:
                    "environment",
                },
              },
              audio:
                false,
            });

        if (!activo) {
          stream
            .getTracks()
            .forEach(
              (track) =>
                track.stop()
            );
          return;
        }

        streamRef.current =
          stream;

        const video =
          videoRef.current;

        if (video) {
          video.srcObject =
            stream;

          await video.play();
        }
      } catch (
        error: unknown
      ) {
        setErrorCamara(
          error instanceof Error
            ? error.message
            : "No se pudo abrir la cámara."
        );
      } finally {
        if (activo) {
          setIniciando(false);
        }
      }
    }

    void iniciarCamara();

    return () => {
      activo = false;
      detenerCamara();
    };
  }, [detenerCamara]);

  function cerrarCamara() {
    detenerCamara();
    onCerrar();
  }

  function tomarFoto() {
    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;

    if (
      !video ||
      !canvas
    ) {
      return;
    }

    const ancho =
      video.videoWidth;

    const alto =
      video.videoHeight;

    if (
      !ancho ||
      !alto
    ) {
      setErrorCamara(
        "La cámara todavía no está lista."
      );
      return;
    }

    canvas.width =
      ancho;

    canvas.height =
      alto;

    const contexto =
      canvas.getContext(
        "2d"
      );

    if (!contexto) {
      setErrorCamara(
        "No se pudo procesar la fotografía."
      );
      return;
    }

    contexto.drawImage(
      video,
      0,
      0,
      ancho,
      alto
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErrorCamara(
            "No se pudo generar la fotografía."
          );
          return;
        }

        const fecha =
          new Date()
            .toISOString()
            .replace(
              /[:.]/g,
              "-"
            );

        const nombre =
          tipo === "nota"
            ? `nota-camara-${fecha}.jpg`
            : `foto-camara-${fecha}.jpg`;

        const archivo =
          new File(
            [blob],
            nombre,
            {
              type:
                "image/jpeg",
            }
          );

        detenerCamara();

        onCapturar(
          archivo
        );
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div className="fixed inset-0 z-[260] flex flex-col bg-black">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 py-3 text-white">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-cyan-300">
            Cámara VIPACK
          </p>

          <p className="mt-0.5 text-sm font-black">
            {tipo === "nota"
              ? "Fotografiar nota"
              : "Fotografiar mercancía"}
          </p>
        </div>

        <button
          type="button"
          onClick={
            cerrarCamara
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl font-black"
          aria-label="Cerrar cámara"
        >
          ×
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        {iniciando && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black text-sm font-black text-white">
            Abriendo cámara...
          </div>
        )}

        {errorCamara ? (
          <div className="mx-5 max-w-md rounded-2xl border border-red-400/30 bg-red-950/50 p-5 text-center text-white">
            <p className="font-black">
              No se pudo abrir la cámara
            </p>

            <p className="mt-2 text-sm text-red-100">
              {errorCamara}
            </p>

            <p className="mt-3 text-xs text-slate-300">
              Revisa que hayas permitido el acceso a la cámara en tu navegador. También puedes cerrar esta pantalla y usar “Elegir imágenes”.
            </p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-contain"
          />
        )}

        <canvas
          ref={canvasRef}
          className="hidden"
        />
      </div>

      <div className="border-t border-white/10 bg-slate-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            type="button"
            onClick={
              cerrarCamara
            }
            className="h-14 flex-1 rounded-2xl border border-white/20 bg-white/10 text-sm font-black text-white"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={
              iniciando ||
              Boolean(
                errorCamara
              )
            }
            onClick={
              tomarFoto
            }
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-white/20 text-2xl disabled:opacity-40"
            aria-label="Tomar fotografía"
          >
            📷
          </button>

          <div className="flex-1" />
        </div>

        <p className="mt-3 text-center text-[11px] font-semibold text-slate-400">
          La fotografía se subirá a esta recolección al capturarla.
        </p>
      </div>
    </div>
  );
}


function VisorEvidencia({
  folio,
  archivo,
  posicion,
  total,
  onCerrar,
  onAnterior,
  onSiguiente,
}: {
  folio: string;
  archivo:
    EvidenciaArchivo;
  posicion: number;
  total: number;
  onCerrar: () => void;
  onAnterior: () => void;
  onSiguiente: () => void;
}) {
  const src =
    `/api/recolecciones/${encodeURIComponent(
      folio
    )}/evidencias?archivoId=${encodeURIComponent(
      archivo.id
    )}`;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-slate-950">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-xs font-black">
            {
              archivo.nombre
            }
          </p>

          <p className="mt-0.5 text-[11px] text-slate-300">
            {posicion} de{" "}
            {total}
          </p>
        </div>

        <button
          type="button"
          onClick={onCerrar}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xl font-black"
          aria-label="Cerrar visor"
        >
          ×
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-6">
        <img
          key={
            archivo.id
          }
          src={src}
          alt={
            archivo.nombre
          }
          className="max-h-full max-w-full rounded-lg bg-white object-contain shadow-2xl"
        />

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={
                onAnterior
              }
              className="fixed left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl font-black text-white backdrop-blur sm:left-6"
              aria-label="Evidencia anterior"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={
                onSiguiente
              }
              className="fixed right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl font-black text-white backdrop-blur sm:right-6"
              aria-label="Evidencia siguiente"
            >
              ›
            </button>
          </>
        )}
      </div>

      <div className="border-t border-white/10 bg-slate-950 p-3 text-center">
        <button
          type="button"
          onClick={onCerrar}
          className="w-full max-w-sm rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950"
        >
          Cerrar imagen
        </button>
      </div>
    </div>
  );
}

function formatoBytes(
  bytes: number
) {
  if (
    !Number.isFinite(
      bytes
    ) ||
    bytes <= 0
  ) {
    return "Archivo";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}


function EditorRecoleccion({
  item,
  tipo,
  onCerrar,
  onGuardado,
}: {
  item: Recoleccion;
  tipo:
    | "ruta"
    | "estado"
    | "cita";
  onCerrar: () => void;
  onGuardado: (
    cambios: {
      ordenRuta?: string;
      estado?: Estado;
      fechaRecoleccion?: string;
      horaCita?: string;
    }
  ) => Promise<void>;
}) {
  const [
    ruta,
    setRuta,
  ] = useState(
    item.ordenRuta
  );

  const [
    estado,
    setEstado,
  ] = useState<Estado>(
    item.estado
  );

  const [
    fechaRecoleccion,
    setFechaRecoleccion,
  ] = useState(
    fechaParaInput(
      item.fechaRecoleccion
    )
  );

  const [
    horaCita,
    setHoraCita,
  ] = useState(
    item.horaCita
  );

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function guardarRuta(
    valor?: string
  ) {
    try {
      setGuardando(true);
      setError("");

      const nuevaRuta =
        valor !== undefined
          ? valor
          : ruta.trim();

      const response =
        await fetch(
          "/api/recolecciones",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                folio:
                  item.folio,
                ordenRuta:
                  nuevaRuta,
              }),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          error?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "No se pudo actualizar la ruta."
        );
      }

      await onGuardado({
        ordenRuta:
          nuevaRuta,
      });
    } catch (
      e: unknown
    ) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo actualizar la ruta."
      );
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEstado(
    nuevoEstado: Estado
  ) {
    try {
      setGuardando(true);
      setError("");
      setEstado(
        nuevoEstado
      );

      const response =
        await fetch(
          "/api/recolecciones",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                folio:
                  item.folio,
                estado:
                  nuevoEstado,
              }),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          error?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "No se pudo actualizar el estado."
        );
      }

      await onGuardado({
        estado:
          nuevoEstado,
      });
    } catch (
      e: unknown
    ) {
      setEstado(
        item.estado
      );

      setError(
        e instanceof Error
          ? e.message
          : "No se pudo actualizar el estado."
      );
    } finally {
      setGuardando(false);
    }
  }

  async function guardarCita() {
    try {
      setGuardando(true);
      setError("");

      const response =
        await fetch(
          "/api/recolecciones",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                folio:
                  item.folio,
                fechaRecoleccion:
                  fechaRecoleccion.trim(),
                horaCita:
                  horaCita.trim(),
              }),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          error?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "No se pudo actualizar la cita."
        );
      }

      await onGuardado({
        fechaRecoleccion:
          fechaRecoleccion.trim(),
        horaCita:
          horaCita.trim(),
      });
    } catch (
      e: unknown
    ) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo actualizar la cita."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        disabled={guardando}
        className="absolute inset-0"
      />

      <div className="relative z-10 w-full rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">
              {item.folio}
            </p>

            <h3 className="mt-1 text-xl font-black text-slate-950">
              {tipo ===
              "ruta"
                ? item.ordenRuta
                  ? "Cambiar ruta"
                  : "Asignar ruta"
                : tipo ===
                    "estado"
                  ? "Cambiar estado"
                  : "Editar fecha y hora"}
            </h3>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              {item.cliente}
            </p>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl font-black text-slate-600 disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          {tipo ===
          "ruta" ? (
            <>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
                Orden de ruta
              </label>

              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={ruta}
                onChange={(
                  event
                ) =>
                  setRuta(
                    event.target
                      .value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter" &&
                    !guardando
                  ) {
                    void guardarRuta();
                  }
                }}
                placeholder="Ej. 173"
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-lg font-black text-slate-900 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />

              <p className="mt-2 text-xs font-semibold text-slate-500">
                Este número se guardará en la columna “Orden ruta” del Excel.
              </p>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {error}
                </div>
              )}

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={
                    guardando ||
                    !ruta.trim()
                  }
                  onClick={() =>
                    void guardarRuta()
                  }
                  className="rounded-2xl bg-[#072c74] px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {guardando
                    ? "Guardando..."
                    : item.ordenRuta
                      ? "Guardar cambio"
                      : "Asignar ruta"}
                </button>

                {item.ordenRuta && (
                  <button
                    type="button"
                    disabled={
                      guardando
                    }
                    onClick={() => {
                      const confirmar =
                        window.confirm(
                          `¿Quitar la ruta ${item.ordenRuta} de ${item.cliente}?`
                        );

                      if (
                        confirmar
                      ) {
                        void guardarRuta(
                          ""
                        );
                      }
                    }}
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-50"
                  >
                    Quitar ruta
                  </button>
                )}
              </div>
            </>
          ) : tipo ===
            "estado" ? (
            <>
              <p className="mb-3 text-xs font-semibold text-slate-500">
                Selecciona el nuevo estado. El cambio se guardará directamente en el Excel de OneDrive.
              </p>

              <div className="space-y-2">
                {ESTADOS_RECOLECCION.map(
                  (
                    opcion
                  ) => (
                    <button
                      key={
                        opcion
                      }
                      type="button"
                      disabled={
                        guardando
                      }
                      onClick={() => {
                        if (
                          opcion ===
                          item.estado
                        ) {
                          onCerrar();
                          return;
                        }

                        void guardarEstado(
                          opcion
                        );
                      }}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition disabled:opacity-50 ${
                        estado ===
                        opcion
                          ? "border-blue-300 bg-blue-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <EstadoBadge
                        estado={
                          opcion
                        }
                      />

                      <span className="text-xs font-black text-slate-500">
                        {item.estado ===
                        opcion
                          ? "Actual"
                          : guardando &&
                              estado ===
                                opcion
                            ? "Guardando..."
                            : "Elegir"}
                      </span>
                    </button>
                  )
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mb-4 text-xs font-semibold text-slate-500">
                Puedes modificar la fecha de recolección, la hora de cita o ambas. La hora es opcional.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                    Fecha de recolección
                  </label>

                  <input
                    type="date"
                    value={
                      fechaRecoleccion
                    }
                    onChange={(event) =>
                      setFechaRecoleccion(
                        event.target.value
                      )
                    }
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                    Hora de cita
                  </label>

                  <input
                    type="time"
                    value={
                      horaCita
                    }
                    onChange={(event) =>
                      setHoraCita(
                        event.target.value
                      )
                    }
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-violet-700">
                  Cita programada
                </p>

                <p className="mt-1 text-base font-black text-slate-900">
                  {formatoFecha(
                    fechaRecoleccion
                  )}
                </p>

                <p className="mt-1 text-sm font-black text-violet-700">
                  🕐{" "}
                  {formatoHora(
                    horaCita
                  )}
                </p>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {error}
                </div>
              )}

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={
                    guardando
                  }
                  onClick={() =>
                    void guardarCita()
                  }
                  className="rounded-2xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {guardando
                    ? "Guardando..."
                    : "Guardar fecha y hora"}
                </button>

                <button
                  type="button"
                  disabled={
                    guardando ||
                    !horaCita
                  }
                  onClick={() =>
                    setHoraCita("")
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50"
                >
                  Quitar hora
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}


function Dato({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {titulo}
      </p>

      <p className="mt-1 break-words text-sm font-bold text-slate-800">
        {valor || "—"}
      </p>
    </div>
  );
}

function Archivo({
  titulo,
  existe,
}: {
  titulo: string;
  existe: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-black text-slate-500">
        {titulo}
      </p>

      <p
        className={`mt-2 text-sm font-black ${
          existe
            ? "text-emerald-700"
            : "text-amber-700"
        }`}
      >
        {existe
          ? "✓ Registrado"
          : "⚠ Sin archivo"}
      </p>
    </div>
  );
}

function Resumen({
  titulo,
  numero,
  estilo,
}: {
  titulo: string;
  numero: number;
  estilo:
    | "amber"
    | "blue"
    | "green"
    | "red"
    | "orange"
    | "violet"
    | "slate";
}) {
  const estilos = {
    amber:
      "bg-amber-50 text-amber-700",
    blue:
      "bg-blue-50 text-blue-700",
    green:
      "bg-emerald-50 text-emerald-700",
    red:
      "bg-red-50 text-red-700",
    orange:
      "bg-orange-50 text-orange-700",
    violet:
      "bg-violet-50 text-violet-700",
    slate:
      "bg-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span
        className={`rounded-full px-3 py-1 text-xs font-black ${estilos[estilo]}`}
      >
        {titulo}
      </span>

      <p className="mt-4 text-3xl font-black text-slate-950">
        {numero}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        Registros
      </p>
    </div>
  );
}

function MiniResumen({
  numero,
  titulo,
  estilo,
}: {
  numero: number;
  titulo: string;
  estilo:
    | "amber"
    | "blue"
    | "red";
}) {
  const estilos = {
    amber:
      "text-amber-700",
    blue:
      "text-blue-700",
    red:
      "text-red-700",
  };

  return (
    <div className="border-r border-slate-100 px-2 py-2.5 text-center last:border-r-0">
      <p
        className={`text-xl font-black ${estilos[estilo]}`}
      >
        {numero}
      </p>

      <p className="text-[10px] font-bold text-slate-500">
        {titulo}
      </p>
    </div>
  );
}

function Buscar({
  value,
  onChange,
  movil = false,
}: {
  value: string;
  onChange: (
    value: string
  ) => void;
  movil?: boolean;
}) {
  return (
    <div
      className={
        movil
          ? "relative w-full"
          : "relative w-full min-w-[320px] max-w-xl"
      }
    >
      <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
        <IconoBuscar />
      </div>

      <input
        type="search"
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        placeholder="Buscar cliente, folio, bodega, mercancía, ruta u observación..."
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none focus:border-blue-400 focus:bg-white"
      />
    </div>
  );
}

function EstadoBadge({
  estado,
}: {
  estado: Estado;
}) {
  let clase =
    "border-slate-200 bg-slate-100 text-slate-700";

  if (
    estado === "Pendiente"
  ) {
    clase =
      "border-amber-200 bg-amber-50 text-amber-700";
  } else if (
    estado === "En ruta"
  ) {
    clase =
      "border-blue-200 bg-blue-50 text-blue-700";
  } else if (
    estado === "Recolectada"
  ) {
    clase =
      "border-emerald-200 bg-emerald-50 text-emerald-700";
  } else if (
    estado === "No lista"
  ) {
    clase =
      "border-orange-200 bg-orange-50 text-orange-700";
  } else if (
    estado === "Reprogramada"
  ) {
    clase =
      "border-violet-200 bg-violet-50 text-violet-700";
  } else if (
    estado === "Cancelada"
  ) {
    clase =
      "border-red-200 bg-red-50 text-red-700";
  }

  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black ${clase}`}
    >
      {estado}
    </span>
  );
}

function Cargando() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({
        length: 6,
      }).map((_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-2xl bg-slate-100"
        />
      ))}
    </div>
  );
}

function Vacio() {
  return (
    <div className="p-10 text-center">
      <p className="font-black text-slate-800">
        No hay registros
      </p>

      <p className="mt-1 text-sm text-slate-500">
        No encontramos
        recolecciones para esta
        vista.
      </p>
    </div>
  );
}

function IconoRefresh({
  activo,
}: {
  activo: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`h-5 w-5 ${
        activo
          ? "animate-spin"
          : ""
      }`}
    >
      <path d="M20 6v5h-5" />
      <path d="M4 18v-5h5" />
      <path d="M5 9a7 7 0 0 1 12-3l3 5" />
      <path d="M19 15a7 7 0 0 1-12 3l-3-5" />
    </svg>
  );
}

function IconoBuscar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
    >
      <circle
        cx="11"
        cy="11"
        r="7"
      />

      <path d="m20 20-4-4" />
    </svg>
  );
}

function IconoLista() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <path d="M8 6h12" />
      <path d="M8 12h12" />
      <path d="M8 18h12" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

function IconoCheck() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

function IconoPin() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4 shrink-0"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle
        cx="12"
        cy="10"
        r="2.5"
      />
    </svg>
  );
}

function IconoPaquete() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <path d="m3 7 9-4 9 4-9 4-9-4Z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  );
}