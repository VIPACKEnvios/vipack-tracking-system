"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SelloDia = {
  id: string;
  fecha: string;
  semana: string;
  g: number;
  c: number;
  m: number;
  precioG?: number;
  precioC?: number;
  precioM?: number;
  cajas?: number;
  total?: number;
  fechaRegistro?: string;
};

type PagoSellos = {
  idPago: string;
  fecha: string;
  semana: string;
  monto: number;
  referencia: string;
  observaciones?: string;
  estadoMovimiento?: "Activo" | "Anulado";
  motivoAnulacion?: string;
  fechaAnulacion?: string;
};

const PRECIO_G = 650;
const PRECIO_C = 350;
const PRECIO_M = 550;

function dinero(valor: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(valor || 0);
}

function obtenerLunesSemana(fecha = new Date()) {
  const copia = new Date(fecha);
  const dia = copia.getDay();
  const diferencia = dia === 0 ? -6 : 1 - dia;

  copia.setHours(12, 0, 0, 0);
  copia.setDate(copia.getDate() + diferencia);

  const year = copia.getFullYear();
  const month = String(copia.getMonth() + 1).padStart(2, "0");
  const day = String(copia.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function moverFechaISO(fechaISO: string, dias: number) {
  const [year, month, day] = fechaISO.split("-").map(Number);
  const fecha = new Date(year, month - 1, day, 12, 0, 0);

  fecha.setDate(fecha.getDate() + dias);

  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

export default function SellosPage() {
  const router = useRouter();

  const [semanaSellos, setSemanaSellos] =
    useState(() => obtenerLunesSemana());

  const [sellosDias, setSellosDias] =
    useState<SelloDia[]>([]);

  const [pagosSellos, setPagosSellos] =
    useState<PagoSellos[]>([]);

  const [cargandoSellos, setCargandoSellos] =
    useState(true);

  const [guardandoSellos, setGuardandoSellos] =
    useState(false);

  const [errorSellos, setErrorSellos] =
    useState("");

  const [mensajeSellos, setMensajeSellos] =
    useState("");

  const [mostrarNuevoDia, setMostrarNuevoDia] =
    useState(false);

  const [fechaSello, setFechaSello] =
    useState("");

  const [cantidadG, setCantidadG] =
    useState("");

  const [cantidadC, setCantidadC] =
    useState("");

  const [cantidadM, setCantidadM] =
    useState("");

  const [mostrarPagoSellos, setMostrarPagoSellos] =
    useState(false);

  const [montoPagoSellos, setMontoPagoSellos] =
    useState("");

  const [referenciaPagoSellos, setReferenciaPagoSellos] =
    useState("");

  const [observacionesPagoSellos, setObservacionesPagoSellos] =
    useState("");

  async function cargarSellos() {
    try {
      setCargandoSellos(true);
      setErrorSellos("");

      const respuesta = await fetch(
        `/api/sellos?semana=${encodeURIComponent(semanaSellos)}`,
        {
          cache: "no-store",
        }
      );

      const data = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          data?.error ||
            "No fue posible cargar los sellos."
        );
      }

      setSellosDias(
        Array.isArray(data?.dias)
          ? data.dias
          : []
      );

      setPagosSellos(
        Array.isArray(data?.pagos)
          ? data.pagos
          : []
      );
    } catch (err) {
      console.error(err);

      setSellosDias([]);
      setPagosSellos([]);

      setErrorSellos(
        err instanceof Error
          ? err.message
          : "No fue posible cargar los sellos."
      );
    } finally {
      setCargandoSellos(false);
    }
  }

  useEffect(() => {
    cargarSellos();
  }, [semanaSellos]);

  function abrirNuevoDiaSellos() {
    setErrorSellos("");
    setMensajeSellos("");

    // La fecha queda vacía para seleccionarla manualmente.
    setFechaSello("");
    setCantidadG("");
    setCantidadC("");
    setCantidadM("");

    setMostrarNuevoDia(true);
  }

  async function guardarDiaSellos() {
    if (!fechaSello) {
      setErrorSellos(
        "Selecciona la fecha."
      );
      return;
    }

    const g = Number(
      cantidadG || 0
    );

    const c = Number(
      cantidadC || 0
    );

    const m = Number(
      cantidadM || 0
    );

    if (
      ![g, c, m].every(
        (n) =>
          Number.isFinite(n) &&
          n >= 0
      )
    ) {
      setErrorSellos(
        "Las cantidades deben ser números válidos."
      );
      return;
    }

    if (g + c + m <= 0) {
      setErrorSellos(
        "Captura al menos una caja."
      );
      return;
    }

    if (
      obtenerLunesSemana(
        new Date(
          `${fechaSello}T12:00:00`
        )
      ) !== semanaSellos
    ) {
      setErrorSellos(
        "La fecha seleccionada no pertenece a la semana que estás viendo."
      );
      return;
    }

    try {
      setGuardandoSellos(true);
      setErrorSellos("");

      const respuesta =
        await fetch(
          "/api/sellos",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              tipo: "dia",
              fecha: fechaSello,
              g,
              c,
              m,
            }),
          }
        );

      const data =
        await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          data?.error ||
            "No fue posible guardar el día."
        );
      }

      setMostrarNuevoDia(false);

      setFechaSello("");
      setCantidadG("");
      setCantidadC("");
      setCantidadM("");

      setMensajeSellos(
        "Día de sellos guardado correctamente."
      );

      await cargarSellos();

      setTimeout(() => {
        setMensajeSellos("");
      }, 2500);
    } catch (err) {
      console.error(err);

      setErrorSellos(
        err instanceof Error
          ? err.message
          : "No fue posible guardar el día."
      );
    } finally {
      setGuardandoSellos(false);
    }
  }

  async function eliminarDiaSellos(
    id: string
  ) {
    if (
      !confirm(
        "¿Eliminar este registro de sellos?"
      )
    ) {
      return;
    }

    try {
      setGuardandoSellos(true);
      setErrorSellos("");

      const respuesta =
        await fetch(
          `/api/sellos?id=${encodeURIComponent(
            id
          )}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          data?.error ||
            "No fue posible eliminar el registro."
        );
      }

      setMensajeSellos(
        "Registro eliminado correctamente."
      );

      await cargarSellos();

      setTimeout(() => {
        setMensajeSellos("");
      }, 2500);
    } catch (err) {
      console.error(err);

      setErrorSellos(
        err instanceof Error
          ? err.message
          : "No fue posible eliminar el registro."
      );
    } finally {
      setGuardandoSellos(false);
    }
  }

  function totalDiaSellos(
    dia: SelloDia
  ) {
    if (
      Number.isFinite(
        Number(dia.total)
      )
    ) {
      return Number(
        dia.total || 0
      );
    }

    return (
      dia.g * PRECIO_G +
      dia.c * PRECIO_C +
      dia.m * PRECIO_M
    );
  }

  function cajasDiaSellos(
    dia: SelloDia
  ) {
    if (
      Number.isFinite(
        Number(dia.cajas)
      ) &&
      Number(dia.cajas) > 0
    ) {
      return Number(
        dia.cajas
      );
    }

    return (
      dia.g +
      dia.c +
      dia.m
    );
  }

  const totalSemanalSellos =
    useMemo(() => {
      return sellosDias.reduce(
        (total, dia) =>
          total +
          totalDiaSellos(dia),
        0
      );
    }, [sellosDias]);

  const pagosSellosActivos =
    useMemo(() => {
      return pagosSellos.filter(
        (pago) =>
          (
            pago.estadoMovimiento ||
            "Activo"
          ) !== "Anulado"
      );
    }, [pagosSellos]);

  const totalPagadoSellos =
    useMemo(() => {
      return pagosSellosActivos.reduce(
        (total, pago) =>
          total +
          Number(
            pago.monto || 0
          ),
        0
      );
    }, [pagosSellosActivos]);

  const saldoSellos =
    Math.max(
      totalSemanalSellos -
        totalPagadoSellos,
      0
    );

  const estadoSellos =
    totalSemanalSellos > 0 &&
    saldoSellos <= 0
      ? "LIQUIDADO"
      : totalPagadoSellos > 0
      ? "PARCIAL"
      : "PENDIENTE";

  async function guardarPagoSellos() {
    const monto = Number(
      montoPagoSellos || 0
    );

    if (
      !Number.isFinite(monto) ||
      monto <= 0
    ) {
      setErrorSellos(
        "Captura un monto válido."
      );
      return;
    }

    if (
      monto > saldoSellos
    ) {
      setErrorSellos(
        `El pago no puede ser mayor al saldo de ${dinero(
          saldoSellos
        )}.`
      );
      return;
    }

    try {
      setGuardandoSellos(true);
      setErrorSellos("");

      const respuesta =
        await fetch(
          "/api/sellos",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              tipo: "pago",
              semana: semanaSellos,
              monto,

              referencia:
                referenciaPagoSellos.trim(),

              observaciones:
                observacionesPagoSellos.trim(),
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

      setMontoPagoSellos("");
      setReferenciaPagoSellos("");
      setObservacionesPagoSellos("");

      setMostrarPagoSellos(false);

      setMensajeSellos(
        "Pago de sellos guardado correctamente."
      );

      await cargarSellos();

      setTimeout(() => {
        setMensajeSellos("");
      }, 2500);
    } catch (err) {
      console.error(err);

      setErrorSellos(
        err instanceof Error
          ? err.message
          : "No fue posible guardar el pago."
      );
    } finally {
      setGuardandoSellos(false);
    }
  }

  function fechaBonitaSellos(
    fecha: string
  ) {
    if (!fecha) {
      return "";
    }

    const [
      year,
      month,
      day,
    ] =
      fecha
        .split("-")
        .map(Number);

    return new Intl.DateTimeFormat(
      "es-MX",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
      }
    ).format(
      new Date(
        year,
        month - 1,
        day
      )
    );
  }

  function rangoSemanaSellos() {
    const domingo =
      moverFechaISO(
        semanaSellos,
        6
      );

    return `${fechaBonitaSellos(
      semanaSellos
    )} al ${fechaBonitaSellos(
      domingo
    )}`;
  }

  function mensajeDiaSellos(
    dia: SelloDia
  ) {
    const total =
      totalDiaSellos(dia);

    const cajas =
      cajasDiaSellos(dia);

    return `*SELLOS — ${fechaBonitaSellos(
      dia.fecha
    ).toUpperCase()}*

G: ${dia.g} × $${PRECIO_G.toLocaleString(
      "es-MX"
    )} = $${(
      dia.g * PRECIO_G
    ).toLocaleString("es-MX")}
C: ${dia.c} × $${PRECIO_C.toLocaleString(
      "es-MX"
    )} = $${(
      dia.c * PRECIO_C
    ).toLocaleString("es-MX")}
M: ${dia.m} × $${PRECIO_M.toLocaleString(
      "es-MX"
    )} = $${(
      dia.m * PRECIO_M
    ).toLocaleString("es-MX")}

*${cajas} cajas*
*TOTAL: $${total.toLocaleString(
      "es-MX"
    )}*`;
  }

  function abrirWhatsAppConMensaje(
    mensaje: string
  ) {
    const url =
      `https://wa.me/?text=${encodeURIComponent(
        mensaje
      )}`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function copiarMensajeDia(
    dia: SelloDia
  ) {
    abrirWhatsAppConMensaje(
      mensajeDiaSellos(dia)
    );
  }

  function mensajeSemanalSellos() {
    const dias =
      sellosDias
        .map(
          (dia) =>
            `${fechaBonitaSellos(
              dia.fecha
            )}: ${dinero(
              totalDiaSellos(
                dia
              )
            )}`
        )
        .join("\n");

    return `*RESUMEN SEMANAL DE SELLOS*

${dias}

*TOTAL SEMANAL: ${dinero(
      totalSemanalSellos
    )}*
Pagado: ${dinero(
      totalPagadoSellos
    )}
*Saldo pendiente: ${dinero(
      saldoSellos
    )}*
Estado: *${estadoSellos}*`;
  }

  function copiarMensajeSemanalSellos() {
    abrirWhatsAppConMensaje(
      mensajeSemanalSellos()
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] overflow-x-hidden bg-slate-100 p-3 sm:p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/pagos"
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              ← Regresar a pagos
            </button>
          </div>

          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-700">
            Ventas y cobranza
          </p>

          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
            Control de sellos
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Registra las cajas del día, los abonos y el saldo semanal.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-700">
                  Control interno
                </p>

                <h2 className="mt-1 text-lg font-black text-slate-950">
                  🏷️ Sellos semanales
                </h2>

                <p className="mt-1 text-sm capitalize text-slate-500">
                  Semana:{" "}
                  {rangoSemanaSellos()}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSemanaSellos(
                      moverFechaISO(
                        semanaSellos,
                        -7
                      )
                    )
                  }
                  disabled={
                    guardandoSellos
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-50"
                >
                  ← Semana anterior
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSemanaSellos(
                      obtenerLunesSemana()
                    )
                  }
                  disabled={
                    guardandoSellos
                  }
                  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-700 disabled:opacity-50"
                >
                  Semana actual
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSemanaSellos(
                      moverFechaISO(
                        semanaSellos,
                        7
                      )
                    )
                  }
                  disabled={
                    guardandoSellos
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-50"
                >
                  Semana siguiente →
                </button>

                <button
                  type="button"
                  onClick={
                    abrirNuevoDiaSellos
                  }
                  disabled={
                    guardandoSellos
                  }
                  className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-800 disabled:opacity-50"
                >
                  + Agregar día
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4 md:p-5">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase text-slate-500">
                Total semana
              </p>

              <p className="mt-1 text-xl font-black text-slate-950">
                {dinero(
                  totalSemanalSellos
                )}
              </p>
            </div>

            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-[10px] font-black uppercase text-emerald-700">
                Pagado
              </p>

              <p className="mt-1 text-xl font-black text-emerald-700">
                {dinero(
                  totalPagadoSellos
                )}
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-[10px] font-black uppercase text-amber-700">
                Pendiente
              </p>

              <p className="mt-1 text-xl font-black text-amber-700">
                {dinero(
                  saldoSellos
                )}
              </p>
            </div>

            <div
              className={`rounded-xl p-4 ${
                estadoSellos ===
                "LIQUIDADO"
                  ? "bg-emerald-50"
                  : estadoSellos ===
                    "PARCIAL"
                  ? "bg-blue-50"
                  : "bg-amber-50"
              }`}
            >
              <p className="text-[10px] font-black uppercase text-slate-500">
                Estado
              </p>

              <p
                className={`mt-1 text-lg font-black ${
                  estadoSellos ===
                  "LIQUIDADO"
                    ? "text-emerald-700"
                    : estadoSellos ===
                      "PARCIAL"
                    ? "text-blue-700"
                    : "text-amber-700"
                }`}
              >
                {estadoSellos}
              </p>
            </div>
          </div>

          {errorSellos && (
            <div className="border-b border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {errorSellos}
            </div>
          )}

          {mensajeSellos && (
            <div className="border-b border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
              {mensajeSellos}
            </div>
          )}

          {cargandoSellos ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Cargando sellos...
            </div>
          ) : sellosDias.length ===
            0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl">
                🏷️
              </div>

              <p className="mt-3 font-black text-slate-800">
                Aún no hay días registrados
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Agrega el primer día de envíos de esta semana.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {sellosDias.map(
                (dia) => {
                  const total =
                    totalDiaSellos(
                      dia
                    );

                  const cajas =
                    cajasDiaSellos(
                      dia
                    );

                  return (
                    <div
                      key={dia.id}
                      className="p-4 md:p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-[170px]">
                          <p className="font-black capitalize text-slate-950">
                            {fechaBonitaSellos(
                              dia.fecha
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {cajas} cajas
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                          <div className="rounded-xl bg-slate-50 px-4 py-2 text-center">
                            <p className="text-[10px] font-black text-slate-500">
                              G · $650
                            </p>

                            <p className="font-black">
                              {dia.g}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 px-4 py-2 text-center">
                            <p className="text-[10px] font-black text-slate-500">
                              C · $350
                            </p>

                            <p className="font-black">
                              {dia.c}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 px-4 py-2 text-center">
                            <p className="text-[10px] font-black text-slate-500">
                              M · $550
                            </p>

                            <p className="font-black">
                              {dia.m}
                            </p>
                          </div>
                        </div>

                        <div className="min-w-[130px]">
                          <p className="text-xs font-black uppercase text-slate-400">
                            Total
                          </p>

                          <p className="text-xl font-black text-violet-700">
                            {dinero(
                              total
                            )}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              copiarMensajeDia(
                                dia
                              )
                            }
                            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white sm:flex-none"
                          >
                            WhatsApp del día
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              eliminarDiaSellos(
                                dia.id
                              )
                            }
                            disabled={
                              guardandoSellos ||
                              pagosSellosActivos.length >
                                0
                            }
                            title={
                              pagosSellosActivos.length >
                              0
                                ? "No se puede eliminar porque la semana ya tiene pagos."
                                : "Eliminar día"
                            }
                            className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}

          {pagosSellos.length >
            0 && (
            <div className="border-t border-slate-200 p-4 md:p-5">
              <div className="mb-3">
                <h3 className="font-black text-slate-950">
                  Historial de pagos de sellos
                </h3>

                <p className="text-xs text-slate-500">
                  {pagosSellos.length} movimiento(s) registrado(s)
                </p>
              </div>

              <div className="space-y-2">
                {pagosSellos
                  .slice()
                  .reverse()
                  .map(
                    (pago) => (
                      <div
                        key={
                          pago.idPago
                        }
                        className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
                          pago.estadoMovimiento ===
                          "Anulado"
                            ? "border-red-200 bg-red-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-black text-slate-900">
                            {
                              pago.fecha
                            }
                          </p>

                          <p className="text-xs text-slate-500">
                            {pago.referencia
                              ? `Ref: ${pago.referencia}`
                              : "Sin referencia"}
                          </p>

                          {pago.observaciones && (
                            <p className="mt-1 text-xs text-slate-500">
                              {
                                pago.observaciones
                              }
                            </p>
                          )}
                        </div>

                        <div className="text-left sm:text-right">
                          <p
                            className={`font-black ${
                              pago.estadoMovimiento ===
                              "Anulado"
                                ? "text-red-600 line-through"
                                : "text-emerald-700"
                            }`}
                          >
                            {dinero(
                              Number(
                                pago.monto ||
                                  0
                              )
                            )}
                          </p>

                          <p className="text-[10px] font-black uppercase text-slate-500">
                            {pago.estadoMovimiento ||
                              "Activo"}
                          </p>
                        </div>
                      </div>
                    )
                  )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t bg-slate-50 p-4 sm:flex-row sm:justify-end md:p-5">
            {saldoSellos > 0 &&
              sellosDias.length >
                0 && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorSellos(
                      ""
                    );

                    setMontoPagoSellos(
                      ""
                    );

                    setReferenciaPagoSellos(
                      ""
                    );

                    setObservacionesPagoSellos(
                      ""
                    );

                    setMostrarPagoSellos(
                      true
                    );
                  }}
                  className="rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-black text-emerald-700"
                >
                  + Agregar pago
                </button>
              )}

            {sellosDias.length >
              0 && (
              <button
                type="button"
                onClick={
                  copiarMensajeSemanalSellos
                }
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white"
              >
                WhatsApp semanal
              </button>
            )}
          </div>
        </div>
      </div>

      {mostrarNuevoDia && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <p className="text-xs font-black uppercase text-violet-700">
                  Sellos
                </p>

                <h3 className="text-lg font-black">
                  Agregar día de envíos
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMostrarNuevoDia(
                    false
                  )
                }
                disabled={
                  guardandoSellos
                }
                className="text-2xl font-bold text-slate-400 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-sm font-bold">
                  Fecha
                </label>

                <input
                  type="date"
                  value={
                    fechaSello
                  }
                  onChange={(e) =>
                    setFechaSello(
                      e.target.value
                    )
                  }
                  disabled={
                    guardandoSellos
                  }
                  className="w-full rounded-xl border px-4 py-3 disabled:bg-slate-100"
                />

                <p className="mt-1 text-xs capitalize text-slate-500">
                  Semana:{" "}
                  {rangoSemanaSellos()}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-black">
                    G
                  </label>

                  <p className="mb-1 text-xs text-slate-500">
                    $650
                  </p>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      cantidadG
                    }
                    onChange={(e) =>
                      setCantidadG(
                        e.target
                          .value
                      )
                    }
                    disabled={
                      guardandoSellos
                    }
                    className="w-full rounded-xl border px-3 py-3 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-black">
                    C
                  </label>

                  <p className="mb-1 text-xs text-slate-500">
                    $350
                  </p>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      cantidadC
                    }
                    onChange={(e) =>
                      setCantidadC(
                        e.target
                          .value
                      )
                    }
                    disabled={
                      guardandoSellos
                    }
                    className="w-full rounded-xl border px-3 py-3 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-black">
                    M
                  </label>

                  <p className="mb-1 text-xs text-slate-500">
                    $550
                  </p>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      cantidadM
                    }
                    onChange={(e) =>
                      setCantidadM(
                        e.target
                          .value
                      )
                    }
                    disabled={
                      guardandoSellos
                    }
                    className="w-full rounded-xl border px-3 py-3 disabled:bg-slate-100"
                  />
                </div>
              </div>

              {errorSellos && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {
                    errorSellos
                  }
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t p-4">
              <button
                type="button"
                onClick={() =>
                  setMostrarNuevoDia(
                    false
                  )
                }
                disabled={
                  guardandoSellos
                }
                className="flex-1 rounded-xl border px-4 py-3 font-bold disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={
                  guardarDiaSellos
                }
                disabled={
                  guardandoSellos
                }
                className="flex-1 rounded-xl bg-violet-700 px-4 py-3 font-black text-white disabled:opacity-60"
              >
                {guardandoSellos
                  ? "Guardando..."
                  : "Guardar día"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarPagoSellos && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="border-b p-4">
              <p className="text-xs font-black uppercase text-emerald-700">
                Pago de sellos
              </p>

              <h3 className="mt-1 text-lg font-black">
                Registrar abono
              </h3>

              <p className="mt-1 text-xs capitalize text-slate-500">
                {rangoSemanaSellos()}
              </p>
            </div>

            <div className="space-y-4 p-4">
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs font-black uppercase text-amber-700">
                  Saldo pendiente
                </p>

                <p className="mt-1 text-2xl font-black text-amber-700">
                  {dinero(
                    saldoSellos
                  )}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">
                  Cantidad pagada
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    montoPagoSellos
                  }
                  onChange={(e) =>
                    setMontoPagoSellos(
                      e.target
                        .value
                    )
                  }
                  disabled={
                    guardandoSellos
                  }
                  className="w-full rounded-xl border px-4 py-3 text-lg font-black disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">
                  Referencia
                </label>

                <input
                  value={
                    referenciaPagoSellos
                  }
                  onChange={(e) =>
                    setReferenciaPagoSellos(
                      e.target
                        .value
                    )
                  }
                  disabled={
                    guardandoSellos
                  }
                  placeholder="Opcional"
                  className="w-full rounded-xl border px-4 py-3 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">
                  Observaciones
                </label>

                <textarea
                  value={
                    observacionesPagoSellos
                  }
                  onChange={(e) =>
                    setObservacionesPagoSellos(
                      e.target
                        .value
                    )
                  }
                  disabled={
                    guardandoSellos
                  }
                  rows={3}
                  placeholder="Opcional"
                  className="w-full resize-none rounded-xl border px-4 py-3 disabled:bg-slate-100"
                />
              </div>

              {errorSellos && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {
                    errorSellos
                  }
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t p-4">
              <button
                type="button"
                onClick={() =>
                  setMostrarPagoSellos(
                    false
                  )
                }
                disabled={
                  guardandoSellos
                }
                className="flex-1 rounded-xl border px-4 py-3 font-bold disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={
                  guardarPagoSellos
                }
                disabled={
                  guardandoSellos
                }
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:opacity-60"
              >
                {guardandoSellos
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