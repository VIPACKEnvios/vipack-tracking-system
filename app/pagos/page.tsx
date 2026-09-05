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
};

function dinero(valor: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(valor || 0);
}

function EstadoPago({ estado }: { estado: PagoRow["estado"] }) {
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
  const [pagos, setPagos] = useState<PagoRow[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarPagos();
  }, []);

  async function cargarPagos() {
    try {
      setCargando(true);
      setError("");

      const respuesta = await fetch("/api/pagos", {
        cache: "no-store",
      });

      if (!respuesta.ok) {
        throw new Error("No fue posible cargar los pagos.");
      }

      const data = await respuesta.json();

      setPagos(Array.isArray(data) ? data : data.pagos || []);
    } catch (err) {
      console.error(err);
      setError(
        "Todavía falta conectar la base de datos de pagos con las cotizaciones."
      );
      setPagos([]);
    } finally {
      setCargando(false);
    }
  }

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) return pagos;

    return pagos.filter((pago) => {
      return (
        pago.folio?.toLowerCase().includes(texto) ||
        pago.cliente?.toLowerCase().includes(texto) ||
        pago.whatsapp?.toLowerCase().includes(texto)
      );
    });
  }, [pagos, busqueda]);

  const totales = useMemo(() => {
    return pagos.reduce(
      (acc, pago) => {
        acc.cotizado += Number(pago.total || 0);
        acc.cobrado += Number(pago.pagado || 0);
        acc.pendiente += Number(pago.saldo || 0);

        return acc;
      },
      {
        cotizado: 0,
        cobrado: 0,
        pendiente: 0,
      }
    );
  }, [pagos]);

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

          <button
            type="button"
            className="rounded-xl bg-blue-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-900"
          >
            + Registrar pago
          </button>
        </div>

        {/* RESUMEN */}
        <div className="mb-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total cotizado
            </p>

            <p className="mt-2 text-2xl font-black text-slate-950">
              {dinero(totales.cotizado)}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Cobrado
            </p>

            <p className="mt-2 text-2xl font-black text-emerald-700">
              {dinero(totales.cobrado)}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Saldo pendiente
            </p>

            <p className="mt-2 text-2xl font-black text-amber-700">
              {dinero(totales.pendiente)}
            </p>
          </div>
        </div>

        {/* CONTENIDO */}
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
                onChange={(e) => setBusqueda(e.target.value)}
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
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {error}
              </div>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-bold text-slate-800">
                No hay registros para mostrar.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Las cotizaciones aparecerán aquí cuando conectemos el módulo de
                pagos.
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
                  {filtrados.map((pago) => (
                    <tr
                      key={pago.folio}
                      className="border-b border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-bold text-blue-800">{pago.folio}</p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">
                          {pago.cliente}
                        </p>

                        <p className="text-xs text-slate-500">
                          {pago.whatsapp}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {pago.fecha}
                      </td>

                      <td className="px-5 py-4 text-right font-bold text-slate-900">
                        {dinero(pago.total)}
                      </td>

                      <td className="px-5 py-4 text-right font-bold text-emerald-700">
                        {dinero(pago.pagado)}
                      </td>

                      <td className="px-5 py-4 text-right font-black text-slate-900">
                        {dinero(pago.saldo)}
                      </td>

                      <td className="px-5 py-4">
                        <EstadoPago estado={pago.estado} />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Ver / Abonar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}