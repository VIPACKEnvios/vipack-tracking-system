
"use client";

import { useEffect, useState } from "react";

type GuiaPendiente = {
  id: number;
  guia: string;
  tipo_evento: string;
  fecha_evento: string;
  estado: string;
  envio_id: number | null;
};

type EventoHistorial = {
  id: number;
  guia: string;
  tipo_evento: string;
  fecha_evento: string;
};

export default function GuiasPaquetexpressPendientes() {
  const [guias, setGuias] = useState<GuiaPendiente[]>([]);
  const [eventos, setEventos] = useState<EventoHistorial[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargarGuias() {
    setCargando(true);
    setError("");

    try {
      const respuesta = await fetch(
        "/api/guias-paquexpress/pendientes",
        { cache: "no-store" }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok || !datos.success) {
        throw new Error(datos.error || "No se pudieron cargar las guías.");
      }

      setGuias(datos.guias || []);
      setEventos(datos.eventos || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error desconocido."
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarGuias();
  }, []);

  const pendientes = guias.filter(
    (guia) => guia.estado === "pendiente"
  );

  const filtradas = pendientes.filter((guia) =>
    guia.guia.includes(busqueda.trim())
  );

  const nombreEvento = (tipo: string) => {
    if (tipo === "recoleccion") return "Recolección";
    if (tipo === "comienzo_viaje") return "Comienzo del viaje";
    if (tipo === "entregado") return "Entregado";
    return tipo;
  };

  const mostrarFecha = (fecha: string) =>
    new Date(fecha).toLocaleString("es-MX", {
      timeZone: "America/Tijuana",
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-950">
            Guías pendientes de Paquetexpress
          </h2>
          <p className="text-sm text-gray-500">
            Detectadas automáticamente desde Hotmail
          </p>
        </div>

        <button
          type="button"
          onClick={() => void cargarGuias()}
          disabled={cargando}
          className="rounded-lg bg-blue-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Actualizar
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-amber-100 px-3 py-2 font-semibold text-amber-900">
          {pendientes.length} pendientes
        </span>

        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar número de guía"
          className="min-w-64 flex-1 rounded-lg border p-3"
        />
      </div>

      {cargando && <p>Cargando guías...</p>}

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {!cargando && !error && filtradas.length === 0 && (
        <p className="text-gray-500">No hay guías pendientes.</p>
      )}

      {!cargando && !error && (
        <div className="space-y-3">
          {filtradas.map((guia) => {
            const historial = eventos
              .filter((evento) => evento.guia === guia.guia)
              .sort(
                (a, b) =>
                  new Date(a.fecha_evento).getTime() -
                  new Date(b.fecha_evento).getTime()
              );

            return (
              <div
                key={guia.id}
                className="rounded-xl border border-gray-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-blue-950">
                      {guia.guia}
                    </p>
                    <p className="text-sm text-gray-600">
                      {nombreEvento(guia.tipo_evento)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {mostrarFecha(guia.fecha_evento)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSeleccionada(
                        seleccionada === guia.guia ? null : guia.guia
                      )
                    }
                    className="rounded-lg border border-blue-900 px-4 py-2 text-blue-900"
                  >
                    {seleccionada === guia.guia
                      ? "Ocultar historial"
                      : `Ver historial (${historial.length})`}
                  </button>
                </div>

                {seleccionada === guia.guia && (
                  <div className="mt-4 border-t pt-3">
                    <h3 className="mb-2 font-semibold">
                      Historial de movimientos
                    </h3>

                    {historial.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Sin eventos registrados.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {historial.map((evento) => (
                          <li
                            key={evento.id}
                            className="rounded-lg bg-gray-50 p-3 text-sm"
                          >
                            <span className="font-medium">
                              {nombreEvento(evento.tipo_evento)}
                            </span>
                            <span className="ml-2 text-gray-500">
                              {mostrarFecha(evento.fecha_evento)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
