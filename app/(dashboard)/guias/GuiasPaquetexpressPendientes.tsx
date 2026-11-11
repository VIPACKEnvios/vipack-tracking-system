"use client";
import TelefonoDestinatario from "./TelefonoDestinatario";

import { useCallback, useEffect, useMemo, useState } from "react";

type GuiaPaquetexpress = {
  id: number;
  guia: string;
  tipo_evento: string;
  fecha_evento: string;
  estado: "pendiente" | "asignado";
  envio_id: number | null;
  destinatario_nombre?: string | null;
};

type EventoHistorial = {
  id: number;
  guia: string;
  tipo_evento: string;
  fecha_evento: string;
};

function nombreEvento(tipo: string) {
  switch (tipo) {
    case "recoleccion":
      return "Recolección";
    case "comienzo_viaje":
      return "Comienzo del viaje";
    case "entregado":
      return "Entregado";
    default:
      return tipo;
  }
}

function mostrarFecha(fecha: string) {
  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return "Fecha no disponible";
  }

  return valor.toLocaleString("es-MX", {
    timeZone: "America/Tijuana",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function GuiasPaquetexpressPendientes() {
  const [guias, setGuias] = useState<GuiaPaquetexpress[]>([]);
  const [eventos, setEventos] = useState<EventoHistorial[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<
    "todas" | "pendiente" | "asignado"
  >("todas");
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] =
    useState<string | null>(null);

  const cargarGuias = useCallback(async (signal?: AbortSignal) => {
    setCargando(true);
    setError("");

    try {
      const respuesta = await fetch(
        "/api/guias-paquexpress/pendientes",
        {
          cache: "no-store",
          signal,
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok || !datos.success) {
        throw new Error(
          datos.error || "No se pudieron cargar las guías."
        );
      }

      setGuias(Array.isArray(datos.guias) ? datos.guias : []);
      setEventos(Array.isArray(datos.eventos) ? datos.eventos : []);
      setUltimaActualizacion(new Date().toISOString());
    } catch (err) {
      if (signal?.aborted) return;

      setError(
        err instanceof Error
          ? err.message
          : "Error desconocido."
      );
    } finally {
      if (!signal?.aborted) {
        setCargando(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void cargarGuias(controller.signal);

    return () => controller.abort();
  }, [cargarGuias]);

  const pendientes = guias.filter(
    (guia) => guia.estado === "pendiente"
  ).length;

  const asignadas = guias.filter(
    (guia) => guia.estado === "asignado"
  ).length;

  const historialPorGuia = useMemo(() => {
    const mapa = new Map<string, EventoHistorial[]>();

    for (const evento of eventos) {
      const lista = mapa.get(evento.guia) || [];
      lista.push(evento);
      mapa.set(evento.guia, lista);
    }

    for (const lista of mapa.values()) {
      lista.sort(
        (a, b) =>
          new Date(a.fecha_evento).getTime() -
          new Date(b.fecha_evento).getTime()
      );
    }

    return mapa;
  }, [eventos]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return guias
      .filter(
        (guia) =>
          filtro === "todas" || guia.estado === filtro
      )
      .filter(
        (guia) =>
          guia.guia.toLowerCase().includes(texto) ||
          (guia.destinatario_nombre || "")
            .toLowerCase()
            .includes(texto)
      )
      .sort((a, b) => {
        const eventosA = historialPorGuia.get(a.guia) || [];
        const eventosB = historialPorGuia.get(b.guia) || [];

        const fechaA = Math.max(
          new Date(a.fecha_evento).getTime() || 0,
          ...eventosA.map(
            (evento) =>
              new Date(evento.fecha_evento).getTime() || 0
          )
        );

        const fechaB = Math.max(
          new Date(b.fecha_evento).getTime() || 0,
          ...eventosB.map(
            (evento) =>
              new Date(evento.fecha_evento).getTime() || 0
          )
        );

        return fechaB - fechaA;
      });
  }, [guias, busqueda, filtro, historialPorGuia]);

  return (
    <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-blue-950">
            Seguimiento Paquetexpress
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Guías y movimientos registrados desde Hotmail
          </p>
          {ultimaActualizacion && (
            <p className="mt-1 text-xs text-gray-400">
              Consulta actualizada:{" "}
              {mostrarFecha(ultimaActualizacion)}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void cargarGuias()}
          disabled={cargando}
          className="rounded-xl bg-blue-900 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50"
        >
          {cargando ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-blue-50 p-4">
          <p className="text-sm text-blue-800">Total de guías</p>
          <p className="text-2xl font-bold text-blue-950">
            {guias.length}
          </p>
        </div>

        <div className="rounded-xl bg-amber-50 p-4">
          <p className="text-sm text-amber-800">Pendientes</p>
          <p className="text-2xl font-bold text-amber-950">
            {pendientes}
          </p>
        </div>

        <div className="rounded-xl bg-emerald-50 p-4">
          <p className="text-sm text-emerald-800">Asignadas</p>
          <p className="text-2xl font-bold text-emerald-950">
            {asignadas}
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar guía o destinatario"
          className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-700"
        />

        <select
          value={filtro}
          onChange={(e) =>
            setFiltro(
              e.target.value as
                | "todas"
                | "pendiente"
                | "asignado"
            )
          }
          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900"
        >
          <option value="todas">Todas las guías</option>
          <option value="pendiente">Pendientes</option>
          <option value="asignado">Asignadas</option>
        </select>
      </div>

      {cargando && (
        <p className="py-6 text-center text-gray-500">
          Consultando guías de Paquetexpress...
        </p>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}

      {!cargando && !error && filtradas.length === 0 && (
        <p className="rounded-xl bg-gray-50 p-6 text-center text-gray-500">
          No se encontraron guías con esos filtros.
        </p>
      )}

      {!cargando && !error && (
        <div className="space-y-3">
          {filtradas.map((guia) => {
            const historial =
              historialPorGuia.get(guia.guia) || [];

            const ultimoEvento =
              historial.length > 0
                ? historial[historial.length - 1]
                : null;

            const expandida = seleccionada === guia.guia;

            return (
              <article
                key={guia.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-all text-lg font-bold text-blue-950">
                        {guia.guia}
                      </p>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          guia.estado === "asignado"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {guia.estado === "asignado"
                          ? "Asignada"
                          : "Pendiente"}
                      </span>
                    </div>

                    {guia.destinatario_nombre && (
                      <>
                        <p className="mt-1 text-sm text-gray-700">
                          Destinatario: {guia.destinatario_nombre}
                        </p>
                        <TelefonoDestinatario
                          guia={guia.guia}
                          destinatario={guia.destinatario_nombre}
                        />
                      </>
                    )}

                    <p className="mt-2 text-sm font-medium text-gray-800">
                      {nombreEvento(
                        ultimoEvento?.tipo_evento ||
                          guia.tipo_evento
                      )}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Fecha del correo:{" "}
                      {mostrarFecha(
                        ultimoEvento?.fecha_evento ||
                          guia.fecha_evento
                      )}
                    </p>

                    {guia.envio_id !== null && (
                      <p className="mt-1 text-xs text-gray-500">
                        Envío VIPACK #{guia.envio_id}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSeleccionada(
                        expandida ? null : guia.guia
                      )
                    }
                    aria-expanded={expandida}
                    className="rounded-xl border border-blue-900 px-4 py-2 font-medium text-blue-900 transition hover:bg-blue-50"
                  >
                    {expandida
                      ? "Ocultar historial"
                      : `Ver historial (${historial.length})`}
                  </button>
                </div>

                {expandida && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <h3 className="mb-3 font-semibold text-blue-950">
                      Historial de movimientos
                    </h3>

                    {historial.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Todavía no hay movimientos registrados.
                      </p>
                    ) : (
                      <ol className="space-y-3">
                        {historial.map((evento) => (
                          <li
                            key={evento.id}
                            className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3"
                          >
                            <div className="mt-1 flex flex-col items-center">
                              <span className="h-3 w-3 rounded-full bg-blue-700" />
                              <span className="mt-1 h-full min-h-4 w-px bg-blue-200" />
                            </div>

                            <div>
                              <p className="font-semibold text-gray-900">
                                {nombreEvento(evento.tipo_evento)}
                              </p>
                              <p className="mt-1 text-sm text-gray-500">
                                {mostrarFecha(evento.fecha_evento)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
