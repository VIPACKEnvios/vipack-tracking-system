"use client";

import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

type EstadoBazar =
  | "pendiente"
  | "activo"
  | "rechazado"
  | "suspendido";

type Bazar = {
  id: string;
  folio: string;
  nombre_responsable: string;
  telefono: string;
  direccion: string;
  nombre_bazar: string;
  correo: string | null;
  productos: string;
  facebook: string;
  referencia_1_nombre: string;
  referencia_1_telefono: string;
  referencia_2_nombre: string;
  referencia_2_telefono: string;
  ine_frente_archivo: string | null;
  comprobante_domicilio_archivo: string | null;
  estado: EstadoBazar;
  observaciones: string | null;
  fecha_registro: string;
  fecha_actualizacion: string;
};

type RespuestaApi = {
  success: boolean;
  bazares?: Bazar[];
  total?: number;
  error?: string;
};

type RespuestaEstado = {
  success: boolean;
  error?: string;
  mensaje?: string;
  bazar?: {
    id: string;
    folio: string;
    nombre_bazar: string;
    estado: EstadoBazar;
    observaciones: string | null;
    fecha_actualizacion: string;
  };
};

type HistorialMovimiento = {
  id: string;
  estado_anterior: EstadoBazar | null;
  estado_nuevo: EstadoBazar;
  accion: string;
  observaciones: string | null;
  administrador_nombre: string;
  administrador_firma: string | null;
  fecha_movimiento: string;
};

type FirmaAdministrativa = {
  aprobado_por: string | null;
  firma_administrador: string | null;
  fecha_aprobacion: string | null;
  ultimo_movimiento_por: string | null;
};

type RespuestaHistorial = {
  success: boolean;
  bazar?: FirmaAdministrativa;
  historial?: HistorialMovimiento[];
  total?: number;
  error?: string;
};

