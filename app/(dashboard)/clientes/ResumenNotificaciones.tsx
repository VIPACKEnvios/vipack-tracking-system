"use client";

import { useCallback, useEffect, useState } from "react";

export type FiltroNotificaciones =
  | "todos"
  | "con_dispositivos"
  | "sin_dispositivos"
  | "confirmados";

export type ClienteNotificacion = {
  id_cliente: number;
  nombre: string;
  dispositivos_registrados: number;
  dispositivos_activos: number;
  ultima_confirmacion: string | null;
};

type Resumen = {
  clientes_activos: number;
  clientes_con_dispositivos: number;
  clientes_sin_dispositivos: number;
  dispositivos_activos: number;
  clientes_confirmados: number;
};

type Respuesta = {
  success: boolean;
  resumen?: Resumen;
  clientes?: ClienteNotificacion[];
  error?: string;
};

type Props = {
  filtro?: FiltroNotificaciones;
  onFiltroChange?: (filtro: FiltroNotificaciones) => void;
  onClientesChange?: (clientes: ClienteNotificacion[]) => void;
  onCargaChange?: (cargado: boolean) => void;
};

const opciones: {
  valor: FiltroNotificaciones;
  texto: string;
}[] = [
  { valor: "todos", texto: "Todos" },
  { valor: "con_dispositivos", texto: "Con dispositivos" },
  { valor: "sin_dispositivos", texto: "Sin dispositivos" },
  { valor: "confirmados", texto: "Confirmados" },
];

export default function ResumenNotificaciones({
  filtro = "todos",
  onFiltroChange,
  onClientesChange,
  onCargaChange,
}: Props) {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const actualizar = useCallback(async (signal?: AbortSignal) => {
    setCargando(true);
    onCargaChange?.(false);
    setError("");

    try {
      const respuesta = await fetch(
        "/api/admin/notificaciones-resumen",
        { cache: "no-store", signal }
      );

      const datos: Respuesta = await respuesta.json();

      if (!respuesta.ok || !datos.success || !datos.resumen) {
        throw new Error(
          datos.error || "No se pudo consultar el resumen."
        );
      }

      setResumen(datos.resumen);
      onCargaChange?.(true);
      onClientesChange?.(
        Array.isArray(datos.clientes) ? datos.clientes : []
      );
    } catch (e) {
      if (signal?.aborted) return;

      setError(
        e instanceof Error ? e.message : "Error desconocido."
      );
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  }, [onClientesChange, onCargaChange]);

  useEffect(() => {
    const controlador = new AbortController();

    void actualizar(controlador.signal);

    return () => controlador.abort();
  }, [actualizar]);

  const tarjetas = [
    {
      titulo: "Clientes con dispositivos activos",
      valor: resumen?.clientes_con_dispositivos,
      color: "text-emerald-700",
    },
    {
      titulo: "Clientes sin dispositivos activos",
      valor: resumen?.clientes_sin_dispositivos,
      color: "text-amber-700",
    },
    {
      titulo: "Dispositivos activos",
      valor: resumen?.dispositivos_activos,
      color: "text-indigo-700",
    },
    {
      titulo: "Clientes con prueba confirmada",
      valor: resumen?.clientes_confirmados,
      color: "text-sky-700",
    },
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#111c4b]">
            Resumen general de notificaciones
          </h2>
          <p className="text-sm text-slate-500">
            Clientes activos: {resumen?.clientes_activos ?? "—"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void actualizar()}
          disabled={cargando}
          className="rounded-xl bg-[#172d87] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {cargando ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tarjetas.map((tarjeta) => (
          <div
            key={tarjeta.titulo}
            className="rounded-2xl bg-slate-50 p-4"
          >
            <p className="text-xs font-semibold text-slate-500">
              {tarjeta.titulo}
            </p>
            <p className={`mt-2 text-3xl font-black ${tarjeta.color}`}>
              {tarjeta.valor ?? "—"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-3 text-sm font-bold text-[#111c4b]">
          Filtrar por notificaciones
        </p>

        <div className="flex flex-wrap gap-2">
          {opciones.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => onFiltroChange?.(opcion.valor)}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                filtro === opcion.valor
                  ? "bg-[#172d87] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-indigo-50"
              }`}
            >
              {opcion.texto}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Una prueba confirmada indica que el navegador procesó
        una notificación de diagnóstico, no que el cliente la leyó.
      </p>
    </section>
  );
}