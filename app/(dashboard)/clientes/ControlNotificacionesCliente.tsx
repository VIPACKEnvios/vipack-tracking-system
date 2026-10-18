"use client";

import { useCallback, useEffect, useState } from "react";

type Respuesta = {
  success: boolean;
  notificaciones?: {
    dispositivos_registrados: number | string;
    dispositivos_activos: number | string;
    ultima_confirmacion: string | null;
  };
  error?: string;
};

export default function ControlNotificacionesCliente({
  clienteId,
}: {
  clienteId: number;
}) {
  const [datos, setDatos] = useState<Respuesta["notificaciones"]>(undefined);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const actualizar = useCallback(async (signal?: AbortSignal) => {
    setCargando(true);
    setError("");

    try {
      const respuesta = await fetch(
        `/api/admin/notificaciones-clientes?cliente_id=${clienteId}`,
        { cache: "no-store", signal }
      );

      const resultado: Respuesta = await respuesta.json();

      if (!respuesta.ok || !resultado.success || !resultado.notificaciones) {
        throw new Error(resultado.error || "No se pudieron consultar los dispositivos.");
      }

      if (!signal?.aborted) {
        setDatos(resultado.notificaciones);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : "Error desconocido.");
      }
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    const controlador = new AbortController();
    void actualizar(controlador.signal);
    return () => controlador.abort();
  }, [actualizar]);

  const registrados = Number(datos?.dispositivos_registrados ?? 0);
  const activos = Number(datos?.dispositivos_activos ?? 0);

  const fecha = datos?.ultima_confirmacion
    ? new Date(datos.ultima_confirmacion).toLocaleString("es-MX", {
        timeZone: "America/Tijuana",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Sin confirmaciones";

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-black text-[#111c4b]">
          Control de notificaciones
        </h3>
        <button
          type="button"
          onClick={() => void actualizar()}
          disabled={cargando}
          className="rounded-lg bg-[#172d87] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {cargando ? "Consultando..." : "Actualizar"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>
      ) : cargando && !datos ? (
        <p className="mt-4 text-sm text-slate-500">Cargando dispositivos...</p>
      ) : datos ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs text-slate-500">Registrados</p>
              <p className="text-3xl font-black text-[#111c4b]">{registrados}</p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs text-slate-500">Activos</p>
              <p className="text-3xl font-black text-emerald-700">{activos}</p>
            </div>
          </div>

          <p className="mt-4 text-sm font-semibold text-slate-700">
            {activos === 0
              ? "Sin dispositivos activos"
              : `${activos} dispositivo(s) activo(s)`}
          </p>

          <p className="mt-2 text-xs text-slate-600">
            Última confirmación de diagnóstico: {fecha}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Una confirmación indica que el navegador procesó una prueba,
            no que el cliente haya leído el aviso.
          </p>
        </>
      ) : null}
    </section>
  );
}