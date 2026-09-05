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

type HistorialPago = {
  idPago: string;
  fecha: string;
  folio: string;
  cliente: string;
  whatsapp: string;
  servicio: string;

  total: number;
  saldoAntes: number;
  monto: number;
  saldoDespues: number;

  metodo: string;
  referencia: string;

  comprobante: string;
  urlComprobante: string;

  observaciones: string;

  estadoMovimiento: "Activo" | "Anulado";
  motivoAnulacion: string;
  fechaAnulacion: string;
};

type MetodoPago =
  | "Transferencia"
  | "Efectivo"
  | "Depósito"
  | "Tarjeta"
  | "Otro";

type VisorComprobante = {
  ruta: string;
  fecha: string;
  monto: number;
} | null;

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
      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
      : estado === "Parcial"
      ? "border-blue-200 bg-blue-100 text-blue-700"
      : "border-amber-200 bg-amber-100 text-amber-700";

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${estilos}`}
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

  const [comprobante, setComprobante] =
    useState<File | null>(null);

  const [
    previewComprobante,
    setPreviewComprobante,
  ] = useState("");

  const [guardando, setGuardando] =
    useState(false);

  const [errorPago, setErrorPago] =
    useState("");

  const [mensajePago, setMensajePago] =
    useState("");

  /* HISTORIAL */

  const [historial, setHistorial] =
    useState<HistorialPago[]>([]);

  const [
    cargandoHistorial,
    setCargandoHistorial,
  ] = useState(false);

  const [
    errorHistorial,
    setErrorHistorial,
  ] = useState("");

  const [
    mostrarHistorial,
    setMostrarHistorial,
  ] = useState(true);

  /* VISOR COMPROBANTE */

  const [
    visorComprobante,
    setVisorComprobante,
  ] = useState<VisorComprobante>(null);

  const [
    errorVisor,
    setErrorVisor,
  ] = useState("");

  /* ANULACIÓN DE PAGO */

  const [
    pagoAAnular,
    setPagoAAnular,
  ] = useState<HistorialPago | null>(null);

  const [
    motivoAnulacion,
    setMotivoAnulacion,
  ] = useState("");

  const [
    anulando,
    setAnulando,
  ] = useState(false);

  const [
    errorAnulacion,
    setErrorAnulacion,
  ] = useState("");

  useEffect(() => {
    cargarPagos();
  }, []);

  useEffect(() => {
    return () => {
      if (previewComprobante) {
        URL.revokeObjectURL(
          previewComprobante
        );
      }
    };
  }, [previewComprobante]);

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

  async function cargarHistorial(
    folio: string
  ) {
    try {
      setCargandoHistorial(true);
      setErrorHistorial("");

      const respuesta =
        await fetch(
          `/api/pagos/historial?folio=${encodeURIComponent(
            folio
          )}`,
          {
            cache: "no-store",
          }
        );

      const data =
        await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          data?.error ||
            "No fue posible cargar el historial."
        );
      }

      setHistorial(
        Array.isArray(
          data?.historial
        )
          ? data.historial
          : []
      );
    } catch (err) {
      console.error(err);

      setErrorHistorial(
        err instanceof Error
          ? err.message
          : "No fue posible cargar el historial."
      );

      setHistorial([]);
    } finally {
      setCargandoHistorial(false);
    }
  }

  const filtrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();

      if (!texto) {
        return pagos;
      }

      return pagos.filter(
        (pago) =>
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
    }, [pagos, busqueda]);

  const totales =
    useMemo(() => {
      return pagos.reduce(
        (acc, pago) => {
          acc.cotizado +=
            Number(
              pago.total || 0
            );

          acc.cobrado +=
            Number(
              pago.pagado || 0
            );

          acc.pendiente +=
            Number(
              pago.saldo || 0
            );

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

  function abrirPago(
    pago: PagoRow
  ) {
    limpiarComprobante();

    setSeleccionado(pago);

    setMontoPago("");
    setReferencia("");
    setObservaciones("");

    setMetodoPago(
      "Transferencia"
    );

    setErrorPago("");
    setMensajePago("");

    setHistorial([]);
    setErrorHistorial("");

    setMostrarHistorial(true);
    setVisorComprobante(null);
    setErrorVisor("");

    setPagoAAnular(null);
    setMotivoAnulacion("");
    setErrorAnulacion("");

    cargarHistorial(
      pago.folio
    );

    const opciones =
      pago.opciones
        ?.toLowerCase() || "";

    const tieneAereo =
      opciones.includes("aéreo") ||
      opciones.includes("aereo");

    const tieneTerrestre =
      opciones.includes(
        "terrestre"
      );

    if (
      tieneAereo &&
      !tieneTerrestre
    ) {
      setServicio("Aéreo");
    } else if (
      tieneTerrestre &&
      !tieneAereo
    ) {
      setServicio(
        "Terrestre"
      );
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

    setHistorial([]);
    setErrorHistorial("");

    setVisorComprobante(null);
    setErrorVisor("");

    setPagoAAnular(null);
    setMotivoAnulacion("");
    setErrorAnulacion("");
  }

  function abrirVisor(
    movimiento: HistorialPago
  ) {
    if (!movimiento.comprobante) {
      return;
    }

    setErrorVisor("");

    setVisorComprobante({
      ruta:
        movimiento.comprobante,

      fecha:
        movimiento.fecha,

      monto:
        movimiento.monto,
    });
  }

  function cerrarVisor() {
    setVisorComprobante(null);
    setErrorVisor("");
  }

  function abrirAnulacion(
    movimiento: HistorialPago
  ) {
    if (
      movimiento.estadoMovimiento ===
      "Anulado"
    ) {
      return;
    }

    setErrorAnulacion("");
    setMotivoAnulacion("");
    setPagoAAnular(
      movimiento
    );
  }

  function cerrarAnulacion() {
    if (anulando) {
      return;
    }

    setPagoAAnular(null);
    setMotivoAnulacion("");
    setErrorAnulacion("");
  }

  async function confirmarAnulacion() {
    if (
      !pagoAAnular ||
      !seleccionado
    ) {
      return;
    }

    const motivo =
      motivoAnulacion.trim();

    if (motivo.length < 3) {
      setErrorAnulacion(
        "Escribe el motivo de la anulación."
      );
      return;
    }

    try {
      setAnulando(true);
      setErrorAnulacion("");

      const respuesta =
        await fetch(
          "/api/pagos",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              idPago:
                pagoAAnular.idPago,

              motivo,
            }),
          }
        );

      const data =
        await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          data?.error ||
            "No fue posible anular el pago."
        );
      }

      await cargarPagos();

      await cargarHistorial(
        seleccionado.folio
      );

      setSeleccionado(
        (actual) => {
          if (!actual) {
            return actual;
          }

          return {
            ...actual,

            total:
              Number(
                data?.total ??
                  actual.total
              ),

            pagado:
              Number(
                data?.pagado ??
                  actual.pagado
              ),

            saldo:
              Number(
                data?.saldo ??
                  actual.saldo
              ),

            estado:
              data?.estado ||
              actual.estado,
          };
        }
      );

      setPagoAAnular(null);
      setMotivoAnulacion("");
      setErrorAnulacion("");

      setMensajePago(
        "Pago anulado correctamente."
      );

      setTimeout(() => {
        setMensajePago("");
      }, 2500);
    } catch (err) {
      console.error(err);

      setErrorAnulacion(
        err instanceof Error
          ? err.message
          : "No fue posible anular el pago."
      );
    } finally {
      setAnulando(false);
    }
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

    setComprobante(
      archivo
    );

    setPreviewComprobante(
      URL.createObjectURL(
        archivo
      )
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
          seleccionado.totalAereo ||
            0
        );
      }

      if (
        servicio ===
        "Terrestre"
      ) {
        return Number(
          seleccionado.totalTerrestre ||
            0
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
        seleccionado.total >
        0
      ) {
        return Number(
          seleccionado.saldo ||
            0
        );
      }

      return Math.max(
        totalSeleccionado -
          Number(
            seleccionado.pagado ||
              0
          ),
        0
      );
    }, [
      seleccionado,
      totalSeleccionado,
    ]);

  const pagoCapturado =
    Number(
      montoPago || 0
    );

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

      setMontoPago("");
      setReferencia("");
      setObservaciones("");

      await cargarPagos();

      await cargarHistorial(
        seleccionado.folio
      );

      setSeleccionado(
        (actual) => {
          if (!actual) {
            return actual;
          }

          return {
            ...actual,

            total:
              Number(
                data?.total ??
                  actual.total
              ),

            pagado:
              Number(
                data?.pagado ??
                  actual.pagado
              ),

            saldo:
              Number(
                data?.saldo ??
                  actual.saldo
              ),

            estado:
              data?.estado ||
              actual.estado,
          };
        }
      );

      setTimeout(() => {
        setMensajePago("");
      }, 2500);
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

        <div className="mb-5">
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

        {/* RESUMEN */}

        <div className="mb-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">
              Total cotizado
            </p>

            <p className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">
              {dinero(
                totales.cotizado
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-emerald-700">
              Cobrado
            </p>

            <p className="mt-2 text-xl font-black text-emerald-700 sm:text-2xl">
              {dinero(
                totales.cobrado
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-amber-700">
              Saldo pendiente
            </p>

            <p className="mt-2 text-xl font-black text-amber-700 sm:text-2xl">
              {dinero(
                totales.pendiente
              )}
            </p>
          </div>
        </div>

        {/* COTIZACIONES */}

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
                value={busqueda}
                onChange={(e) =>
                  setBusqueda(
                    e.target.value
                  )
                }
                placeholder="Buscar folio, cliente o teléfono..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 md:max-w-md"
              />
            </div>
          </div>

          {cargando ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Cargando pagos...
            </div>
          ) : error ? (
            <div className="p-4">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            </div>
          ) : filtrados.length ===
            0 ? (
            <div className="p-10 text-center font-bold text-slate-700">
              No hay registros para mostrar.
            </div>
          ) : (
            <>
              {/* CELULAR */}

              <div className="divide-y divide-slate-200 md:hidden">

                {filtrados.map(
                  (pago) => (
                    <div
                      key={
                        pago.folio
                      }
                      className="p-4"
                    >
                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase text-slate-400">
                            Folio
                          </p>

                          <p className="mt-1 break-all text-sm font-black text-blue-800">
                            {
                              pago.folio
                            }
                          </p>
                        </div>

                        <EstadoPago
                          estado={
                            pago.estado
                          }
                        />
                      </div>

                      <div className="mt-4">
                        <p className="text-[10px] font-black uppercase text-slate-400">
                          Cliente
                        </p>

                        <p className="mt-1 font-black text-slate-950">
                          {
                            pago.cliente
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            pago.whatsapp
                          }
                        </p>
                      </div>

                      <div className="mt-4 text-sm text-slate-700">
                        {pago.fecha}
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[10px] font-black uppercase text-slate-500">
                            Total
                          </p>

                          <p className="mt-1 text-sm font-black">
                            {pago.total >
                            0
                              ? dinero(
                                  pago.total
                                )
                              : "Por definir"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-emerald-50 p-3">
                          <p className="text-[10px] font-black uppercase text-emerald-700">
                            Pagado
                          </p>

                          <p className="mt-1 text-sm font-black text-emerald-700">
                            {dinero(
                              pago.pagado
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl bg-amber-50 p-3">
                          <p className="text-[10px] font-black uppercase text-amber-700">
                            Saldo
                          </p>

                          <p className="mt-1 text-sm font-black text-amber-700">
                            {pago.total >
                            0
                              ? dinero(
                                  pago.saldo
                                )
                              : "—"}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          abrirPago(
                            pago
                          )
                        }
                        className="mt-4 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white"
                      >
                        Ver / Abonar
                      </button>
                    </div>
                  )
                )}
              </div>

              {/* COMPUTADORA */}

              <div className="hidden overflow-x-auto md:block">

                <table className="w-full min-w-[900px]">

                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-black uppercase text-slate-500">
                        Folio
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-black uppercase text-slate-500">
                        Cliente
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-black uppercase text-slate-500">
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

                      <th className="px-5 py-3 text-left text-xs font-black uppercase text-slate-500">
                        Estado
                      </th>

                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtrados.map(
                      (pago) => (
                        <tr
                          key={
                            pago.folio
                          }
                          className="border-t border-slate-100"
                        >
                          <td className="px-5 py-4 font-bold text-blue-800">
                            {
                              pago.folio
                            }
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

                          <td className="px-5 py-4 text-right font-bold">
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

                          <td className="px-5 py-4 text-right font-black">
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
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
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

      {/* MODAL PAGO */}

      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4">

          <div className="max-h-[96vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">

            <div className="sticky top-0 z-20 flex items-start justify-between border-b bg-white p-4 sm:p-5">

              <div>
                <p className="text-xs font-black uppercase text-blue-700">
                  Pagos del cliente
                </p>

                <h2 className="mt-1 text-lg font-black">
                  {
                    seleccionado.cliente
                  }
                </h2>

                <p className="text-xs text-slate-500">
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
                className="text-xl font-bold text-slate-500"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 p-4 sm:p-5">

              <div className="grid gap-3 sm:grid-cols-2">

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    WhatsApp
                  </p>

                  <p className="mt-1 font-bold">
                    {
                      seleccionado.whatsapp
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Pagado
                  </p>

                  <p className="mt-1 font-black text-emerald-700">
                    {dinero(
                      seleccionado.pagado
                    )}
                  </p>
                </div>
              </div>

              {/* HISTORIAL */}

              <div className="overflow-hidden rounded-2xl border">

                <button
                  type="button"
                  onClick={() =>
                    setMostrarHistorial(
                      !mostrarHistorial
                    )
                  }
                  className="flex w-full items-center justify-between bg-slate-50 p-4"
                >
                  <div className="text-left">
                    <p className="font-black">
                      Historial de pagos
                    </p>

                    <p className="text-xs text-slate-500">
                      {historial.length} pago
                      {historial.length ===
                      1
                        ? ""
                        : "s"}{" "}
                      registrado
                      {historial.length ===
                      1
                        ? ""
                        : "s"}
                    </p>
                  </div>

                  <span>
                    {mostrarHistorial
                      ? "−"
                      : "+"}
                  </span>
                </button>

                {mostrarHistorial && (
                  <div className="border-t">

                    {cargandoHistorial ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        Cargando historial...
                      </div>
                    ) : errorHistorial ? (
                      <div className="p-4 text-sm text-red-700">
                        {
                          errorHistorial
                        }
                      </div>
                    ) : historial.length ===
                      0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        Aún no hay pagos registrados.
                      </div>
                    ) : (
                      <div className="divide-y">

                        {historial.map(
                          (
                            movimiento,
                            indice
                          ) => (
                            <div
                              key={
                                movimiento.idPago ||
                                indice
                              }
                              className={`p-4 ${
                                movimiento.estadoMovimiento ===
                                "Anulado"
                                  ? "bg-red-50/60"
                                  : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">

                                <div>
                                  <p className="text-xs font-black uppercase text-slate-400">
                                    Pago
                                  </p>

                                  <p className="mt-1 text-sm font-bold">
                                    {
                                      movimiento.fecha
                                    }
                                  </p>
                                </div>

                                <div className="flex flex-col items-end gap-1">
                                  <span
                                    className={`rounded-full px-3 py-1 text-sm font-black ${
                                      movimiento.estadoMovimiento ===
                                      "Anulado"
                                        ? "bg-red-100 text-red-700 line-through"
                                        : "bg-emerald-100 text-emerald-700"
                                    }`}
                                  >
                                    {dinero(
                                      movimiento.monto
                                    )}
                                  </span>

                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                      movimiento.estadoMovimiento ===
                                      "Anulado"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {
                                      movimiento.estadoMovimiento
                                    }
                                  </span>
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-2">

                                <div className="rounded-xl bg-slate-50 p-3">
                                  <p className="text-[10px] font-black uppercase text-slate-500">
                                    Servicio
                                  </p>

                                  <p className="mt-1 text-sm font-bold">
                                    {movimiento.servicio ||
                                      "—"}
                                  </p>
                                </div>

                                <div className="rounded-xl bg-slate-50 p-3">
                                  <p className="text-[10px] font-black uppercase text-slate-500">
                                    Método
                                  </p>

                                  <p className="mt-1 text-sm font-bold">
                                    {movimiento.metodo ||
                                      "—"}
                                  </p>
                                </div>

                                <div className="rounded-xl bg-amber-50 p-3">
                                  <p className="text-[10px] font-black uppercase text-amber-700">
                                    Saldo antes
                                  </p>

                                  <p className="mt-1 text-sm font-black text-amber-700">
                                    {dinero(
                                      movimiento.saldoAntes
                                    )}
                                  </p>
                                </div>

                                <div className="rounded-xl bg-blue-50 p-3">
                                  <p className="text-[10px] font-black uppercase text-blue-700">
                                    Saldo después
                                  </p>

                                  <p className="mt-1 text-sm font-black text-blue-700">
                                    {dinero(
                                      movimiento.saldoDespues
                                    )}
                                  </p>
                                </div>
                              </div>

                              {movimiento.referencia && (
                                <div className="mt-3 rounded-xl border p-3">
                                  <p className="text-[10px] font-black uppercase text-slate-500">
                                    Referencia
                                  </p>

                                  <p className="mt-1 text-sm">
                                    {
                                      movimiento.referencia
                                    }
                                  </p>
                                </div>
                              )}

                              {movimiento.observaciones && (
                                <div className="mt-3 rounded-xl border p-3">
                                  <p className="text-[10px] font-black uppercase text-slate-500">
                                    Observaciones
                                  </p>

                                  <p className="mt-1 text-sm">
                                    {
                                      movimiento.observaciones
                                    }
                                  </p>
                                </div>
                              )}

                              {/* NUEVO VISOR INTERNO */}

                              {movimiento.comprobante ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirVisor(
                                      movimiento
                                    )
                                  }
                                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700"
                                >
                                  📷 Ver comprobante
                                </button>
                              ) : (
                                <p className="mt-3 text-xs text-slate-400">
                                  Sin comprobante adjunto
                                </p>
                              )}

                              {movimiento.estadoMovimiento ===
                              "Anulado" ? (
                                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                                  <p className="text-[10px] font-black uppercase text-red-700">
                                    Pago anulado
                                  </p>

                                  <p className="mt-1 text-sm font-bold text-red-800">
                                    {movimiento.motivoAnulacion ||
                                      "Sin motivo registrado"}
                                  </p>

                                  {movimiento.fechaAnulacion && (
                                    <p className="mt-1 text-xs text-red-600">
                                      Anulado:{" "}
                                      {
                                        movimiento.fechaAnulacion
                                      }
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirAnulacion(
                                      movimiento
                                    )
                                  }
                                  className="mt-3 w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-50"
                                >
                                  Anular pago
                                </button>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* NUEVO ABONO */}

              <div className="border-t pt-5">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">
                  Registrar nuevo abono
                </p>
              </div>

              {(Number(
                seleccionado.totalAereo ||
                  0
              ) >
                0 ||
                Number(
                  seleccionado.totalTerrestre ||
                    0
                ) >
                  0) && (
                <div>

                  <label className="mb-2 block text-sm font-bold">
                    Servicio elegido por el cliente
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">

                    {Number(
                      seleccionado.totalAereo ||
                        0
                    ) >
                      0 && (
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
                            : ""
                        }`}
                      >
                        ✈{" "}
                        <strong>
                          Aéreo
                        </strong>

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
                    ) >
                      0 && (
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
                            : ""
                        }`}
                      >
                        🚚{" "}
                        <strong>
                          Terrestre
                        </strong>

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
              )}

              <div className="grid grid-cols-3 gap-2">

                <div className="rounded-xl border p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-500">
                    Total
                  </p>

                  <p className="mt-1 font-black">
                    {dinero(
                      totalSeleccionado
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[10px] font-bold uppercase text-amber-700">
                    Saldo actual
                  </p>

                  <p className="mt-1 font-black text-amber-700">
                    {dinero(
                      saldoActual
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-[10px] font-bold uppercase text-emerald-700">
                    Nuevo saldo
                  </p>

                  <p className="mt-1 font-black text-emerald-700">
                    {dinero(
                      nuevoSaldo
                    )}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">
                  Cantidad que paga ahora
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={montoPago}
                  onChange={(e) =>
                    setMontoPago(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border px-4 py-3 text-lg font-bold"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">
                  Método de pago
                </label>

                <select
                  value={metodoPago}
                  onChange={(e) =>
                    setMetodoPago(
                      e.target
                        .value as MetodoPago
                    )
                  }
                  className="w-full rounded-xl border bg-white px-4 py-3"
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
                <label className="mb-1 block text-sm font-bold">
                  Referencia
                </label>

                <input
                  value={referencia}
                  onChange={(e) =>
                    setReferencia(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              {/* SUBIR FOTO */}

              <div>
                <label className="mb-2 block text-sm font-bold">
                  Comprobante de pago
                </label>

                {!previewComprobante ? (
                  <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed bg-slate-50 p-5 text-center">

                    <div className="text-3xl">
                      📷
                    </div>

                    <p className="mt-2 font-bold">
                      Tomar foto o seleccionar imagen
                    </p>

                    <p className="text-xs text-slate-500">
                      JPG, PNG o WEBP · Máximo 10 MB
                    </p>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      className="hidden"
                      onChange={(e) =>
                        seleccionarComprobante(
                          e.target
                            .files?.[0] ||
                            null
                        )
                      }
                    />
                  </label>
                ) : (
                  <div className="overflow-hidden rounded-xl border">

                    <img
                      src={
                        previewComprobante
                      }
                      alt="Vista previa"
                      className="max-h-72 w-full object-contain"
                    />

                    <button
                      type="button"
                      onClick={
                        quitarComprobante
                      }
                      className="w-full border-t px-4 py-3 font-bold text-red-600"
                    >
                      Quitar imagen
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">
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
                  rows={3}
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              {errorPago && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {errorPago}
                </div>
              )}

              {mensajePago && (
                <div className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
                  {mensajePago}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 z-20 flex gap-3 border-t bg-white p-4 sm:justify-end">

              <button
                type="button"
                onClick={
                  cerrarPago
                }
                className="flex-1 rounded-xl border px-5 py-3 font-bold sm:flex-none"
              >
                Cerrar
              </button>

              {saldoActual >
                0 && (
                <button
                  type="button"
                  onClick={
                    guardarPago
                  }
                  disabled={
                    guardando
                  }
                  className="flex-1 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white disabled:opacity-60 sm:flex-none"
                >
                  {guardando
                    ? "Guardando..."
                    : "Guardar pago"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =============================================
          MODAL ANULAR PAGO
      ============================================== */}

      {pagoAAnular && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="border-b border-red-100 bg-red-50 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-red-700">
                Anular pago
              </p>

              <h3 className="mt-1 text-lg font-black text-slate-950">
                {dinero(
                  pagoAAnular.monto
                )}
              </h3>

              <p className="mt-1 text-xs text-slate-600">
                {
                  pagoAAnular.fecha
                }
              </p>
            </div>

            <div className="space-y-4 p-5">

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                El movimiento no se borrará. Quedará marcado como
                anulado y el comprobante seguirá guardado como evidencia.
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">
                  Motivo de la anulación
                </label>

                <textarea
                  value={
                    motivoAnulacion
                  }
                  onChange={(e) =>
                    setMotivoAnulacion(
                      e.target.value
                    )
                  }
                  disabled={
                    anulando
                  }
                  rows={4}
                  placeholder="Ej. monto capturado incorrectamente..."
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100"
                />
              </div>

              {errorAnulacion && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {
                    errorAnulacion
                  }
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t bg-white p-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={
                  cerrarAnulacion
                }
                disabled={
                  anulando
                }
                className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={
                  confirmarAnulacion
                }
                disabled={
                  anulando
                }
                className="rounded-xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-700 disabled:opacity-60"
              >
                {anulando
                  ? "Anulando..."
                  : "Confirmar anulación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================
          VISOR INTERNO DEL COMPROBANTE
      ============================================== */}

      {visorComprobante && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-3 sm:p-6">

          <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between gap-3 border-b bg-white px-4 py-3 sm:px-5 sm:py-4">

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                  Comprobante de pago
                </p>

                <p className="mt-1 text-lg font-black text-emerald-700">
                  {dinero(
                    visorComprobante.monto
                  )}
                </p>

                <p className="text-xs text-slate-500">
                  {
                    visorComprobante.fecha
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={
                  cerrarVisor
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-600 hover:bg-slate-200"
                aria-label="Cerrar comprobante"
              >
                ×
              </button>
            </div>

            <div className="flex min-h-[300px] flex-1 items-center justify-center overflow-auto bg-slate-100 p-3 sm:p-5">

              <img
                src={`/api/pagos/comprobante?ruta=${encodeURIComponent(
                  visorComprobante.ruta
                )}`}
                alt="Comprobante de pago"
                onError={() =>
                  setErrorVisor(
                    "No fue posible mostrar el comprobante."
                  )
                }
                className="max-h-[75vh] max-w-full rounded-lg bg-white object-contain shadow"
              />
            </div>

            {errorVisor && (
              <div className="border-t border-red-200 bg-red-50 p-3 text-center text-sm font-bold text-red-700">
                {
                  errorVisor
                }
              </div>
            )}

            <div className="border-t bg-white p-3 sm:p-4">

              <button
                type="button"
                onClick={
                  cerrarVisor
                }
                className="w-full rounded-xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800 sm:mx-auto sm:block sm:w-auto sm:min-w-48"
              >
                Cerrar comprobante
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}