"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Notificacion = {
  id: number;
  cliente_id: number;
  titulo: string;
  mensaje: string;
  tipo: string | null;
  url: string | null;
  leida: boolean;
  created_at: string;
};

type Props = {
  clienteId: number;
  token: string;
};

type ApiResponse = {
  success: boolean;
  total?: number;
  no_leidas?: number;
  notificaciones?: Notificacion[];
  error?: string;
};

export default function ClientNotificationBell({
  clienteId,
  token,
}: Props) {
  const [notificaciones, setNotificaciones] =
    useState<Notificacion[]>([]);

  const [abierto, setAbierto] =
    useState(false);

  const [cargando, setCargando] =
    useState(true);

  const contenedorRef =
    useRef<HTMLDivElement | null>(null);

  const panelRef =
    useRef<HTMLDivElement | null>(null);

  const [panelPosicion, setPanelPosicion] =
    useState<{
      top: number;
      left: number;
      width: number;
    } | null>(null);

  const actualizarPosicionPanel = () => {
    if (!contenedorRef.current) {
      return;
    }

    const rect =
      contenedorRef.current.getBoundingClientRect();

    const margen = 12;
    const anchoMaximo = 390;

    const ancho =
      Math.min(
        anchoMaximo,
        window.innerWidth - margen * 2
      );

    let left =
      rect.right - ancho;

    if (left < margen) {
      left = margen;
    }

    if (
      left + ancho >
      window.innerWidth - margen
    ) {
      left =
        window.innerWidth -
        ancho -
        margen;
    }

    setPanelPosicion({
      top: rect.bottom + 8,
      left,
      width: ancho,
    });
  };

  const cargarNotificaciones = async () => {
    if (!clienteId || !token) {
      return;
    }

    try {
      const response = await fetch(
        `/api/inventario/${encodeURIComponent(
          token
        )}/notificaciones`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result =
        (await response.json()) as ApiResponse;

      if (!response.ok || !result.success) {
        console.error(
          "Error cargando notificaciones:",
          result.error
        );

        setCargando(false);
        return;
      }

      setNotificaciones(
        result.notificaciones || []
      );
    } catch (error) {
      console.error(
        "Error cargando notificaciones:",
        error
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!clienteId || !token) {
      return;
    }

    cargarNotificaciones();

    /*
     * Por ahora hacemos una actualización
     * sencilla cada 30 segundos.
     *
     * Después podemos hacerlo instantáneo
     * si lo necesitamos.
     */
    const intervalo =
      window.setInterval(() => {
        cargarNotificaciones();
      }, 30000);

    return () => {
      window.clearInterval(
        intervalo
      );
    };
  }, [clienteId, token]);

  useEffect(() => {
    const cerrarAlHacerClickFuera = (
      event: MouseEvent
    ) => {
      const target =
        event.target as Node;

      const clickEnBoton =
        contenedorRef.current?.contains(
          target
        );

      const clickEnPanel =
        panelRef.current?.contains(
          target
        );

      if (
        !clickEnBoton &&
        !clickEnPanel
      ) {
        setAbierto(false);
      }
    };

    document.addEventListener(
      "mousedown",
      cerrarAlHacerClickFuera
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        cerrarAlHacerClickFuera
      );
    };
  }, []);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    actualizarPosicionPanel();

    const actualizar = () => {
      actualizarPosicionPanel();
    };

    window.addEventListener(
      "resize",
      actualizar
    );

    window.addEventListener(
      "scroll",
      actualizar,
      true
    );

    return () => {
      window.removeEventListener(
        "resize",
        actualizar
      );

      window.removeEventListener(
        "scroll",
        actualizar,
        true
      );
    };
  }, [abierto]);

  const noLeidas =
    notificaciones.filter(
      (notificacion) =>
        !notificacion.leida
    ).length;

  const marcarComoLeida = async (
    notificacion: Notificacion
  ) => {
    if (!notificacion.leida) {
      try {
        const response = await fetch(
          `/api/inventario/${encodeURIComponent(
            token
          )}/notificaciones`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              id: notificacion.id,
            }),
          }
        );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          console.error(
            "Error marcando notificación:",
            result.error
          );
        } else {
          setNotificaciones(
            (actuales) =>
              actuales.map(
                (item) =>
                  item.id ===
                  notificacion.id
                    ? {
                        ...item,
                        leida: true,
                      }
                    : item
              )
          );
        }
      } catch (error) {
        console.error(
          "Error marcando notificación:",
          error
        );
      }
    }

    if (notificacion.url) {
      window.location.href =
        notificacion.url;
    }
  };

  const marcarTodasComoLeidas =
    async () => {
      try {
        const response = await fetch(
          `/api/inventario/${encodeURIComponent(
            token
          )}/notificaciones`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              marcarTodas: true,
            }),
          }
        );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          console.error(
            "Error marcando todas:",
            result.error
          );

          return;
        }

        setNotificaciones(
          (actuales) =>
            actuales.map(
              (item) => ({
                ...item,
                leida: true,
              })
            )
        );
      } catch (error) {
        console.error(
          "Error marcando todas:",
          error
        );
      }
    };

  const formatearFecha = (
    fecha: string
  ) => {
    const date =
      new Date(fecha);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return new Intl.DateTimeFormat(
      "es-MX",
      {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(date);
  };

  const obtenerIcono = (
    tipo: string | null
  ) => {
    if (tipo === "inventario") {
      return "📦";
    }

    if (tipo === "foto") {
      return "📸";
    }

    if (tipo === "video") {
      return "🎥";
    }

    if (tipo === "envio") {
      return "🚚";
    }

    return "🔔";
  };

  return (
    <div
      ref={contenedorRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() => {
          setAbierto(
            (actual) => {
              const siguiente =
                !actual;

              if (siguiente) {
                requestAnimationFrame(
                  actualizarPosicionPanel
                );
              }

              return siguiente;
            }
          );
        }}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur transition hover:bg-white/20 sm:h-12 sm:w-12"
        aria-label="Notificaciones"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>

        {noLeidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#0a3183] bg-red-500 px-1 text-[10px] font-black text-white shadow">
            {noLeidas > 99
              ? "99+"
              : noLeidas}
          </span>
        )}
      </button>

      {abierto &&
        panelPosicion &&
        typeof document !==
          "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: panelPosicion.top,
              left: panelPosicion.left,
              width: panelPosicion.width,
              maxHeight:
                "calc(100dvh - 24px)",
            }}
            className="z-[9999] overflow-hidden rounded-[22px] border border-slate-200 bg-white text-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
              <div>
                <p className="text-base font-black text-slate-900">
                  Notificaciones
                </p>

                <p className="mt-0.5 text-xs font-semibold text-slate-400">
                  {noLeidas === 0
                    ? notificaciones.length > 0
                      ? `${notificaciones.length} en el historial`
                      : "No tienes avisos nuevos"
                    : `${noLeidas} sin leer`}
                </p>
              </div>

              {noLeidas > 0 && (
                <button
                  type="button"
                  onClick={
                    marcarTodasComoLeidas
                  }
                  className="text-xs font-black text-[#0a3183] transition hover:text-blue-600"
                >
                  Marcar leídas
                </button>
              )}
            </div>

            <div
              className="overflow-y-auto"
              style={{
                maxHeight:
                  "min(420px, calc(100dvh - 160px))",
              }}
            >
              {cargando ? (
                <div className="px-5 py-10 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#0a3183]" />

                  <p className="mt-3 text-sm font-semibold text-slate-500">
                    Cargando...
                  </p>
                </div>
              ) : notificaciones.length ===
                0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl">
                    🔔
                  </div>

                  <p className="mt-4 font-black text-slate-800">
                    Todo está al día
                  </p>

                  <p className="mt-1 text-sm font-medium leading-5 text-slate-400">
                    Aquí recibirás avisos cuando VIPACK actualice tu mercancía.
                  </p>
                </div>
              ) : (
                notificaciones.map(
                  (notificacion) => (
                    <button
                      key={
                        notificacion.id
                      }
                      type="button"
                      onClick={() =>
                        marcarComoLeida(
                          notificacion
                        )
                      }
                      className={`flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-slate-50 ${
                        !notificacion.leida
                          ? "bg-blue-50/70"
                          : "bg-white"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm">
                        {obtenerIcono(
                          notificacion.tipo
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p
                            className={`min-w-0 flex-1 text-sm leading-5 ${
                              !notificacion.leida
                                ? "font-black text-slate-900"
                                : "font-bold text-slate-700"
                            }`}
                          >
                            {
                              notificacion.titulo
                            }
                          </p>

                          {!notificacion.leida && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                          )}
                        </div>

                        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                          {
                            notificacion.mensaje
                          }
                        </p>

                        <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {formatearFecha(
                            notificacion.created_at
                          )}
                        </p>
                      </div>
                    </button>
                  )
                )
              )}
            </div>
          </div>,
          document.body
        )}

    </div>
  );
}