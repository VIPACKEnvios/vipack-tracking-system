"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type SolicitudCliente = {
  id: number;
  folio: string;
  nombre: string;
  telefono: string;
  direccion: string;
  referencia_domicilio: string;
  estado:
    | "pendiente"
    | "aprobado"
    | "rechazado"
    | "archivado";
  id_cliente_asignado:
    number | null;
  carpeta_cliente:
    string | null;
  created_at: string;
};

type RespuestaSolicitudes = {
  success: boolean;
  solicitudes?:
    SolicitudCliente[];
  error?: string;
};

type RespuestaAprobar = {
  success: boolean;
  error?: string;
  detalle?: string;
  requiere_revision?:
    boolean;
  cliente?: {
    id_cliente: number;
    nombre: string;
    carpeta_cliente: string;
    onedrive_folder_id:
      string;
    token_inventario:
      string;
  };
};

export default function ClientesPage() {
  const [
    solicitudes,
    setSolicitudes,
  ] =
    useState<
      SolicitudCliente[]
    >([]);

  const [
    cargando,
    setCargando,
  ] =
    useState(true);

  const [
    aprobando,
    setAprobando,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    mensaje,
    setMensaje,
  ] =
    useState("");

  const [
    busqueda,
    setBusqueda,
  ] =
    useState("");

  const [
    estado,
    setEstado,
  ] =
    useState(
      "pendiente"
    );

  const [
    seleccionada,
    setSeleccionada,
  ] =
    useState<
      SolicitudCliente | null
    >(null);

  async function cargarSolicitudes() {
    try {
      setCargando(
        true
      );
      setError("");

      const response =
        await fetch(
          `/api/clientes/solicitudes?estado=${encodeURIComponent(
            estado
          )}`,
          {
            cache:
              "no-store",
          }
        );

      const data:
        RespuestaSolicitudes =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "No se pudieron cargar las solicitudes."
        );
      }

      const lista =
        Array.isArray(
          data.solicitudes
        )
          ? data.solicitudes
          : [];

      setSolicitudes(
        lista
      );

      setSeleccionada(
        (actual) => {
          if (
            !actual
          ) {
            return null;
          }

          return (
            lista.find(
              (item) =>
                item.id ===
                actual.id
            ) ||
            null
          );
        }
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las solicitudes."
      );
    } finally {
      setCargando(
        false
      );
    }
  }

  useEffect(() => {
    setMensaje("");
    cargarSolicitudes();
  }, [estado]);

  const solicitudesFiltradas =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();

      if (!texto) {
        return solicitudes;
      }

      return solicitudes.filter(
        (item) =>
          item.nombre
            .toLowerCase()
            .includes(
              texto
            ) ||
          item.telefono.includes(
            texto
          ) ||
          item.folio
            .toLowerCase()
            .includes(
              texto
            )
      );
    }, [
      solicitudes,
      busqueda,
    ]);

  function formatearFecha(
    valor: string
  ) {
    try {
      return new Intl.DateTimeFormat(
        "es-MX",
        {
          dateStyle:
            "medium",
          timeStyle:
            "short",
        }
      ).format(
        new Date(
          valor
        )
      );
    } catch {
      return valor;
    }
  }

  async function crearCliente() {
    if (
      !seleccionada ||
      aprobando
    ) {
      return;
    }

    const confirmar =
      window.confirm(
        `¿Crear al cliente "${seleccionada.nombre}"?\n\nSe asignará el siguiente número disponible, se agregará al Excel y se creará su carpeta en OneDrive.`
      );

    if (
      !confirmar
    ) {
      return;
    }

    try {
      setAprobando(
        true
      );
      setMensaje("");
      setError("");

      const response =
        await fetch(
          "/api/clientes/aprobar",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                solicitud_id:
                  seleccionada.id,
              }),
          }
        );

      const data:
        RespuestaAprobar =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.detalle
            ? `${data.error || "No se pudo crear el cliente."} — ${data.detalle}`
            : data.error ||
                "No se pudo crear el cliente."
        );
      }

      const cliente =
        data.cliente;

      setMensaje(
        cliente
          ? `Cliente creado correctamente. #${String(
              cliente.id_cliente
            ).padStart(
              5,
              "0"
            )} · ${cliente.carpeta_cliente}`
          : "Cliente creado correctamente."
      );

      /*
       * Como la solicitud deja de ser pendiente,
       * recargamos la lista y limpiamos selección.
       */
      setSeleccionada(
        null
      );

      await cargarSolicitudes();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo crear el cliente."
      );
    } finally {
      setAprobando(
        false
      );
    }
  }

  return (
    <div className="min-h-full bg-slate-100 px-3 py-5 sm:px-5 md:px-7">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
              Centro de Operaciones
            </p>

            <h1 className="mt-1 text-3xl font-black text-slate-950">
              Clientes
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Revisa las solicitudes antes de crear el número de cliente,
              agregarlo al Excel y generar su carpeta en OneDrive.
            </p>
          </div>

          <button
            type="button"
            onClick={
              cargarSolicitudes
            }
            disabled={
              cargando ||
              aprobando
            }
            className="rounded-xl bg-[#072c74] px-5 py-3 text-sm font-black text-white shadow-md transition hover:bg-blue-900 disabled:opacity-50"
          >
            {cargando
              ? "Actualizando..."
              : "Actualizar"}
          </button>
        </div>

        {mensaje && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            {mensaje}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3">
              <input
                value={
                  busqueda
                }
                onChange={(
                  event
                ) =>
                  setBusqueda(
                    event.target.value
                  )
                }
                placeholder="Buscar por nombre, teléfono o folio..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
              />

              <select
                value={
                  estado
                }
                onChange={(
                  event
                ) =>
                  setEstado(
                    event.target.value
                  )
                }
                disabled={
                  aprobando
                }
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none focus:border-cyan-500 disabled:opacity-50"
              >
                <option value="pendiente">
                  Pendientes
                </option>
                <option value="aprobado">
                  Aprobados
                </option>
                <option value="rechazado">
                  Rechazados
                </option>
                <option value="archivado">
                  Archivados
                </option>
              </select>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm font-black text-slate-800">
                Solicitudes
              </p>

              <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">
                {
                  solicitudesFiltradas.length
                }
              </span>
            </div>

            <div className="mt-3 max-h-[650px] space-y-2 overflow-y-auto pr-1">
              {cargando && (
                <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
                  Cargando...
                </div>
              )}

              {!cargando &&
                !error &&
                solicitudesFiltradas.length ===
                  0 && (
                  <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
                    No hay solicitudes en este estado.
                  </div>
                )}

              {solicitudesFiltradas.map(
                (item) => {
                  const activa =
                    seleccionada
                      ?.id ===
                    item.id;

                  return (
                    <button
                      key={
                        item.id
                      }
                      type="button"
                      disabled={
                        aprobando
                      }
                      onClick={() => {
                        setSeleccionada(
                          item
                        );
                        setMensaje("");
                        setError("");
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition disabled:opacity-60 ${
                        activa
                          ? "border-cyan-500 bg-cyan-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">
                            {
                              item.nombre
                            }
                          </p>

                          <p className="mt-1 text-xs font-bold text-cyan-700">
                            {
                              item.folio
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {
                              item.telefono
                            }
                          </p>
                        </div>

                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            item.estado ===
                            "aprobado"
                              ? "bg-emerald-500"
                              : item.estado ===
                                  "pendiente"
                              ? "bg-amber-400"
                              : "bg-slate-400"
                          }`}
                        />
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {!seleccionada ? (
              <div className="flex min-h-[520px] items-center justify-center">
                <div className="max-w-md text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-2xl">
                    👤
                  </div>

                  <h2 className="mt-4 text-2xl font-black text-slate-900">
                    Selecciona una solicitud
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Revisa todos los datos antes de aprobar al cliente.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-slate-200 pb-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
                    Solicitud de cliente
                  </p>

                  <h2 className="mt-1 text-2xl font-black text-slate-950">
                    {
                      seleccionada.nombre
                    }
                  </h2>

                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {
                      seleccionada.folio
                    }
                  </p>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Dato
                    titulo="Teléfono / WhatsApp"
                    valor={
                      seleccionada.telefono
                    }
                  />

                  <Dato
                    titulo="Fecha de registro"
                    valor={formatearFecha(
                      seleccionada.created_at
                    )}
                  />

                  <div className="md:col-span-2">
                    <Dato
                      titulo="Dirección"
                      valor={
                        seleccionada.direccion
                      }
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Dato
                      titulo="Referencia del domicilio"
                      valor={
                        seleccionada.referencia_domicilio
                      }
                    />
                  </div>
                </div>

                {seleccionada.estado ===
                  "pendiente" && (
                  <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
                    <p className="font-black text-amber-950">
                      Pendiente de aprobación
                    </p>

                    <p className="mt-2 text-sm leading-6 text-amber-800">
                      Al crear el cliente, VIPACK asignará el siguiente
                      número disponible, agregará la fila al Excel,
                      creará la carpeta física en OneDrive y habilitará
                      su inventario.
                    </p>

                    <button
                      type="button"
                      onClick={
                        crearCliente
                      }
                      disabled={
                        aprobando
                      }
                      className="mt-5 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-4 text-base font-black text-white shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {aprobando
                        ? "Creando cliente..."
                        : "Crear cliente"}
                    </button>
                  </div>
                )}

                {seleccionada.estado ===
                  "aprobado" && (
                  <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                    <p className="font-black text-emerald-950">
                      Cliente aprobado
                    </p>

                    <p className="mt-2 text-sm text-emerald-800">
                      ID asignado:{" "}
                      {seleccionada.id_cliente_asignado ??
                        "—"}
                    </p>

                    <p className="mt-1 text-sm text-emerald-800">
                      Carpeta:{" "}
                      {seleccionada.carpeta_cliente ||
                        "—"}
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
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
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {titulo}
      </p>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm font-bold leading-6 text-slate-900">
        {valor || "—"}
      </p>
    </div>
  );
}