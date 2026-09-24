"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PaqueteUSA = {
  id: string;
  cliente: string;
  tokenCliente: string;
  rastreo: string;
  tienda: string;
  fechaRegistro: string;
  estatus: string;
  fechaRecibido: string;
  fechaCompra: string;
};

type ResumenPaquetes = {
  total: number;
  registrados: number;
  recibidos: number;
};

type RespuestaPaquetes = {
  success: boolean;
  paquetes?: PaqueteUSA[];
  resumen?: ResumenPaquetes;
  error?: string;
};

export default function PaquetesUSAPage() {
  const [paquetes, setPaquetes] = useState<PaqueteUSA[]>([]);
  const [resumen, setResumen] = useState<ResumenPaquetes>({
    total: 0,
    registrados: 0,
    recibidos: 0,
  });

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [recibiendoId, setRecibiendoId] = useState<string | null>(
    null
  );

  const cargarPaquetes = useCallback(async () => {
    try {
      setError("");

      const respuesta = await fetch("/api/admin/paquetes-usa", {
        method: "GET",
        cache: "no-store",
      });

      const data: RespuestaPaquetes = await respuesta.json();

      if (!respuesta.ok || !data.success) {
        throw new Error(
          data.error || "No se pudieron cargar los paquetes."
        );
      }

      setPaquetes(data.paquetes || []);

      setResumen(
        data.resumen || {
          total: 0,
          registrados: 0,
          recibidos: 0,
        }
      );
    } catch (err) {
      console.error("Error cargando Paquetes USA:", err);

      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los paquetes."
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarPaquetes();
  }, [cargarPaquetes]);

  const paquetesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    if (!termino) {
      return paquetes;
    }

    return paquetes.filter((paquete) => {
      return (
        paquete.rastreo.toLowerCase().includes(termino) ||
        paquete.cliente.toLowerCase().includes(termino) ||
        paquete.tienda.toLowerCase().includes(termino) ||
        paquete.estatus.toLowerCase().includes(termino)
      );
    });
  }, [paquetes, busqueda]);

  async function marcarRecibido(paquete: PaqueteUSA) {
    if (
      paquete.estatus.trim().toLowerCase() === "recibido"
    ) {
      return;
    }

    const confirmar = window.confirm(
      `¿Confirmas que recibiste este paquete?\n\n` +
        `Cliente: ${paquete.cliente}\n` +
        `Rastreo: ${paquete.rastreo}\n` +
        `Tienda: ${paquete.tienda}`
    );

    if (!confirmar) {
      return;
    }

    try {
      setRecibiendoId(paquete.id);
      setError("");

      const respuesta = await fetch(
        "/api/admin/paquetes-usa",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: paquete.id,
          }),
        }
      );

      const data = await respuesta.json();

      if (!respuesta.ok || !data.success) {
        throw new Error(
          data.error ||
            "No se pudo marcar el paquete como recibido."
        );
      }

      await cargarPaquetes();
    } catch (err) {
      console.error("Error recibiendo paquete:", err);

      setError(
        err instanceof Error
          ? err.message
          : "No se pudo marcar el paquete como recibido."
      );
    } finally {
      setRecibiendoId(null);
    }
  }

  return (
    <div className="min-h-full bg-slate-100">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-6 lg:px-8">
        {/* ENCABEZADO */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-600">
              Operación interna
            </p>

            <h1 className="text-3xl font-black tracking-tight text-[#071b3f]">
              Paquetes USA
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Consulta los paquetes registrados por las clientas y
              confirma cuando lleguen a Tijuana.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setCargando(true);
              cargarPaquetes();
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/10 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={cargando}
          >
            <IconoActualizar />

            {cargando ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        {/* RESUMEN */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TarjetaResumen
            titulo="Total"
            valor={resumen.total}
            descripcion="Paquetes registrados"
            tipo="total"
          />

          <TarjetaResumen
            titulo="Por recibir"
            valor={resumen.registrados}
            descripcion="Pendientes en Tijuana"
            tipo="pendiente"
          />

          <TarjetaResumen
            titulo="Recibidos"
            valor={resumen.recibidos}
            descripcion="Confirmados"
            tipo="recibido"
          />
        </div>

        {/* CONTENIDO */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-[#071b3f]">
                  Registro de paquetes
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Busca por número de rastreo, cliente, tienda o
                  estatus.
                </p>
              </div>

              <div className="relative w-full md:max-w-md">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <IconoBuscar />
                </span>

                <input
                  type="text"
                  value={busqueda}
                  onChange={(event) =>
                    setBusqueda(event.target.value)
                  }
                  placeholder="Buscar rastreo, cliente o tienda..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 md:m-5">
              {error}
            </div>
          )}

          {/* CARGANDO */}
          {cargando ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />

              <p className="font-black text-[#071b3f]">
                Cargando paquetes...
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Consultando el registro de Paquetes USA.
              </p>
            </div>
          ) : paquetesFiltrados.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <IconoCaja />
              </div>

              <h3 className="text-lg font-black text-[#071b3f]">
                {busqueda
                  ? "No encontramos coincidencias"
                  : "No hay paquetes registrados"}
              </h3>

              <p className="mt-2 max-w-md text-sm text-slate-500">
                {busqueda
                  ? "Prueba buscando con otro número de rastreo, nombre de cliente o tienda."
                  : "Cuando una clienta registre un paquete desde su inventario aparecerá aquí."}
              </p>
            </div>
          ) : (
            <>
              {/* ESCRITORIO */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Cliente
                      </th>

                      <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Rastreo
                      </th>

                      <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Tienda
                      </th>

                      <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Compra
                      </th>

                      <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Registro
                      </th>

                      <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Estado
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-black uppercase tracking-wide text-slate-500">
                        Acción
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {paquetesFiltrados.map((paquete) => {
                      const recibido =
                        paquete.estatus
                          .trim()
                          .toLowerCase() === "recibido";

                      const procesando =
                        recibiendoId === paquete.id;

                      return (
                        <tr
                          key={paquete.id}
                          className="transition hover:bg-slate-50/80"
                        >
                          <td className="px-5 py-4">
                            <p className="max-w-[260px] font-bold text-slate-800">
                              {paquete.cliente || "Sin cliente"}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {paquete.id}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-mono text-sm font-black text-[#072c74]">
                              {paquete.rastreo || "—"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                            {paquete.tienda || "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {paquete.fechaCompra || "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {paquete.fechaRegistro || "—"}
                          </td>

                          <td className="px-5 py-4">
                            <EstadoPaquete
                              recibido={recibido}
                              fechaRecibido={
                                paquete.fechaRecibido
                              }
                            />
                          </td>

                          <td className="px-5 py-4 text-right">
                            {recibido ? (
                              <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-black text-emerald-700">
                                <IconoCheck />
                                Recibido
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  marcarRecibido(paquete)
                                }
                                disabled={procesando}
                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {procesando ? (
                                  <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                    Guardando...
                                  </>
                                ) : (
                                  <>
                                    <IconoCheck />
                                    Recibir
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* CELULAR */}
              <div className="space-y-3 p-3 md:hidden">
                {paquetesFiltrados.map((paquete) => {
                  const recibido =
                    paquete.estatus
                      .trim()
                      .toLowerCase() === "recibido";

                  const procesando =
                    recibiendoId === paquete.id;

                  return (
                    <article
                      key={paquete.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#071b3f]">
                            {paquete.cliente || "Sin cliente"}
                          </p>

                          <p className="mt-1 break-all font-mono text-sm font-black text-blue-700">
                            {paquete.rastreo || "Sin rastreo"}
                          </p>
                        </div>

                        <EstadoPaquete
                          recibido={recibido}
                          fechaRecibido=""
                          compacto
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3">
                        <Dato
                          titulo="Tienda"
                          valor={paquete.tienda || "—"}
                        />

                        <Dato
                          titulo="Compra"
                          valor={paquete.fechaCompra || "—"}
                        />

                        <Dato
                          titulo="Registro"
                          valor={paquete.fechaRegistro || "—"}
                        />

                        <Dato
                          titulo="Recibido"
                          valor={
                            paquete.fechaRecibido ||
                            "Pendiente"
                          }
                        />
                      </div>

                      {!recibido && (
                        <button
                          type="button"
                          onClick={() =>
                            marcarRecibido(paquete)
                          }
                          disabled={procesando}
                          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {procesando ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <IconoCheck />
                              Marcar recibido
                            </>
                          )}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>

              <div className="border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 md:px-5">
                Mostrando {paquetesFiltrados.length} de{" "}
                {paquetes.length} paquete
                {paquetes.length === 1 ? "" : "s"}.
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function TarjetaResumen({
  titulo,
  valor,
  descripcion,
  tipo,
}: {
  titulo: string;
  valor: number;
  descripcion: string;
  tipo: "total" | "pendiente" | "recibido";
}) {
  const estilos = {
    total: {
      caja: "border-blue-200 bg-blue-50",
      icono: "bg-blue-600 text-white",
      numero: "text-blue-800",
    },

    pendiente: {
      caja: "border-amber-200 bg-amber-50",
      icono: "bg-amber-500 text-white",
      numero: "text-amber-800",
    },

    recibido: {
      caja: "border-emerald-200 bg-emerald-50",
      icono: "bg-emerald-600 text-white",
      numero: "text-emerald-800",
    },
  };

  const estilo = estilos[tipo];

  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border p-4 shadow-sm ${estilo.caja}`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${estilo.icono}`}
      >
        {tipo === "recibido" ? (
          <IconoCheck />
        ) : (
          <IconoCaja />
        )}
      </div>

      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
          {titulo}
        </p>

        <p
          className={`text-3xl font-black leading-none ${estilo.numero}`}
        >
          {valor}
        </p>

        <p className="mt-1 text-xs font-semibold text-slate-500">
          {descripcion}
        </p>
      </div>
    </div>
  );
}

function EstadoPaquete({
  recibido,
  fechaRecibido,
  compacto = false,
}: {
  recibido: boolean;
  fechaRecibido: string;
  compacto?: boolean;
}) {
  if (recibido) {
    return (
      <div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-100 font-black text-emerald-700 ${
            compacto
              ? "px-2.5 py-1 text-[11px]"
              : "px-3 py-1.5 text-xs"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Recibido
        </span>

        {!compacto && fechaRecibido && (
          <p className="mt-1 text-xs font-semibold text-slate-400">
            {fechaRecibido}
          </p>
        )}
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-blue-100 font-black text-blue-700 ${
        compacto
          ? "px-2.5 py-1 text-[11px]"
          : "px-3 py-1.5 text-xs"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-blue-500" />
      Registrado
    </span>
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
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {titulo}
      </p>

      <p className="mt-0.5 break-words text-xs font-bold text-slate-700">
        {valor}
      </p>
    </div>
  );
}

function IconoBuscar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function IconoCaja() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="m3 7 9-4 9 4-9 4-9-4Z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  );
}

function IconoCheck() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function IconoActualizar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M20 6v6h-6" />
      <path d="M4 18v-6h6" />
      <path d="M6.5 8a7 7 0 0 1 11.5-2L20 8" />
      <path d="M17.5 16A7 7 0 0 1 6 18l-2-2" />
    </svg>
  );
}