const estados: Array<{
  valor: "" | EstadoBazar;
  etiqueta: string;
}> = [
  { valor: "", etiqueta: "Todos los estados" },
  { valor: "pendiente", etiqueta: "Pendientes" },
  { valor: "activo", etiqueta: "Activos" },
  { valor: "rechazado", etiqueta: "Rechazados" },
  { valor: "suspendido", etiqueta: "Suspendidos" },
];
function formatoFecha(fecha: string | null | undefined) {
  if (!fecha) {
    return "Fecha no disponible";
  }

  const fechaConvertida = new Date(fecha);

  if (Number.isNaN(fechaConvertida.getTime())) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(fechaConvertida);
}
export default function AdminBazaresPage() {
  const [bazares, setBazares] = useState<Bazar[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] =
    useState<"" | EstadoBazar>("");

  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");

  const [bazarSeleccionado, setBazarSeleccionado] =
    useState<Bazar | null>(null);

  async function cargarBazares() {
    setCargando(true);
    setMensaje("");

    try {
      const parametros = new URLSearchParams();

      if (busqueda.trim()) {
        parametros.set("buscar", busqueda.trim());
      }

      if (estado) {
        parametros.set("estado", estado);
      }

      const url = parametros.toString()
        ? `/api/admin/bazares?${parametros.toString()}`
        : "/api/admin/bazares";

      const respuesta = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

      const resultado: RespuestaApi =
        await respuesta.json();

      if (!respuesta.ok || !resultado.success) {
        throw new Error(
          resultado.error ||
            "No fue posible cargar los bazares."
        );
      }

      setBazares(resultado.bazares || []);
    } catch (error) {
      console.error("Error cargando bazares:", error);

      setMensaje(
        error instanceof Error
          ? error.message
          : "No fue posible cargar los bazares."
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarBazares();
    // Solo se ejecuta al abrir la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumen = useMemo(() => {
    return {
      total: bazares.length,

      pendientes: bazares.filter(
        (bazar) => bazar.estado === "pendiente"
      ).length,

      activos: bazares.filter(
        (bazar) => bazar.estado === "activo"
      ).length,

      rechazados: bazares.filter(
        (bazar) => bazar.estado === "rechazado"
      ).length,

      suspendidos: bazares.filter(
        (bazar) => bazar.estado === "suspendido"
      ).length,
    };
  }, [bazares]);

  function aplicarBusqueda(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();
    cargarBazares();
  }

  function limpiarFiltros() {
    setBusqueda("");
    setEstado("");

    setTimeout(() => {
      cargarBazares();
    }, 0);
  }

  function actualizarBazarEnPantalla(
    id: string,
    cambios: Partial<Bazar>
  ) {
    setBazares((anteriores) =>
      anteriores.map((bazar) =>
        bazar.id === id
          ? {
              ...bazar,
              ...cambios,
            }
          : bazar
      )
    );

    setBazarSeleccionado((anterior) =>
      anterior?.id === id
        ? {
            ...anterior,
            ...cambios,
          }
        : anterior
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-100 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Administración de Bazares
          </h1>

          <p className="mt-2 text-slate-600">
            Consulta, revisa y administra los bazares
            registrados en VIPACK.
          </p>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <TarjetaResumen
            titulo="Total"
            cantidad={resumen.total}
          />

          <TarjetaResumen
            titulo="Pendientes"
            cantidad={resumen.pendientes}
          />

          <TarjetaResumen
            titulo="Activos"
            cantidad={resumen.activos}
          />

          <TarjetaResumen
            titulo="Rechazados"
            cantidad={resumen.rechazados}
          />

          <TarjetaResumen
            titulo="Suspendidos"
            cantidad={resumen.suspendidos}
          />
        </section>

        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <form
            onSubmit={aplicarBusqueda}
            className="grid gap-4 lg:grid-cols-[1fr_220px_auto_auto]"
          >
            <input
              type="search"
              value={busqueda}
              onChange={(evento) =>
                setBusqueda(evento.target.value)
              }
              placeholder="Buscar por folio, bazar, responsable o teléfono"
              className="rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            />

            <select
              value={estado}
              onChange={(evento) =>
                setEstado(
                  evento.target.value as
                    | ""
                    | EstadoBazar
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            >
              {estados.map((opcion) => (
                <option
                  key={opcion.valor || "todos"}
                  value={opcion.valor}
                >
                  {opcion.etiqueta}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={cargando}
              className="rounded-lg bg-[#072c74] px-6 py-3 font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Buscar
            </button>

            <button
              type="button"
              onClick={limpiarFiltros}
              disabled={cargando}
              className="rounded-lg bg-slate-200 px-6 py-3 font-bold text-slate-800 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Limpiar
            </button>
          </form>
        </section>

        {mensaje && (
          <div className="mb-6 rounded-lg bg-red-100 px-4 py-3 font-semibold text-red-800">
            {mensaje}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {cargando ? (
            <div className="p-10 text-center text-slate-600">
              Cargando bazares...
            </div>
          ) : bazares.length === 0 ? (
            <div className="p-10 text-center text-slate-600">
              No se encontraron bazares.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-[#072c74] text-white">
                  <tr>
                    <th className="px-4 py-4 text-left">
                      Folio
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
                      Estado
                    </th>

                    <th className="px-4 py-4 text-left">
                      Registro
                    </th>

                    <th className="px-4 py-4 text-center">
                      Acción
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {bazares.map((bazar) => (
                    <tr
                      key={bazar.id}
                      className="border-b border-slate-200 hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-800">
                        {bazar.folio}
                      </td>

                      <td className="px-4 py-4 font-medium text-slate-800">
                        {bazar.nombre_bazar}
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        {bazar.nombre_responsable}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                        {bazar.telefono}
                      </td>

                      <td className="px-4 py-4">
                        <EstadoBadge
                          estado={bazar.estado}
                        />
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                        {formatoFecha(
                          bazar.fecha_registro
                        )}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setBazarSeleccionado(bazar)
                          }
                          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-950"
                        >
                          Revisar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {bazarSeleccionado && (
        <DetalleBazar
          bazar={bazarSeleccionado}
          cerrar={() =>
            setBazarSeleccionado(null)
          }
          alActualizar={actualizarBazarEnPantalla}
        />
      )}
    </main>
  );
}

function TarjetaResumen({
  titulo,
  cantidad,
}: {
  titulo: string;
  cantidad: number;
}) {
  return (
    <article className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">
        {titulo}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-900">
        {cantidad}
      </p>
    </article>
  );
}

function EstadoBadge({
  estado,
}: {
  estado: EstadoBazar;
}) {
  const estilos: Record<EstadoBazar, string> = {
    pendiente:
      "bg-amber-100 text-amber-800",
    activo:
      "bg-green-100 text-green-800",
    rechazado:
      "bg-red-100 text-red-800",
    suspendido:
      "bg-slate-200 text-slate-800",
  };

  const etiquetas: Record<EstadoBazar, string> = {
    pendiente: "Pendiente",
    activo: "Activo",
    rechazado: "Rechazado",
    suspendido: "Suspendido",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${estilos[estado]}`}
    >
      {etiquetas[estado]}
    </span>
  );
}

function DetalleBazar({
  bazar,
  cerrar,
  alActualizar,
}: {
  bazar: Bazar;
  cerrar: () => void;
  alActualizar: (
    id: string,
    cambios: Partial<Bazar>
  ) => void;
}) {
  const [observaciones, setObservaciones] =
    useState(bazar.observaciones || "");

  const [guardando, setGuardando] =
    useState(false);

  const [mensajeEstado, setMensajeEstado] =
    useState("");

  const [errorEstado, setErrorEstado] =
    useState("");

  const [historial, setHistorial] =
    useState<HistorialMovimiento[]>([]);

  const [firma, setFirma] =
    useState<FirmaAdministrativa | null>(null);

  const [cargandoHistorial, setCargandoHistorial] =
    useState(true);

  const [errorHistorial, setErrorHistorial] =
    useState("");

  async function cargarHistorial() {
    setCargandoHistorial(true);
    setErrorHistorial("");

    try {
      const respuesta = await fetch(
        `/api/admin/bazares/${bazar.id}/historial`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const resultado: RespuestaHistorial =
        await respuesta.json();

      if (!respuesta.ok || !resultado.success) {
        throw new Error(
          resultado.error ||
            "No fue posible cargar el historial."
        );
      }

      setHistorial(resultado.historial || []);
      setFirma(resultado.bazar || null);
    } catch (error) {
      console.error(
        "Error cargando el historial:",
        error
      );

      setErrorHistorial(
        error instanceof Error
          ? error.message
          : "No fue posible cargar el historial."
      );
    } finally {
      setCargandoHistorial(false);
    }
  }

  useEffect(() => {
    cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bazar.id]);

  async function cambiarEstado(
    nuevoEstado: EstadoBazar
  ) {
    if (guardando) return;

    const nombres: Record<EstadoBazar, string> = {
      pendiente: "Pendiente",
      activo: "Activo",
      rechazado: "Rechazado",
      suspendido: "Suspendido",
    };

    const requiereObservacion =
      nuevoEstado === "rechazado" ||
      nuevoEstado === "suspendido";

    if (
      requiereObservacion &&
      !observaciones.trim()
    ) {
      setErrorEstado(
        "Escribe una observación antes de rechazar o suspender el bazar."
      );
      setMensajeEstado("");
      return;
    }

    const confirmar = window.confirm(
      `¿Confirmas que deseas cambiar el bazar a estado "${nombres[nuevoEstado]}"?`
    );

    if (!confirmar) return;

    setGuardando(true);
    setMensajeEstado("");
    setErrorEstado("");

    try {
      const respuesta = await fetch(
        `/api/admin/bazares/${bazar.id}/estado`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            estado: nuevoEstado,
            observaciones:
              observaciones.trim(),
          }),
        }
      );

      const resultado: RespuestaEstado =
        await respuesta.json();

      if (!respuesta.ok || !resultado.success) {
        throw new Error(
          resultado.error ||
            "No fue posible actualizar el estado."
        );
      }

      alActualizar(bazar.id, {
        estado: nuevoEstado,

        observaciones:
          observaciones.trim() || null,

        fecha_actualizacion:
          resultado.bazar?.fecha_actualizacion ||
          new Date().toISOString(),
      });

      setMensajeEstado(
        `El bazar cambió correctamente a estado ${nombres[nuevoEstado]}.`
      );

      await cargarHistorial();
    } catch (error) {
      console.error(
        "Error actualizando el bazar:",
        error
      );

      setErrorEstado(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar el estado."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle del bazar ${bazar.nombre_bazar}`}
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between bg-[#072c74] px-6 py-5 text-white">
          <div>
            <h2 className="text-2xl font-bold">
              {bazar.nombre_bazar}
            </h2>

            <p className="mt-1 text-sm text-blue-100">
              {bazar.folio}
            </p>
          </div>

          <button
            type="button"
            onClick={cerrar}
            disabled={guardando}
            className="rounded-lg bg-white/10 px-4 py-2 font-bold hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cerrar
          </button>
        </header>

        <div className="space-y-6 p-6">
          <div className="rounded-xl bg-slate-100 p-4">
            <p className="text-sm font-semibold text-slate-600">
              Estado actual
            </p>

            <div className="mt-2">
              <EstadoBadge estado={bazar.estado} />
            </div>
          </div>

          <SeccionDetalle titulo="Datos del responsable">
            <Dato
              etiqueta="Nombre"
              valor={bazar.nombre_responsable}
            />

            <Dato
              etiqueta="Teléfono"
              valor={bazar.telefono}
            />

            <Dato
              etiqueta="Correo"
              valor={
                bazar.correo || "No proporcionado"
              }
            />

            <Dato
              etiqueta="Dirección"
              valor={bazar.direccion}
            />
          </SeccionDetalle>

          <SeccionDetalle titulo="Información del bazar">
            <Dato
              etiqueta="Nombre del bazar"
              valor={bazar.nombre_bazar}
            />

            <Dato
              etiqueta="Productos"
              valor={bazar.productos}
            />

            <div>
              <p className="text-xs font-bold uppercase text-slate-500">
                Facebook
              </p>

              {bazar.facebook ? (
                <a
                  href={bazar.facebook}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block break-all font-semibold text-blue-700 underline"
                >
                  Abrir página de Facebook
                </a>
              ) : (
                <p className="mt-1 text-slate-800">
                  No proporcionado
                </p>
              )}
            </div>
          </SeccionDetalle>

          <SeccionDetalle titulo="Referencias">
            <Dato
              etiqueta="Referencia 1"
              valor={`${bazar.referencia_1_nombre} — ${bazar.referencia_1_telefono}`}
            />

            <Dato
              etiqueta="Referencia 2"
              valor={`${bazar.referencia_2_nombre} — ${bazar.referencia_2_telefono}`}
            />
          </SeccionDetalle>

          <SeccionDetalle titulo="Documentos">
            <Documento
              etiqueta="INE por el frente"
              ruta={bazar.ine_frente_archivo}
            />

            <Documento
              etiqueta="Comprobante de domicilio"
              ruta={
                bazar.comprobante_domicilio_archivo
              }
            />
          </SeccionDetalle>

          <section>
            <h3 className="mb-4 border-b pb-2 text-lg font-bold text-slate-800">
              Firma administrativa
            </h3>

            {cargandoHistorial ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-500">
                Cargando firma administrativa...
              </div>
            ) : (
              <div className="grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 md:grid-cols-2">
                <Dato
                  etiqueta="Aprobado por"
                  valor={firma?.aprobado_por || "Pendiente"}
                />

                <Dato
                  etiqueta="Firma"
                  valor={
                    firma?.firma_administrador ||
                    "Sin firma"
                  }
                />

                <Dato
                  etiqueta="Fecha de aprobación"
                  valor={
                    firma?.fecha_aprobacion
                      ? formatoFecha(
                          firma.fecha_aprobacion
                        )
                      : "Sin aprobar"
                  }
                />

                <Dato
                  etiqueta="Último movimiento por"
                  valor={
                    firma?.ultimo_movimiento_por ||
                    "Sin movimientos"
                  }
                />
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-2">
              <h3 className="text-lg font-bold text-slate-800">
                Historial del expediente
              </h3>

              <button
                type="button"
                onClick={cargarHistorial}
                disabled={cargandoHistorial}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cargandoHistorial
                  ? "Actualizando..."
                  : "Actualizar historial"}
              </button>
            </div>

            {errorHistorial && (
              <div className="mb-4 rounded-lg bg-red-100 px-4 py-3 text-sm font-semibold text-red-800">
                {errorHistorial}
              </div>
            )}

            {cargandoHistorial ? (
              <p className="text-slate-500">
                Cargando historial...
              </p>
            ) : historial.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-500">
                No existen movimientos registrados.
              </div>
            ) : (
              <div className="space-y-4">
                {historial.map(
                  (movimiento, indice) => (
                    <div
                      key={movimiento.id}
                      className="relative rounded-xl border border-slate-200 bg-white p-4 pl-12 shadow-sm"
                    >
                      <span
                        className={`absolute left-4 top-5 h-4 w-4 rounded-full ${
                          movimiento.estado_nuevo ===
                          "activo"
                            ? "bg-emerald-500"
                            : movimiento.estado_nuevo ===
                              "rechazado"
                            ? "bg-red-500"
                            : movimiento.estado_nuevo ===
                              "suspendido"
                            ? "bg-slate-700"
                            : "bg-amber-500"
                        }`}
                      />

                      {indice < historial.length - 1 && (
                        <span className="absolute bottom-[-18px] left-[23px] top-9 w-px bg-slate-300" />
                      )}

                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <p className="font-bold text-slate-900">
                            {movimiento.accion}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            {movimiento.estado_anterior ||
                              "Sin estado"}
                            {" → "}
                            {movimiento.estado_nuevo}
                          </p>
                        </div>

                        <EstadoBadge
                          estado={
                            movimiento.estado_nuevo
                          }
                        />
                      </div>

                      {movimiento.observaciones && (
                        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {movimiento.observaciones}
                        </p>
                      )}

                      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                        <p>
                          Administrador:{" "}
                          <span className="font-semibold text-slate-700">
                            {
                              movimiento.administrador_nombre
                            }
                          </span>
                        </p>

                        <p>
                          Fecha:{" "}
                          <span className="font-semibold text-slate-700">
                            {formatoFecha(
                              movimiento.fecha_movimiento
                            )}
                          </span>
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-4 border-b pb-2 text-lg font-bold text-slate-800">
              Revisión administrativa
            </h3>

            <label
              htmlFor="observaciones"
              className="mb-2 block font-semibold text-slate-700"
            >
              Observaciones
            </label>

            <textarea
              id="observaciones"
              value={observaciones}
              onChange={(evento) =>
                setObservaciones(
                  evento.target.value
                )
              }
              rows={4}
              placeholder="Escribe el motivo del rechazo, suspensión o alguna nota interna."
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            />

            <p className="mt-2 text-sm text-slate-500">
              Las observaciones son internas. Para rechazar
              o suspender el bazar, debes escribir el motivo.
            </p>
          </section>

          {mensajeEstado && (
            <div className="rounded-lg bg-green-100 px-4 py-3 text-sm font-semibold text-green-800">
              {mensajeEstado}
            </div>
          )}

          {errorEstado && (
            <div className="rounded-lg bg-red-100 px-4 py-3 text-sm font-semibold text-red-800">
              {errorEstado}
            </div>
          )}

          <section>
            <h3 className="mb-4 text-lg font-bold text-slate-800">
              Cambiar estado
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={
                  guardando ||
                  bazar.estado === "activo"
                }
                onClick={() =>
                  cambiarEstado("activo")
                }
                className="rounded-lg bg-green-700 px-5 py-3 font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {guardando
                  ? "Guardando..."
                  : "Aprobar bazar"}
              </button>

              <button
                type="button"
                disabled={
                  guardando ||
                  bazar.estado === "rechazado"
                }
                onClick={() =>
                  cambiarEstado("rechazado")
                }
                className="rounded-lg bg-red-700 px-5 py-3 font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Rechazar
              </button>

              <button
                type="button"
                disabled={
                  guardando ||
                  bazar.estado === "suspendido"
                }
                onClick={() =>
                  cambiarEstado("suspendido")
                }
                className="rounded-lg bg-slate-800 px-5 py-3 font-bold text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Suspender
              </button>

              <button
                type="button"
                disabled={
                  guardando ||
                  bazar.estado === "pendiente"
                }
                onClick={() =>
                  cambiarEstado("pendiente")
                }
                className="rounded-lg bg-amber-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Regresar a pendiente
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SeccionDetalle({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-4 border-b pb-2 text-lg font-bold text-slate-800">
        {titulo}
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function Dato({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-slate-500">
        {etiqueta}
      </p>

      <p className="mt-1 break-words text-slate-800">
        {valor}
      </p>
    </div>
  );
}

function Documento({
  etiqueta,
  ruta,
}: {
  etiqueta: string;
  ruta: string | null;
}) {
  const [abriendo, setAbriendo] =
    useState(false);

  const [errorDocumento, setErrorDocumento] =
    useState("");

  const nombreArchivo = ruta
    ? ruta.split("/").pop() || ruta
    : "";

  async function abrirDocumento() {
    if (!ruta || abriendo) return;

    setAbriendo(true);
    setErrorDocumento("");

    try {
      const parametros = new URLSearchParams({
        ruta,
      });

      const respuesta = await fetch(
        `/api/admin/bazares/documento?${parametros.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const resultado = await respuesta.json();

      if (
        !respuesta.ok ||
        !resultado.success ||
        !resultado.url
      ) {
        throw new Error(
          resultado.error ||
            "No fue posible abrir el documento."
        );
      }

      const ventana = window.open(
        resultado.url,
        "_blank"
      );

      if (ventana) {
        ventana.opener = null;
      } else {
        throw new Error(
          "El navegador bloqueó la nueva pestaña. Permite las ventanas emergentes para este sitio."
        );
      }
    } catch (error) {
      console.error(
        "Error abriendo documento:",
        error
      );

      setErrorDocumento(
        error instanceof Error
          ? error.message
          : "No fue posible abrir el documento."
      );
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">
        {etiqueta}
      </p>

      {ruta ? (
        <>
          <p className="mt-2 break-all text-sm font-semibold text-slate-800">
            {nombreArchivo}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Documento privado almacenado en Supabase.
          </p>

          <button
            type="button"
            onClick={abrirDocumento}
            disabled={abriendo}
            className="mt-4 w-full rounded-lg bg-[#072c74] px-4 py-2.5 font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {abriendo
              ? "Abriendo documento..."
              : `Ver ${etiqueta}`}
          </button>

          {errorDocumento && (
            <p className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-800">
              {errorDocumento}
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-slate-700">
          No disponible
        </p>
      )}
    </div>
  );
}