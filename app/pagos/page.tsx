"use client";

import { useEffect, useMemo, useState } from "react";

type PagoRow = {
  folio: string;
  cliente: string;
  whatsapp: string;
  fecha: string;

  total: number;
  pagado: number;
  saldo: number;

  estado: "Pendiente" | "Parcial" | "Pagado";

  totalAereo?: number;
  totalTerrestre?: number;
  opciones?: string;
  requiereSeleccionServicio?: boolean;
};

type MetodoPago =
  | "Transferencia"
  | "Efectivo"
  | "Depósito"
  | "Tarjeta"
  | "Otro";

function dinero(valor: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(valor || 0);
}

function EstadoPago({
  estado,
}: {
  estado: PagoRow["estado"];
}) {
  const estilos =
    estado === "Pagado"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : estado === "Parcial"
      ? "bg-blue-100 text-blue-700 border-blue-200"
      : "bg-amber-100 text-amber-700 border-amber-200";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${estilos}`}
    >
      {estado}
    </span>
  );
}

export default function PagosPage() {
  const [pagos, setPagos] =
    useState<PagoRow[]>([]);

  const [busqueda, setBusqueda] =
    useState("");

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] =
    useState("");

  const [seleccionado, setSeleccionado] =
    useState<PagoRow | null>(null);

  const [servicio, setServicio] =
    useState<"Aéreo" | "Terrestre" | "">("");

  const [montoPago, setMontoPago] =
    useState("");

  const [metodoPago, setMetodoPago] =
    useState<MetodoPago>("Transferencia");

  const [referencia, setReferencia] =
    useState("");

  const [observaciones, setObservaciones] =
    useState("");

  const [guardando, setGuardando] =
    useState(false);

  const [errorPago, setErrorPago] =
    useState("");

  useEffect(() => {
    cargarPagos();
  }, []);

  async function cargarPagos() {
    try {
      setCargando(true);
      setError("");

      const respuesta =
        await fetch("/api/pagos", {
          cache: "no-store",
        });

      const data =
        await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          data?.error ||
            "No fue posible cargar los pagos."
        );
      }

      setPagos(
        Array.isArray(data)
          ? data
          : data.pagos || []
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "No fue posible cargar los pagos."
      );

      setPagos([]);
    } finally {
      setCargando(false);
    }
  }

  const filtrados = useMemo(() => {
    const texto =
      busqueda.trim().toLowerCase();

    if (!texto) {
      return pagos;
    }

    return pagos.filter((pago) => {
      return (
        pago.folio
          ?.toLowerCase()
          .includes(texto) ||
        pago.cliente
          ?.toLowerCase()
          .includes(texto) ||
        pago.whatsapp
          ?.toLowerCase()
          .includes(texto)
      );
    });
  }, [pagos, busqueda]);

  const totales = useMemo(() => {
    return pagos.reduce(
      (acc, pago) => {
        acc.cotizado +=
          Number(pago.total || 0);

        acc.cobrado +=
          Number(pago.pagado || 0);

        acc.pendiente +=
          Number(pago.saldo || 0);

        return acc;
      },
      {
        cotizado: 0,
        cobrado: 0,
        pendiente: 0,
      }
    );
  }, [pagos]);

  function abrirPago(
    pago: PagoRow
  ) {
    setSeleccionado(pago);

    setMontoPago("");
    setReferencia("");
    setObservaciones("");
    setMetodoPago("Transferencia");
    setErrorPago("");

    const opciones =
      pago.opciones?.toLowerCase() || "";

    const tieneAereo =
      opciones.includes("aéreo") ||
      opciones.includes("aereo");

    const tieneTerrestre =
      opciones.includes("terrestre");

    if (
      tieneAereo &&
      !tieneTerrestre
    ) {
      setServicio("Aéreo");
    } else if (
      tieneTerrestre &&
      !tieneAereo
    ) {
      setServicio("Terrestre");
    } else {
      setServicio("");
    }
  }

  function cerrarPago() {
    if (guardando) {
      return;
    }

    setSeleccionado(null);
    setErrorPago("");
  }

  const totalSeleccionado =
    useMemo(() => {
      if (!seleccionado) {
        return 0;
      }

      if (seleccionado.total > 0) {
        return seleccionado.total;
      }

      if (servicio === "Aéreo") {
        return Number(
          seleccionado.totalAereo || 0
        );
      }

      if (servicio === "Terrestre") {
        return Number(
          seleccionado.totalTerrestre || 0
        );
      }

      return 0;
    }, [seleccionado, servicio]);

  const saldoActual =
    useMemo(() => {
      if (!seleccionado) {
        return 0;
      }

      if (seleccionado.total > 0) {
        return Number(
          seleccionado.saldo || 0
        );
      }

      return Math.max(
        totalSeleccionado -
          Number(
            seleccionado.pagado || 0
          ),
        0
      );
    }, [
      seleccionado,
      totalSeleccionado,
    ]);

  const pagoCapturado =
    Number(montoPago || 0);

  const nuevoSaldo =
    Math.max(
      saldoActual - pagoCapturado,
      0
    );

  async function guardarPago() {
    if (!seleccionado) {
      return;
    }

    setErrorPago("");

    if (
      totalSeleccionado <= 0
    ) {
      setErrorPago(
        "Selecciona si el cliente pagará Aéreo o Terrestre."
      );

      return;
    }

    if (
      !Number.isFinite(
        pagoCapturado
      ) ||
      pagoCapturado <= 0
    ) {
      setErrorPago(
        "Captura un monto de pago válido."
      );

      return;
    }

    if (
      pagoCapturado >
      saldoActual
    ) {
      setErrorPago(
        `El pago no puede ser mayor al saldo pendiente de ${dinero(
          saldoActual
        )}.`
      );

      return;
    }

    try {
      setGuardando(true);

      const respuesta =
        await fetch(
          "/api/pagos",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              folio:
                seleccionado.folio,

              servicio:
                servicio ||
                seleccionado.opciones,

              total:
                totalSeleccionado,

              monto:
                pagoCapturado,

              metodo:
                metodoPago,

              referencia:
                referencia.trim(),

              observaciones:
                observaciones.trim(),
            }),
          }
        );

      const data =
        await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          data?.error ||
            "No fue posible guardar el pago."
        );
      }

      setSeleccionado(null);

      await cargarPagos();
    } catch (err) {
      console.error(err);

      setErrorPago(
        err instanceof Error
          ? err.message
          : "No fue posible guardar el pago."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">

        {/* ENCABEZADO */}

        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              Ventas y cobranza
            </p>

            <h1 className="mt-1 text-3xl font-black text-slate-950">
              Pagos
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Controla pagos, abonos y saldos pendientes de las cotizaciones.
            </p>
          </div>
        </div>

        {/* RESUMEN */}

        <div className="mb-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total cotizado
            </p>

            <p className="mt-2 text-2xl font-black text-slate-950">
              {dinero(
                totales.cotizado
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Cobrado
            </p>

            <p className="mt-2 text-2xl font-black text-emerald-700">
              {dinero(
                totales.cobrado
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Saldo pendiente
            </p>

            <p className="mt-2 text-2xl font-black text-amber-700">
              {dinero(
                totales.pendiente
              )}
            </p>
          </div>
        </div>

        {/* TABLA */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-black text-slate-950">
                  Cotizaciones y pagos
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Busca por folio, cliente o número de WhatsApp.
                </p>
              </div>

              <input
                value={
                  busqueda
                }
                onChange={(e) =>
                  setBusqueda(
                    e.target.value
                  )
                }
                placeholder="Buscar folio, cliente o teléfono..."
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 md:max-w-md"
              />
            </div>
          </div>

          {cargando ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Cargando pagos...
            </div>
          ) : error ? (
            <div className="p-8">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            </div>
          ) : filtrados.length ===
            0 ? (
            <div className="p-10 text-center">
              <p className="font-bold text-slate-800">
                No hay registros para mostrar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-5 py-3 text-xs font-black uppercase text-slate-500">
                      Folio
                    </th>

                    <th className="px-5 py-3 text-xs font-black uppercase text-slate-500">
                      Cliente
                    </th>

                    <th className="px-5 py-3 text-xs font-black uppercase text-slate-500">
                      Fecha
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-black uppercase text-slate-500">
                      Total
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-black uppercase text-slate-500">
                      Pagado
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-black uppercase text-slate-500">
                      Saldo
                    </th>

                    <th className="px-5 py-3 text-xs font-black uppercase text-slate-500">
                      Estado
                    </th>

                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>

                <tbody>
                  {filtrados.map(
                    (pago) => (
                      <tr
                        key={
                          pago.folio
                        }
                        className="border-b border-slate-100 transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-bold text-blue-800">
                            {
                              pago.folio
                            }
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900">
                            {
                              pago.cliente
                            }
                          </p>

                          <p className="text-xs text-slate-500">
                            {
                              pago.whatsapp
                            }
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {
                            pago.fecha
                          }
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-slate-900">
                          {pago.total >
                          0
                            ? dinero(
                                pago.total
                              )
                            : "Por definir"}
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-emerald-700">
                          {dinero(
                            pago.pagado
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-black text-slate-900">
                          {pago.total >
                          0
                            ? dinero(
                                pago.saldo
                              )
                            : "—"}
                        </td>

                        <td className="px-5 py-4">
                          <EstadoPago
                            estado={
                              pago.estado
                            }
                          />
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              abrirPago(
                                pago
                              )
                            }
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Ver / Abonar
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}

      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                  Registrar pago
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-950">
                  {
                    seleccionado.cliente
                  }
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {
                    seleccionado.folio
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={
                  cerrarPago
                }
                className="rounded-lg px-3 py-2 text-lg font-bold text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 p-5">

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    WhatsApp
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {
                      seleccionado.whatsapp
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Pagado anteriormente
                  </p>

                  <p className="mt-1 font-black text-emerald-700">
                    {dinero(
                      seleccionado.pagado
                    )}
                  </p>
                </div>
              </div>

              {Number(
                seleccionado.totalAereo ||
                  0
              ) > 0 ||
              Number(
                seleccionado.totalTerrestre ||
                  0
              ) > 0 ? (
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-800">
                    Servicio elegido por el cliente
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {Number(
                      seleccionado.totalAereo ||
                        0
                    ) > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setServicio(
                            "Aéreo"
                          )
                        }
                        className={`rounded-xl border p-4 text-left ${
                          servicio ===
                          "Aéreo"
                            ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <p className="font-black text-slate-900">
                          ✈ Aéreo
                        </p>

                        <p className="mt-1 text-xl font-black text-blue-800">
                          {dinero(
                            Number(
                              seleccionado.totalAereo
                            )
                          )}
                        </p>
                      </button>
                    )}

                    {Number(
                      seleccionado.totalTerrestre ||
                        0
                    ) > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setServicio(
                            "Terrestre"
                          )
                        }
                        className={`rounded-xl border p-4 text-left ${
                          servicio ===
                          "Terrestre"
                            ? "border-amber-500 bg-amber-50 ring-2 ring-amber-100"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <p className="font-black text-slate-900">
                          🚚 Terrestre
                        </p>

                        <p className="mt-1 text-xl font-black text-amber-700">
                          {dinero(
                            Number(
                              seleccionado.totalTerrestre
                            )
                          )}
                        </p>
                      </button>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Total
                  </p>

                  <p className="mt-1 text-lg font-black text-slate-950">
                    {dinero(
                      totalSeleccionado
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase text-amber-700">
                    Saldo actual
                  </p>

                  <p className="mt-1 text-lg font-black text-amber-700">
                    {dinero(
                      saldoActual
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-bold uppercase text-emerald-700">
                    Nuevo saldo
                  </p>

                  <p className="mt-1 text-lg font-black text-emerald-700">
                    {dinero(
                      nuevoSaldo
                    )}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">
                  Cantidad que paga ahora
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    montoPago
                  }
                  onChange={(e) =>
                    setMontoPago(
                      e.target.value
                    )
                  }
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-bold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">
                  Método de pago
                </label>

                <select
                  value={
                    metodoPago
                  }
                  onChange={(e) =>
                    setMetodoPago(
                      e.target
                        .value as MetodoPago
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600"
                >
                  <option>
                    Transferencia
                  </option>

                  <option>
                    Efectivo
                  </option>

                  <option>
                    Depósito
                  </option>

                  <option>
                    Tarjeta
                  </option>

                  <option>
                    Otro
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">
                  Referencia
                </label>

                <input
                  value={
                    referencia
                  }
                  onChange={(e) =>
                    setReferencia(
                      e.target.value
                    )
                  }
                  placeholder="Ej. últimos 4 dígitos, folio bancario..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">
                  Observaciones
                </label>

                <textarea
                  value={
                    observaciones
                  }
                  onChange={(e) =>
                    setObservaciones(
                      e.target.value
                    )
                  }
                  placeholder="Opcional"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              {errorPago && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  {errorPago}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={
                  cerrarPago
                }
                disabled={
                  guardando
                }
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={
                  guardarPago
                }
                disabled={
                  guardando
                }
                className="rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardando
                  ? "Guardando..."
                  : "Guardar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}