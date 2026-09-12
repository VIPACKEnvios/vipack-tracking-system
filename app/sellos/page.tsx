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

type ResumenPdfSellos = {
  dias: SelloDia[];
  pagos: PagoSellos[];
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

  const [saldoAtrasadoSellos, setSaldoAtrasadoSellos] =
    useState(0);

  const [saldoSemanaSellos, setSaldoSemanaSellos] =
    useState(0);

  const [saldoPendienteTotalSellos, setSaldoPendienteTotalSellos] =
    useState(0);

  const [resumenPdfSellos, setResumenPdfSellos] =
    useState<ResumenPdfSellos>({
      dias: [],
      pagos: [],
    });

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

  const [fechaPagoSellos, setFechaPagoSellos] =
    useState("");

  const [montoPagoSellos, setMontoPagoSellos] =
    useState("");

  const [referenciaPagoSellos, setReferenciaPagoSellos] =
    useState("");

  const [observacionesPagoSellos, setObservacionesPagoSellos] =
    useState("");

  async function cargarSellos(
    semanaObjetivo: string,
    signal?: AbortSignal
  ) {
    try {
      setCargandoSellos(true);
      setErrorSellos("");

      const respuesta = await fetch(
        `/api/sellos?semana=${encodeURIComponent(semanaObjetivo)}`,
        {
          cache: "no-store",
          signal,
        }
      );

      const data = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          data?.error ||
            "No fue posible cargar los sellos."
        );
      }

      // Seguridad contra respuestas atrasadas:
      // si el usuario cambió de semana mientras cargaba,
      // una respuesta vieja NO puede reemplazar la semana actual.
      if (
        data?.semana &&
        data.semana !== semanaObjetivo
      ) {
        return;
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

      setSaldoAtrasadoSellos(
        Number(
          data?.resumenAcumulado?.saldoAtrasado ||
            0
        )
      );

      setSaldoSemanaSellos(
        Number(
          data?.resumenAcumulado?.saldoSemana ||
            0
        )
      );

      setSaldoPendienteTotalSellos(
        Number(
          data?.resumenAcumulado?.saldoPendienteTotal ||
            0
        )
      );

      setResumenPdfSellos({
        dias: Array.isArray(
          data?.resumenPdf?.dias
        )
          ? data.resumenPdf.dias
          : [],
        pagos: Array.isArray(
          data?.resumenPdf?.pagos
        )
          ? data.resumenPdf.pagos
          : [],
      });
    } catch (err) {
      if (
        err instanceof DOMException &&
        err.name === "AbortError"
      ) {
        return;
      }

      console.error(err);

      setSellosDias([]);
      setPagosSellos([]);
      setSaldoAtrasadoSellos(0);
      setSaldoSemanaSellos(0);
      setSaldoPendienteTotalSellos(0);
      setResumenPdfSellos({
        dias: [],
        pagos: [],
      });

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
    const controller =
      new AbortController();

    cargarSellos(
      semanaSellos,
      controller.signal
    );

    return () => {
      controller.abort();
    };
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

      const semanaDeLaFecha =
        obtenerLunesSemana(
          new Date(
            `${fechaSello}T12:00:00`
          )
        );

      setMensajeSellos(
        "Día de sellos guardado correctamente."
      );

      if (
        semanaDeLaFecha !==
        semanaSellos
      ) {
        setSemanaSellos(
          semanaDeLaFecha
        );
      } else {
        await cargarSellos(semanaSellos);
      }

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

      await cargarSellos(semanaSellos);

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

  // El saldo NO depende de repartir pagos por semana.
  // El backend calcula el pendiente acumulado con los pagos
  // exactamente como fueron registrados.
  const saldoSellos =
    saldoSemanaSellos;

  const saldoTotalPendienteSellos =
    saldoPendienteTotalSellos;

  const estadoSellos =
    totalSemanalSellos > 0 &&
    saldoSellos <= 0
      ? "LIQUIDADO"
      : totalPagadoSellos > 0
      ? "PARCIAL"
      : "PENDIENTE";

  async function guardarPagoSellos() {
    if (!fechaPagoSellos) {
      setErrorSellos(
        "Selecciona la fecha real del pago."
      );
      return;
    }

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
      monto >
      saldoTotalPendienteSellos
    ) {
      setErrorSellos(
        `El pago no puede ser mayor al pendiente total de ${dinero(
          saldoTotalPendienteSellos
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
              fecha: fechaPagoSellos,
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

      setFechaPagoSellos("");
      setMontoPagoSellos("");
      setReferenciaPagoSellos("");
      setObservacionesPagoSellos("");

      setMostrarPagoSellos(false);

      setMensajeSellos(
        "Pago de sellos guardado correctamente."
      );

      await cargarSellos(semanaSellos);

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
Pagado esta semana: ${dinero(
      totalPagadoSellos
    )}
Pendiente esta semana: ${dinero(
      saldoSellos
    )}
Saldo atrasado: ${dinero(
      saldoAtrasadoSellos
    )}
*PENDIENTE TOTAL: ${dinero(
      saldoTotalPendienteSellos
    )}*
Estado de esta semana: *${estadoSellos}*`;
  }

  function copiarMensajeSemanalSellos() {
    abrirWhatsAppConMensaje(
      mensajeSemanalSellos()
    );
  }

  function crearPdfSellos() {
    const dias =
      resumenPdfSellos.dias || [];

    const pagos =
      resumenPdfSellos.pagos || [];

    if (
      dias.length === 0 &&
      pagos.length === 0
    ) {
      setErrorSellos(
        "Todavía no hay información para generar el PDF."
      );
      return;
    }

    const escaparHtml = (
      valor: unknown
    ) =>
      String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const semanas =
      Array.from(
        new Set(
          dias
            .map(
              (dia) =>
                dia.semana
            )
            .filter(Boolean)
        )
      ).sort();

    const filasSemanas =
      semanas
        .map((semana) => {
          const diasSemana =
            dias.filter(
              (dia) =>
                dia.semana ===
                semana
            );

          const pagosSemana =
            pagos.filter(
              (pago) =>
                pago.semana ===
                  semana &&
                pago.estadoMovimiento !==
                  "Anulado"
            );

          const totalSemana =
            diasSemana.reduce(
              (acc, dia) =>
                acc +
                Number(
                  dia.total ??
                    (
                      dia.g *
                        PRECIO_G +
                      dia.c *
                        PRECIO_C +
                      dia.m *
                        PRECIO_M
                    )
                ),
              0
            );

          const pagadoSemana =
            pagosSemana.reduce(
              (acc, pago) =>
                acc +
                Number(
                  pago.monto || 0
                ),
              0
            );

          const detalleDias =
            diasSemana
              .map((dia) => {
                const total =
                  Number(
                    dia.total ??
                      (
                        dia.g *
                          PRECIO_G +
                        dia.c *
                          PRECIO_C +
                        dia.m *
                          PRECIO_M
                      )
                  );

                return `
                  <tr>
                    <td>${escaparHtml(
                      fechaBonitaSellos(
                        dia.fecha
                      )
                    )}</td>
                    <td class="num">${dia.g}</td>
                    <td class="num">${dia.c}</td>
                    <td class="num">${dia.m}</td>
                    <td class="num">$${total.toLocaleString(
                      "es-MX"
                    )}</td>
                  </tr>
                `;
              })
              .join("");

          const detallePagos =
            pagosSemana.length > 0
              ? pagosSemana
                  .map((pago) => `
                    <tr>
                      <td>${escaparHtml(
                        pago.fecha
                      )}</td>
                      <td class="num"><strong>$${Number(
                        pago.monto || 0
                      ).toLocaleString(
                        "es-MX"
                      )}</strong></td>
                      <td>${escaparHtml(
                        pago.referencia ||
                          "-"
                      )}</td>
                      <td>${escaparHtml(
                        pago.observaciones ||
                          "-"
                      )}</td>
                    </tr>
                  `)
                  .join("")
              : `
                <tr>
                  <td colspan="4" class="vacio">
                    Sin pagos capturados para esta semana
                  </td>
                </tr>
              `;

          return `
            <section class="semana">
              <h2>Semana ${escaparHtml(
                semana
              )}</h2>

              <div class="resumen resumen-dos">
                <div>
                  <span>Cargos registrados en esta semana</span>
                  <strong>$${totalSemana.toLocaleString(
                    "es-MX"
                  )}</strong>
                </div>

                <div>
                  <span>Pagos registrados en esta semana</span>
                  <strong>$${pagadoSemana.toLocaleString(
                    "es-MX"
                  )}</strong>
                </div>
              </div>

              <h3>Detalle de sellos</h3>

              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>G</th>
                    <th>C</th>
                    <th>M</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${detalleDias}
                </tbody>
              </table>

              <h3>Pagos capturados</h3>

              <table>
                <thead>
                  <tr>
                    <th>Fecha del pago</th>
                    <th>Importe</th>
                    <th>Referencia</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${detallePagos}
                </tbody>
              </table>
            </section>
          `;
        })
        .join("");

    const totalGeneral =
      dias.reduce(
        (acc, dia) =>
          acc +
          Number(
            dia.total ??
              (
                dia.g *
                  PRECIO_G +
                dia.c *
                  PRECIO_C +
                dia.m *
                  PRECIO_M
              )
          ),
        0
      );

    const pagosActivos =
      pagos.filter(
        (pago) =>
          pago.estadoMovimiento !==
          "Anulado"
      );

    const totalPagadoGeneral =
      pagosActivos.reduce(
        (acc, pago) =>
          acc +
          Number(
            pago.monto || 0
          ),
        0
      );

    const saldoGeneral =
      Math.max(
        totalGeneral -
          totalPagadoGeneral,
        0
      );

    const ventana =
      window.open(
        "",
        "_blank",
        "width=1000,height=800"
      );

    if (!ventana) {
      setErrorSellos(
        "El navegador bloqueó la ventana del PDF. Permite ventanas emergentes e inténtalo nuevamente."
      );
      return;
    }

    ventana.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Resumen de pagos de sellos - VIPACK</title>

          <style>
            @page {
              size: letter;
              margin: 14mm;
            }

            * {
              box-sizing: border-box;
            }

            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #111827;
              margin: 0;
              font-size: 12px;
            }

            h1 {
              margin: 0;
              font-size: 24px;
            }

            .subtitulo {
              color: #6b7280;
              margin-top: 4px;
              margin-bottom: 18px;
            }

            .general {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              margin-bottom: 18px;
            }

            .general div,
            .resumen div {
              border: 1px solid #d1d5db;
              border-radius: 8px;
              padding: 10px;
            }

            .general span,
            .resumen span {
              display: block;
              color: #6b7280;
              font-size: 10px;
              text-transform: uppercase;
              margin-bottom: 4px;
            }

            .general strong {
              font-size: 18px;
            }

            .semana {
              margin-top: 18px;
              padding-top: 12px;
              border-top: 2px solid #111827;
              break-inside: avoid;
            }

            h2 {
              font-size: 16px;
              margin: 0 0 10px 0;
            }

            h3 {
              font-size: 12px;
              margin: 14px 0 6px 0;
            }

            .resumen {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
              margin-bottom: 8px;
            }

            .resumen.resumen-dos {
              grid-template-columns: repeat(2, 1fr);
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 8px;
            }

            th,
            td {
              border: 1px solid #d1d5db;
              padding: 6px 7px;
              text-align: left;
            }

            th {
              background: #f3f4f6;
              font-size: 10px;
              text-transform: uppercase;
            }

            .num {
              text-align: right;
            }

            .vacio {
              text-align: center;
              color: #6b7280;
              font-style: italic;
            }

            .nota {
              margin-top: 18px;
              border: 1px solid #f59e0b;
              background: #fffbeb;
              padding: 10px;
              border-radius: 8px;
              color: #92400e;
            }

            .acciones {
              margin: 16px 0;
            }

            .acciones button {
              border: 0;
              background: #111827;
              color: white;
              font-weight: bold;
              padding: 10px 16px;
              border-radius: 8px;
              cursor: pointer;
            }

            @media print {
              .acciones {
                display: none;
              }
            }
          </style>
        </head>

        <body>
          <h1>VIPACK Envíos</h1>

          <div class="subtitulo">
            Resumen detallado de sellos y pagos capturados
          </div>

          <div class="general">
            <div>
              <span>Total de sellos</span>
              <strong>$${totalGeneral.toLocaleString(
                "es-MX"
              )}</strong>
            </div>

            <div>
              <span>Total de pagos capturados</span>
              <strong>$${totalPagadoGeneral.toLocaleString(
                "es-MX"
              )}</strong>
            </div>

            <div>
              <span>Saldo según registros</span>
              <strong>$${saldoGeneral.toLocaleString(
                "es-MX"
              )}</strong>
            </div>
          </div>

          ${filasSemanas}

          <div class="nota">
            Este resumen conserva cada pago exactamente como fue capturado. Un pago no se divide entre semanas, aunque reduzca saldo atrasado. El saldo general se calcula restando los pagos activos al total acumulado de cargos. Los pagos anulados no se consideran dentro de los totales.
          </div>

          <div class="acciones">
            <button onclick="window.print()">
              Guardar / imprimir PDF
            </button>
          </div>

          <script>
            setTimeout(function () {
              window.print();
            }, 400);
          </script>
        </body>
      </html>
    `);

    ventana.document.close();
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

          <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-6 md:p-5">
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
                Pagos registrados
              </p>

              <p className="mt-1 text-xl font-black text-emerald-700">
                {dinero(
                  totalPagadoSellos
                )}
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-[10px] font-black uppercase text-amber-700">
                Pendiente semana
              </p>

              <p className="mt-1 text-xl font-black text-amber-700">
                {dinero(
                  saldoSellos
                )}
              </p>
            </div>

            <div className="rounded-xl bg-orange-50 p-4">
              <p className="text-[10px] font-black uppercase text-orange-700">
                Saldo atrasado
              </p>

              <p className="mt-1 text-xl font-black text-orange-700">
                {dinero(
                  saldoAtrasadoSellos
                )}
              </p>

              <p className="mt-1 text-[10px] text-orange-600">
                Semanas anteriores
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-[10px] font-black uppercase text-red-700">
                Pendiente total
              </p>

              <p className="mt-1 text-xl font-black text-red-700">
                {dinero(
                  saldoTotalPendienteSellos
                )}
              </p>

              <p className="mt-1 text-[10px] text-red-600">
                Semana actual + atrasado
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
                Estado semana
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
            {saldoTotalPendienteSellos >
              0 && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorSellos(
                      ""
                    );

                    setFechaPagoSellos(
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

            {resumenPdfSellos.dias.length >
              0 && (
                <button
                  type="button"
                  onClick={
                    crearPdfSellos
                  }
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white"
                >
                  📄 Crear PDF
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
                  onChange={(e) => {
                    const nuevaFecha =
                      e.target.value;

                    setFechaSello(
                      nuevaFecha
                    );

                    if (nuevaFecha) {
                      setSemanaSellos(
                        obtenerLunesSemana(
                          new Date(
                            `${nuevaFecha}T12:00:00`
                          )
                        )
                      );
                    }
                  }}
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
                  Pendiente total
                </p>

                <p className="mt-1 text-2xl font-black text-amber-700">
                  {dinero(
                    saldoTotalPendienteSellos
                  )}
                </p>

                <div className="mt-2 space-y-1 text-xs text-amber-800">
                  <p>
                    Atrasado:{" "}
                    <span className="font-black">
                      {dinero(
                        saldoAtrasadoSellos
                      )}
                    </span>
                  </p>

                  <p>
                    Semana actual:{" "}
                    <span className="font-black">
                      {dinero(
                        saldoSellos
                      )}
                    </span>
                  </p>
                </div>

                <p className="mt-2 text-[11px] text-amber-700">
                  El pago se guardará completo, exactamente por la cantidad capturada. El saldo pendiente acumulado se reducirá automáticamente.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">
                  Fecha real del pago
                </label>

                <input
                  type="date"
                  value={
                    fechaPagoSellos
                  }
                  onChange={(e) =>
                    setFechaPagoSellos(
                      e.target.value
                    )
                  }
                  disabled={
                    guardandoSellos
                  }
                  className="w-full rounded-xl border px-4 py-3 disabled:bg-slate-100"
                />

                <p className="mt-1 text-xs text-slate-500">
                  Puedes seleccionar una fecha anterior. Este pago seguirá perteneciendo a la semana de sellos mostrada arriba.
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