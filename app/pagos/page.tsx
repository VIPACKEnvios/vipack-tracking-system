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
      className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${estilos}`}
    >
      {estado}
    </span>
  );
}

export default function PagosPage() {
  const [pagos, setPagos] = useState<PagoRow[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [seleccionado, setSeleccionado] =
    useState<PagoRow | null>(null);

  const [servicio, setServicio] =
    useState<"Aéreo" | "Terrestre" | "">("");

  const [montoPago, setMontoPago] = useState("");

  const [metodoPago, setMetodoPago] =
    useState<MetodoPago>("Transferencia");

  const [referencia, setReferencia] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [comprobante, setComprobante] =
    useState<File | null>(null);

  const [previewComprobante, setPreviewComprobante] =
    useState("");

  const [guardando, setGuardando] = useState(false);
  const [errorPago, setErrorPago] = useState("");
  const [mensajePago, setMensajePago] = useState("");

  useEffect(() => {
    cargarPagos();
  }, []);

  useEffect(() => {
    return () => {
      if (previewComprobante) {
        URL.revokeObjectURL(previewComprobante);
      }
    };
  }, [previewComprobante]);

  async function cargarPagos() {
    try {
      setCargando(true);
      setError("");

      const respuesta = await fetch("/api/pagos", {
        cache: "no-store",
      });

      const data = await respuesta.json();

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

  function limpiarComprobante() {
    if (previewComprobante) {
      URL.revokeObjectURL(
        previewComprobante
      );
    }

    setComprobante(null);
    setPreviewComprobante("");
  }

  function abrirPago(pago: PagoRow) {
    limpiarComprobante();

    setSeleccionado(pago);
    setMontoPago("");
    setReferencia("");
    setObservaciones("");
    setMetodoPago("Transferencia");
    setErrorPago("");
    setMensajePago("");

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

    limpiarComprobante();

    setSeleccionado(null);
    setServicio("");
    setMontoPago("");
    setReferencia("");
    setObservaciones("");
    setErrorPago("");
    setMensajePago("");
  }

  function seleccionarComprobante(
    archivo: File | null
  ) {
    if (!archivo) {
      return;
    }

    setErrorPago("");

    const tiposPermitidos = [
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
      setErrorPago(
        "El comprobante debe ser una imagen JPG, PNG o WEBP."
      );

      return;
    }

    if (
      archivo.size >
      10 * 1024 * 1024
    ) {
      setErrorPago(
        "La imagen no puede pesar más de 10 MB."
      );

      return;
    }

    if (previewComprobante) {
      URL.revokeObjectURL(
        previewComprobante
      );
    }

    setComprobante(archivo);

    setPreviewComprobante(
      URL.createObjectURL(archivo)
    );
  }

  function quitarComprobante() {
    limpiarComprobante();
  }

  const totalSeleccionado =
    useMemo(() => {
      if (!seleccionado) {
        return 0;
      }

      if (
        seleccionado.total > 0
      ) {
        return seleccionado.total;
      }

      if (
        servicio === "Aéreo"
      ) {
        return Number(
          seleccionado.totalAereo || 0
        );
      }

      if (
        servicio === "Terrestre"
      ) {
        return Number(
          seleccionado.totalTerrestre || 0
        );
      }

      return 0;
    }, [
      seleccionado,
      servicio,
    ]);

  const saldoActual =
    useMemo(() => {
      if (!seleccionado) {
        return 0;
      }

      if (
        seleccionado.total > 0
      ) {
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
      saldoActual -
        pagoCapturado,
      0
    );

  async function guardarPago() {
    if (!seleccionado) {
      return;
    }

    setErrorPago("");
    setMensajePago("");

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

      const formData =
        new FormData();

      formData.append(
        "folio",
        seleccionado.folio
      );

      formData.append(
        "servicio",
        servicio ||
          seleccionado.opciones ||
          ""
      );

      formData.append(
        "total",
        String(
          totalSeleccionado
        )
      );

      formData.append(
        "monto",
        String(
          pagoCapturado
        )
      );

      formData.append(
        "metodo",
        metodoPago
      );

      formData.append(
        "referencia",
        referencia.trim()
      );

      formData.append(
        "observaciones",
        observaciones.trim()
      );

      if (comprobante) {
        formData.append(
          "comprobante",
          comprobante
        );
      }

      const respuesta =
        await fetch(
          "/api/pagos",
          {
            method: "POST",
            body: formData,
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

      setMensajePago(
        "Pago guardado correctamente."
      );

      limpiarComprobante();

      await cargarPagos();

      setTimeout(() => {
        setSeleccionado(null);
        setMensajePago("");
      }, 900);
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
    <main className="min-h-[calc(100vh-4rem)] overflow-x-hidden bg-slate-100 p-3 sm:p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl">

        {/* ENCABEZADO */}

        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              Ventas y cobranza
            </p>

            <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
              Pagos
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Controla pagos, abonos y saldos pendientes de las cotizaciones.
            </p>
          </div>
        </div>

        {/* RESUMEN */}

        <div className="mb-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total cotizado
            </p>

            <p className="mt-2 break-words text-xl font-black text-slate-950 sm:text-2xl">
              {dinero(
                totales.cotizado
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Cobrado
            </p>

            <p className="mt-2 break-words text-xl font-black text-emerald-700 sm:text-2xl">
              {dinero(
                totales.cobrado
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Saldo pendiente
            </p>

            <p className="mt-2 break-words text-xl font-black text-amber-700 sm:text-2xl">
              {dinero(
                totales.pendiente
              )}
            </p>
          </div>
        </div>

        {/* COTIZACIONES Y PAGOS */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* BUSCADOR */}

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
                value={busqueda}
                onChange={(e) =>
                  setBusqueda(
                    e.target.value
                  )
                }
                placeholder="Buscar folio, cliente o teléfono..."
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 md:max-w-md"
              />
            </div>
          </div>

          {cargando ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Cargando pagos...
            </div>
          ) : error ? (
            <div className="p-4 md:p-8">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-bold text-slate-800">
                No hay registros para mostrar.
              </p>
            </div>
          ) : (
            <>
              {/* =========================================
                  CELULAR
              ========================================== */}

              <div className="divide-y divide-slate-200 md:hidden">
                {filtrados.map((pago) => (
                  <div
                    key={pago.folio}
                    className="p-4"
                  >
                    {/* FOLIO Y ESTADO */}

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Folio
                        </p>

                        <p className="mt-1 break-all text-sm font-black leading-snug text-blue-800">
                          {pago.folio}
                        </p>
                      </div>

                      <div className="shrink-0">
                        <EstadoPago
                          estado={pago.estado}
                        />
                      </div>
                    </div>

                    {/* CLIENTE */}

                    <div className="mt-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Cliente
                      </p>

                      <p className="mt-1 break-words text-base font-black leading-snug text-slate-950">
                        {pago.cliente}
                      </p>

                      <p className="mt-1 break-all text-xs text-slate-500">
                        {pago.whatsapp}
                      </p>
                    </div>

                    {/* FECHA */}

                    <div className="mt-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Fecha
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {pago.fecha}
                      </p>
                    </div>

                    {/* CANTIDADES */}

                    <div className="mt-4 grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
                      <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                          Total
                        </p>

                        <p className="mt-1 break-words text-sm font-black text-slate-950">
                          {pago.total > 0
                            ? dinero(
                                pago.total
                              )
                            : "Por definir"}
                        </p>
                      </div>

                      <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">
                          Pagado
                        </p>

                        <p className="mt-1 break-words text-sm font-black text-emerald-700">
                          {dinero(
                            pago.pagado
                          )}
                        </p>
                      </div>

                      <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">
                          Saldo
                        </p>

                        <p className="mt-1 break-words text-sm font-black text-amber-700">
                          {pago.total > 0
                            ? dinero(
                                pago.saldo
                              )
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {/* BOTÓN */}

                    <button
                      type="button"
                      onClick={() =>
                        abrirPago(
                          pago
                        )
                      }
                      className="mt-4 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
                    >
                      Ver / Abonar
                    </button>
                  </div>
                ))}
              </div>

              {/* =========================================
                  TABLET / COMPUTADORA
              ========================================== */}

              <div className="hidden overflow-x-auto md:block">
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
                            {pago.total > 0
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
                            {pago.total > 0
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
            </>
          )}
        </div>
      </div>

      {/* =========================================
          MODAL
      ========================================== */}

      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">

          <div className="max-h-[96vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-h-[95vh] sm:max-w-2xl sm:rounded-2xl">

            {/* CABECERA */}

            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-4 sm:p-5">
              <div className="min-w-0 pr-3">
                <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                  Registrar pago
                </p>

                <h2 className="mt-1 break-words text-lg font-black text-slate-950 sm:text-xl">
                  {
                    seleccionado.cliente
                  }
                </h2>

                <p className="mt-1 break-all text-xs text-slate-500 sm:text-sm">
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
                disabled={
                  guardando
                }
                className="shrink-0 rounded-lg px-3 py-2 text-xl font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 p-4 sm:p-5">

              {/* CLIENTE */}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    WhatsApp
                  </p>

                  <p className="mt-1 break-all font-bold text-slate-900">
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

              {/* SERVICIO */}

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
                        disabled={
                          guardando
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
                        disabled={
                          guardando
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

              {/* TOTALES */}

              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-3 sm:p-4">
                  <p className="text-[10px] font-bold uppercase text-slate-500 sm:text-xs">
                    Total
                  </p>

                  <p className="mt-1 break-words text-base font-black text-slate-950 sm:text-lg">
                    {dinero(
                      totalSeleccionado
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
                  <p className="text-[10px] font-bold uppercase text-amber-700 sm:text-xs">
                    Saldo actual
                  </p>

                  <p className="mt-1 break-words text-base font-black text-amber-700 sm:text-lg">
                    {dinero(
                      saldoActual
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
                  <p className="text-[10px] font-bold uppercase text-emerald-700 sm:text-xs">
                    Nuevo saldo
                  </p>

                  <p className="mt-1 break-words text-base font-black text-emerald-700 sm:text-lg">
                    {dinero(
                      nuevoSaldo
                    )}
                  </p>
                </div>
              </div>

              {/* MONTO */}

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">
                  Cantidad que paga ahora
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={
                    montoPago
                  }
                  disabled={
                    guardando
                  }
                  onChange={(e) =>
                    setMontoPago(
                      e.target.value
                    )
                  }
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-bold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                />
              </div>

              {/* MÉTODO */}

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">
                  Método de pago
                </label>

                <select
                  value={
                    metodoPago
                  }
                  disabled={
                    guardando
                  }
                  onChange={(e) =>
                    setMetodoPago(
                      e.target
                        .value as MetodoPago
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600 disabled:bg-slate-100"
                >
                  <option value="Transferencia">
                    Transferencia
                  </option>

                  <option value="Efectivo">
                    Efectivo
                  </option>

                  <option value="Depósito">
                    Depósito
                  </option>

                  <option value="Tarjeta">
                    Tarjeta
                  </option>

                  <option value="Otro">
                    Otro
                  </option>
                </select>
              </div>

              {/* REFERENCIA */}

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">
                  Referencia
                </label>

                <input
                  value={
                    referencia
                  }
                  disabled={
                    guardando
                  }
                  onChange={(e) =>
                    setReferencia(
                      e.target.value
                    )
                  }
                  placeholder="Ej. últimos 4 dígitos, folio bancario..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 disabled:bg-slate-100"
                />
              </div>

              {/* COMPROBANTE */}

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-sm font-bold text-slate-800">
                    Comprobante de pago
                  </label>

                  <span className="shrink-0 text-xs text-slate-500">
                    Opcional
                  </span>
                </div>

                {!previewComprobante ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5">
                    <label className="flex cursor-pointer flex-col items-center justify-center text-center">
                      <div className="mb-2 text-3xl">
                        📷
                      </div>

                      <p className="font-bold text-slate-800">
                        Tomar foto o seleccionar imagen
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        JPG, PNG o WEBP · Máximo 10 MB
                      </p>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        disabled={
                          guardando
                        }
                        className="hidden"
                        onChange={(e) => {
                          seleccionarComprobante(
                            e.target
                              .files?.[0] ||
                              null
                          );

                          e.target.value =
                            "";
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">

                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800">
                          Comprobante seleccionado
                        </p>

                        <p className="truncate text-xs text-slate-500">
                          {
                            comprobante?.name
                          }
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={
                          guardando
                        }
                        onClick={
                          quitarComprobante
                        }
                        className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    </div>

                    <div className="flex justify-center bg-slate-100 p-3 sm:p-4">
                      <img
                        src={
                          previewComprobante
                        }
                        alt="Vista previa del comprobante"
                        className="max-h-72 max-w-full rounded-lg object-contain shadow-sm"
                      />
                    </div>

                    <label className="block cursor-pointer border-t border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-blue-700 hover:bg-blue-50">
                      Cambiar imagen

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        disabled={
                          guardando
                        }
                        className="hidden"
                        onChange={(e) => {
                          seleccionarComprobante(
                            e.target
                              .files?.[0] ||
                              null
                          );

                          e.target.value =
                            "";
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* OBSERVACIONES */}

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">
                  Observaciones
                </label>

                <textarea
                  value={
                    observaciones
                  }
                  disabled={
                    guardando
                  }
                  onChange={(e) =>
                    setObservaciones(
                      e.target.value
                    )
                  }
                  placeholder="Opcional"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 disabled:bg-slate-100"
                />
              </div>

              {/* MENSAJES */}

              {errorPago && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  {errorPago}
                </div>
              )}

              {mensajePago && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
                  {mensajePago}
                </div>
              )}
            </div>

            {/* BOTONES */}

            <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end sm:p-5">
              <button
                type="button"
                onClick={
                  cerrarPago
                }
                disabled={
                  guardando
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
                className="w-full rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {guardando
                  ? comprobante
                    ? "Subiendo comprobante..."
                    : "Guardando pago..."
                  : "Guardar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}