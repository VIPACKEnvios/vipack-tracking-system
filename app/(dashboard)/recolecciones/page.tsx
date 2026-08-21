"use client";

import {
  useCallback,
  useEffect,
  useMemo,
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
  estado: Estado;
  observaciones: string;
  foto: string;
};

type RespuestaApi = {
  success: boolean;
  registros?: RegistroExcel[];
  error?: string;
};

type VistaMovil =
  | "Solicitudes"
  | "Recolectadas";

type FiltroDesktop =
  | "Activas"
  | "Pendiente"
  | "En ruta"
  | "Recolectada"
  | "Problemas"
  | "Cancelada"
  | "Todas";

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

  let anio = partes[2];

  if (anio.length === 2) {
    anio = `20${anio}`;
  }

  return `${dia}/${mes}/${anio}`;
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

          const response =
            await fetch(
              "/api/recolecciones",
              {
                cache:
                  "no-store",
              }
            );

          const data =
            (await response.json()) as RespuestaApi;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.error ||
                "No se pudieron cargar las recolecciones."
            );
          }

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
            registros
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

      return {
        pendientes,
        enRuta,
        recolectadas,
        problemas,
        canceladas,
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
      return recolecciones.filter(
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

          return (
            item.estado ===
            filtroDesktop
          );
        }
      );
    }, [
      recolecciones,
      coincideBusqueda,
      filtroDesktop,
    ]);

  const movil =
    useMemo(() => {
      return recolecciones.filter(
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

          return esActiva(
            item.estado
          );
        }
      );
    }, [
      recolecciones,
      coincideBusqueda,
      vistaMovil,
    ]);

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

          <div className="mb-6 grid grid-cols-5 gap-3">
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
              <div className="flex items-center justify-between gap-5">
                <div className="flex gap-2">
                  {[
                    "Activas",
                    "Pendiente",
                    "En ruta",
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
                <table className="w-full min-w-[1050px]">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-[11px] font-black uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-4">
                        Ruta
                      </th>

                      <th className="px-5 py-4">
                        Folio
                      </th>

                      <th className="px-5 py-4">
                        Cliente
                      </th>

                      <th className="px-5 py-4">
                        Bodega
                      </th>

                      <th className="px-5 py-4">
                        Mercancía
                      </th>

                      <th className="px-5 py-4">
                        Fecha
                      </th>

                      <th className="px-5 py-4">
                        Estado
                      </th>

                      <th className="px-5 py-4 text-right">
                        Acción
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {desktop.map(
                      (item) => (
                        <tr
                          key={
                            item.folio
                          }
                          className="hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            {item.ordenRuta ? (
                              <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-[#072c74] px-2 font-black text-white">
                                {
                                  item.ordenRuta
                                }
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <p className="text-xs font-black text-[#072c74]">
                              {
                                item.folio
                              }
                            </p>

                            <p className="mt-1 text-[11px] text-slate-400">
                              {
                                item.fechaSolicitud
                              }
                            </p>
                          </td>

                          <td className="px-5 py-4 font-bold text-slate-900">
                            {
                              item.cliente
                            }
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {item.bodega ||
                              "—"}
                          </td>

                          <td className="max-w-[230px] px-5 py-4 text-sm text-slate-600">
                            <p className="truncate">
                              {item.mercancia ||
                                item.cantidad ||
                                "—"}
                            </p>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-600">
                            {formatoFecha(
                              item.fechaRecoleccion
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <EstadoBadge
                              estado={
                                item.estado
                              }
                            />
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setSeleccionada(
                                  item
                                )
                              }
                              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-100"
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      )
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
                    onVer={() =>
                      setSeleccionada(
                        item
                      )
                    }
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
        />
      )}

      {modalNueva && (
        <FormularioNuevaRecoleccion
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
  onCerrar,
  onCreada,
}: {
  onCerrar: () => void;
  onCreada: () => Promise<void>;
}) {
  const [
    cliente,
    setCliente,
  ] = useState("");

  const [
    telefono,
    setTelefono,
  ] = useState("");

  const [
    bodega,
    setBodega,
  ] = useState("");

  const [
    direccion,
    setDireccion,
  ] = useState("");

  const [
    mercancia,
    setMercancia,
  ] = useState("");

  const [
    cantidad,
    setCantidad,
  ] = useState("");

  const [
    fechaRecoleccion,
    setFechaRecoleccion,
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

  async function guardar() {
    const clienteLimpio =
      cliente.trim();

    const bodegaLimpia =
      bodega.trim();

    if (!clienteLimpio) {
      setErrorFormulario(
        "Escribe el nombre del cliente."
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
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
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
          <CampoFormulario
            titulo="Cliente *"
            value={cliente}
            onChange={setCliente}
            placeholder="Nombre completo del cliente"
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
          />

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

function CampoFormulario({
  titulo,
  value,
  onChange,
  placeholder,
  inputMode,
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
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
        {titulo}
      </label>

      <input
        type="text"
        inputMode={inputMode}
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
  onVer,
}: {
  item: Recoleccion;
  onVer: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onVer}
        className="block w-full p-4 text-left"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-[#072c74]">
            {item.ordenRuta ? (
              <span className="text-lg font-black">
                {
                  item.ordenRuta
                }
              </span>
            ) : (
              <IconoPaquete />
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
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs font-bold text-slate-500">
            {formatoFecha(
              item.fechaRecoleccion ||
                item.fechaSolicitud
            )}
          </span>

          <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">
            Ver detalle
          </span>
        </div>
      </button>
    </div>
  );
}

function Detalle({
  item,
  cerrar,
}: {
  item: Recoleccion;
  cerrar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-slate-950/55 md:items-center md:justify-center md:p-5">
      <button
        type="button"
        onClick={cerrar}
        className="absolute inset-0"
        aria-label="Cerrar"
      />

      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white md:max-w-2xl md:rounded-3xl">
        <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white p-5">
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
          <div className="mb-5 flex items-center gap-2">
            <EstadoBadge
              estado={
                item.estado
              }
            />

            {item.ordenRuta && (
              <span className="rounded-full bg-[#072c74] px-3 py-1 text-xs font-black text-white">
                Ruta{" "}
                {
                  item.ordenRuta
                }
              </span>
            )}
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

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Archivo
              titulo="Nota"
              existe={
                Boolean(item.nota)
              }
            />

            <Archivo
              titulo="Foto"
              existe={
                Boolean(item.foto)
              }
            />
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
          : "relative w-96"
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
        placeholder="Buscar cliente, folio o bodega..."
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