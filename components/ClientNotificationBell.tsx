"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Notificacion = {
  id: string;
  cliente_id: string;
  titulo: string;
  mensaje: string;
  tipo: string | null;
  url: string | null;
  leida: boolean;
  created_at: string;
};

type Props = {
  clienteId: string;
};

export default function ClientNotificationBell({ clienteId }: Props) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargarNotificaciones = async () => {
    if (!clienteId) return;

    const { data, error } = await supabase
      .from("notificaciones_clientes")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error cargando notificaciones:", error);
      setCargando(false);
      return;
    }

    setNotificaciones(data || []);
    setCargando(false);
  };

  useEffect(() => {
    cargarNotificaciones();

    const canal = supabase
      .channel(`notificaciones-${clienteId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificaciones_clientes",
          filter: `cliente_id=eq.${clienteId}`,
        },
        () => {
          cargarNotificaciones();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [clienteId]);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  const marcarComoLeida = async (notificacion: Notificacion) => {
    if (!notificacion.leida) {
      await supabase
        .from("notificaciones_clientes")
        .update({ leida: true })
        .eq("id", notificacion.id);

      setNotificaciones((actuales) =>
        actuales.map((n) =>
          n.id === notificacion.id ? { ...n, leida: true } : n
        )
      );
    }

    if (notificacion.url) {
      window.location.href = notificacion.url;
    }
  };

  const marcarTodasComoLeidas = async () => {
    const { error } = await supabase
      .from("notificaciones_clientes")
      .update({ leida: true })
      .eq("cliente_id", clienteId)
      .eq("leida", false);

    if (error) {
      console.error("Error marcando notificaciones:", error);
      return;
    }

    setNotificaciones((actuales) =>
      actuales.map((n) => ({
        ...n,
        leida: true,
      }))
    );
  };

  const formatearFecha = (fecha: string) => {
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(fecha));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-gray-100"
        aria-label="Notificaciones"
      >
        <span className="text-2xl">🔔</span>

        {noLeidas > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {noLeidas > 99 ? "99+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 z-50 mt-3 w-[340px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:w-[380px]">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h3 className="font-bold text-gray-900">Notificaciones</h3>

              {noLeidas > 0 && (
                <p className="text-xs text-gray-500">
                  {noLeidas} sin leer
                </p>
              )}
            </div>

            {noLeidas > 0 && (
              <button
                type="button"
                onClick={marcarTodasComoLeidas}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-[430px] overflow-y-auto">
            {cargando ? (
              <div className="p-6 text-center text-sm text-gray-500">
                Cargando...
              </div>
            ) : notificaciones.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mb-2 text-4xl">🔔</div>
                <p className="font-semibold text-gray-700">
                  No tienes notificaciones
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Aquí aparecerán las actualizaciones de tu mercancía.
                </p>
              </div>
            ) : (
              notificaciones.map((notificacion) => (
                <button
                  key={notificacion.id}
                  type="button"
                  onClick={() => marcarComoLeida(notificacion)}
                  className={`block w-full border-b px-4 py-4 text-left transition hover:bg-gray-50 ${
                    !notificacion.leida ? "bg-blue-50" : "bg-white"
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="mt-1 text-xl">
                      {notificacion.tipo === "inventario" ? "📦" : "🔔"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm ${
                            !notificacion.leida
                              ? "font-bold text-gray-900"
                              : "font-semibold text-gray-700"
                          }`}
                        >
                          {notificacion.titulo}
                        </p>

                        {!notificacion.leida && (
                          <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
                        )}
                      </div>

                      <p className="mt-1 text-sm text-gray-600">
                        {notificacion.mensaje}
                      </p>

                      <p className="mt-2 text-xs text-gray-400">
                        {formatearFecha(notificacion.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}