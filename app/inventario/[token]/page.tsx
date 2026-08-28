"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ClientNotificationBell from "@/components/ClientNotificationBell";
import EnablePushNotifications from "@/components/EnablePushNotifications";

type InventarioItem = {
  id: string;
  nombre: string;
  tipo: string;
  mime_type: string | null;
  tamaño: number;
  modificado: string | null;
  webUrl: string | null;
};

type InventarioResponse = {
  success: boolean;
  cliente?: {
    id_cliente: number;
    nombre: string;
    carpeta: string;
  };
  total?: number;
  inventario?: InventarioItem[];
  error?: string;
};

function formatearFecha(fecha: string | null) {
  if (!fecha) return "";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(fecha));
}

function formatearTamaño(bytes: number) {
  if (!bytes) return "";

  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function obtenerClaveMes(fecha: string | null) {
  if (!fecha) return null;

  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function formatearMes(clave: string) {
  const [year, month] = clave
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    1
  );

  const texto =
    new Intl.DateTimeFormat("es-MX", {
      month: "long",
      year: "numeric",
    }).format(date);

  return (
    texto.charAt(0).toUpperCase() +
    texto.slice(1)
  );
}

function formatearMesCorto(clave: string) {
  const [year, month] = clave
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    1
  );

  const texto =
    new Intl.DateTimeFormat("es-MX", {
      month: "short",
    })
      .format(date)
      .replace(".", "");

  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} ${year}`;
}

function IconoCaja({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}

function IconoUsuario({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" />
    </svg>
  );
}

function IconoDocumento({
  className = "h-7 w-7",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 3h7l4 4v14H7V3Z" />
      <path d="M14 3v5h5" />
      <path d="M10 12h5M10 16h5" />
    </svg>
  );
}

function IconoImagen({
  className = "h-7 w-7",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m5 18 5-5 3 3 2-2 4 4" />
    </svg>
  );
}

function IconoCarpeta({
  className = "h-7 w-7",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 7h7l2 2h9v10H3V7Z" />
    </svg>
  );
}

function IconoCamara({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 8h4l1.5-2h5L16 8h4v11H4V8Z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </svg>
  );
}


function IconoVideo({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="m17 10 4-2v8l-4-2" />
      <path d="m9 9 4 3-4 3V9Z" />
    </svg>
  );
}

function IconoCalendario({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </svg>
  );
}

function IconoCuadricula({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export default function InventarioClientePage() {
  const params = useParams();

  const token =
    typeof params.token === "string"
      ? params.token
      : Array.isArray(params.token)
      ? params.token[0]
      : "";

  const searchParams =
    useSearchParams();

  const archivoSolicitado =
    searchParams.get("archivo") || "";

  /*
   * Evita volver a abrir automáticamente la misma
   * evidencia si el cliente ya cerró la galería.
   */
  const archivoAbiertoRef =
    useRef<string>("");

  const [data, setData] =
    useState<InventarioResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [fotoActiva, setFotoActiva] =
    useState<number | null>(null);

  const [mesActivo, setMesActivo] =
    useState<string>("");

  // Protección móvil: evita renderizar demasiadas evidencias a la vez.
  const FOTOS_POR_BLOQUE = 24;
  const [limiteFotos, setLimiteFotos] =
    useState(FOTOS_POR_BLOQUE);

  const inicioTouchX =
    useRef<number | null>(null);

  useEffect(() => {
    if (!token) return;

    const cargarInventario = async () => {
      try {
        setLoading(true);

        const response = await fetch(
          `/api/inventario/${encodeURIComponent(
            token
          )}`,
          {
            cache: "no-store",
          }
        );

        const result =
          await response.json();

        setData(result);
      } catch {
        setData({
          success: false,
          error:
            "No se pudo cargar el inventario.",
        });
      } finally {
        setLoading(false);
      }
    };

    cargarInventario();
  }, [token]);

  const inventario =
    data?.inventario || [];

  const imagenes =
    inventario.filter((item) =>
      item.mime_type?.startsWith("image/")
    );

  const otrosArchivos =
    inventario.filter(
      (item) =>
        !item.mime_type?.startsWith("image/")
    );


  const videos =
    otrosArchivos.filter((item) =>
      item.mime_type?.startsWith("video/")
    );

  const documentos =
    otrosArchivos.filter(
      (item) =>
        !item.mime_type?.startsWith("video/")
    );

  const mesesDisponibles =
    Array.from(
      new Set(
        imagenes
          .map((item) =>
            obtenerClaveMes(
              item.modificado
            )
          )
          .filter(
            (mes): mes is string =>
              Boolean(mes)
          )
      )
    ).sort((a, b) =>
      b.localeCompare(a)
    );

  const imagenesFiltradas =
    !mesActivo ||
    mesActivo === "todos"
      ? imagenes
      : imagenes.filter(
          (item) =>
            obtenerClaveMes(
              item.modificado
            ) === mesActivo
        );

  const cerrarGaleria = () =>
    setFotoActiva(null);

  useEffect(() => {
    if (
      mesesDisponibles.length === 0
    ) {
      setMesActivo("todos");
      return;
    }

    setMesActivo((actual) => {
      if (
        actual &&
        (actual === "todos" ||
          mesesDisponibles.includes(
            actual
          ))
      ) {
        return actual;
      }

      return mesesDisponibles[0];
    });
  }, [
    data?.cliente?.id_cliente,
    mesesDisponibles.join("|"),
  ]);

  /*
   * Si la página fue abierta desde una notificación con
   * ?archivo=ID, localizamos esa evidencia, cambiamos al
   * mes correcto y abrimos directamente la galería.
   */
  useEffect(() => {
    if (
      !archivoSolicitado ||
      imagenes.length === 0 ||
      archivoAbiertoRef.current ===
        archivoSolicitado
    ) {
      return;
    }

    const indiceGlobal =
      imagenes.findIndex(
        (item) =>
          item.id ===
          archivoSolicitado
      );

    if (indiceGlobal < 0) {
      return;
    }

    const imagenObjetivo =
      imagenes[indiceGlobal];

    const mesObjetivo =
      obtenerClaveMes(
        imagenObjetivo.modificado
      );

    const mesParaAbrir =
      mesObjetivo || "todos";

    const listaObjetivo =
      mesParaAbrir === "todos"
        ? imagenes
        : imagenes.filter(
            (item) =>
              obtenerClaveMes(
                item.modificado
              ) === mesParaAbrir
          );

    const indiceObjetivo =
      listaObjetivo.findIndex(
        (item) =>
          item.id ===
          archivoSolicitado
      );

    if (indiceObjetivo < 0) {
      return;
    }

    archivoAbiertoRef.current =
      archivoSolicitado;

    setMesActivo(
      mesParaAbrir
    );

    setFotoActiva(
      indiceObjetivo
    );
  }, [
    archivoSolicitado,
    imagenes,
  ]);

  const cambiarMes = (mes: string) => {
    setMesActivo(mes);
    setFotoActiva(null);
    setLimiteFotos(FOTOS_POR_BLOQUE);
  };

  const imagenesVisibles =
    imagenesFiltradas.slice(0, limiteFotos);

  const fotoAnterior = () => {
    setFotoActiva((actual) => {
      if (actual === null) return null;

      return actual === 0
        ? imagenesFiltradas.length - 1
        : actual - 1;
    });
  };

  const fotoSiguiente = () => {
    setFotoActiva((actual) => {
      if (actual === null) return null;

      return actual ===
        imagenesFiltradas.length - 1
        ? 0
        : actual + 1;
    });
  };

  useEffect(() => {
    if (fotoActiva === null) return;

    const manejarTeclado = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "Escape"
      ) {
        cerrarGaleria();
      }

      if (
        event.key === "ArrowLeft"
      ) {
        fotoAnterior();
      }

      if (
        event.key === "ArrowRight"
      ) {
        fotoSiguiente();
      }
    };

    const overflowAnterior =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      manejarTeclado
    );

    return () => {
      document.body.style.overflow =
        overflowAnterior;

      window.removeEventListener(
        "keydown",
        manejarTeclado
      );
    };
  }, [
    fotoActiva,
    imagenesFiltradas.length,
  ]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7fb]">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#0a3183]" />
            <p className="mt-4 font-semibold text-slate-600">
              Cargando inventario...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (
    !data ||
    !data.success
  ) {
    return (
      <main className="min-h-screen bg-[#f5f7fb]">
        <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-5">
          <div className="w-full rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl font-black text-red-500">
              !
            </div>
            <h1 className="mt-5 text-2xl font-black text-slate-900">
              Inventario no disponible
            </h1>
            <p className="mt-3 text-slate-500">
              {data?.error ||
                "No fue posible abrir este inventario."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const imagenSeleccionada =
    fotoActiva !== null
      ? imagenesFiltradas[
          fotoActiva
        ]
      : null;

  const srcImagen = (
    item: InventarioItem
  ) =>
    `/api/inventario/${encodeURIComponent(
      token
    )}/archivo/${encodeURIComponent(
      item.id
    )}`;

  return (
    <>
      <main className="min-h-screen overflow-x-hidden bg-[#f5f7fb]">
        <header className="relative overflow-hidden bg-gradient-to-br from-[#062a73] via-[#0a3183] to-[#123f9a] text-white">
          <div className="absolute -right-12 -top-14 h-52 w-52 rounded-full bg-blue-400/10 blur-2xl" />
          <div className="absolute right-20 top-10 h-28 w-28 rotate-12 rounded-3xl border border-blue-200/10 bg-blue-300/5" />

          <div className="relative mx-auto max-w-6xl px-4 pb-7 pt-5 sm:px-8 sm:pb-16 sm:pt-10">
            <div className="relative flex items-start justify-between gap-3 sm:gap-5">
              <div className="min-w-0 pr-14 sm:pr-0">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-blue-100 sm:text-sm">
                  <IconoCaja className="h-4 w-4 sm:h-5 sm:w-5" />
                  VIPACK Envíos
                </div>

                <h1 className="mt-1 text-[32px] font-black leading-none tracking-tight sm:mt-2 sm:text-5xl lg:text-6xl">
                  Mi inventario
                </h1>

                <div className="mt-3.5 flex w-full max-w-md items-center gap-2.5 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 backdrop-blur sm:mt-5 sm:gap-3 sm:px-5 sm:py-3.5">
                  <IconoUsuario />
                  <span className="text-sm font-bold sm:text-base">
                    Cliente #
                    {String(
                      data.cliente
                        ?.id_cliente || ""
                    ).padStart(
                      5,
                      "0"
                    )}
                  </span>
                </div>
              </div>

              <div className="absolute right-1 top-1 z-20 flex items-start gap-2 sm:static sm:gap-4">
                <ClientNotificationBell
                  clienteId={data.cliente?.id_cliente || 0}
                  token={token}
                />

                <div className="pointer-events-none hidden text-blue-100/80 sm:block">
                  <IconoCaja className="h-24 w-24 lg:h-32 lg:w-32" />
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="relative mx-auto -mt-4 max-w-6xl px-3.5 pb-10 sm:-mt-10 sm:px-8">
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-xl shadow-slate-200/60 sm:rounded-[28px] sm:p-8">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400 sm:text-sm">
                  Inventario de
                </p>

                <h2 className="mt-1 break-words text-[23px] font-black leading-[1.07] text-slate-900 sm:mt-2 sm:text-4xl">
                  {
                    data.cliente
                      ?.nombre
                  }
                </h2>
              </div>

              <div className="shrink-0 text-blue-100">
                <div className="rounded-2xl bg-blue-50 p-2.5 text-[#0a3183] sm:rounded-3xl sm:p-5">
                  <IconoCaja className="h-8 w-8 sm:h-16 sm:w-16" />
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-7 sm:gap-4">
              <div className="min-w-0 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-2.5 sm:p-5">
                <div className="flex items-center gap-1.5 text-violet-600 sm:gap-2">
                  <IconoDocumento className="h-5 w-5 shrink-0 sm:h-8 sm:w-8" />
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase leading-[1.05] tracking-[0.01em] text-slate-500 sm:text-sm sm:leading-normal">
                      Archivos
                    </p>
                    <p className="mt-0.5 text-[23px] font-black leading-none text-violet-600 sm:text-4xl">
                      {
                        data.total ||
                        0
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-w-0 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-2.5 sm:p-5">
                <div className="flex items-center gap-1.5 text-emerald-600 sm:gap-2">
                  <IconoImagen className="h-5 w-5 shrink-0 sm:h-8 sm:w-8" />
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase leading-[1.05] tracking-[0.01em] text-slate-500 sm:text-sm sm:leading-normal">
                      Fotos
                    </p>
                    <p className="mt-0.5 text-[23px] font-black leading-none text-emerald-600 sm:text-4xl">
                      {
                        imagenes.length
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-w-0 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-2.5 sm:p-5">
                <div className="flex items-center gap-1.5 text-amber-500 sm:gap-2">
                  <IconoCarpeta className="h-5 w-5 shrink-0 sm:h-8 sm:w-8" />
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase leading-[1.05] tracking-[0.01em] text-slate-500 sm:text-sm sm:leading-normal">
                      Otros archivos
                    </p>
                    <p className="mt-0.5 text-[23px] font-black leading-none text-amber-500 sm:text-4xl">
                      {
                        otrosArchivos.length
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 sm:mt-6">
            <EnablePushNotifications token={token} />
          </div>

          <div className="mt-5 sm:mt-8">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:flex sm:justify-between sm:gap-3">
              <div>
                <div className="flex items-center gap-2 text-[#0a3183]">
                  <IconoCamara />
                  <p className="text-xs font-black uppercase tracking-[0.12em] sm:text-sm">
                    Evidencias
                  </p>
                </div>

                <h2 className="mt-1 whitespace-nowrap text-[21px] font-black leading-none tracking-tight text-slate-900 sm:text-4xl">
                  Fotos de recolección
                </h2>
              </div>

              <div className="shrink-0 rounded-2xl bg-blue-50 px-2.5 py-1.5 text-center sm:px-4 sm:py-2.5">
                <span className="block text-base font-black leading-none text-blue-600 sm:text-xl">
                  {
                    imagenesFiltradas.length
                  }
                </span>
                <span className="mt-1 block text-[8px] font-bold uppercase tracking-wide text-blue-500 sm:text-[10px]">
                  fotos
                </span>
              </div>
            </div>

            {imagenes.length >
              0 && (
              <div className="mt-3.5 rounded-[18px] border border-slate-200 bg-white p-1.5 shadow-md shadow-slate-200/40 sm:mt-5 sm:rounded-[22px] sm:p-2.5">
                <div className="grid w-full grid-cols-4 gap-1.5 sm:flex sm:gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      cambiarMes(
                        "todos"
                      )
                    }
                    className={`min-w-0 rounded-xl border px-1 py-1.5 text-center transition sm:flex-1 sm:rounded-2xl sm:px-2 sm:py-2.5 ${
                      mesActivo ===
                      "todos"
                        ? "border-[#0a3183] bg-[#0a3183] text-white shadow-md"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40"
                    }`}
                  >
                    <span className="mx-auto mb-0.5 flex h-3.5 w-3.5 items-center justify-center sm:mb-1 sm:h-6 sm:w-6">
                      <IconoCuadricula className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                    <span className="block truncate text-[10px] font-black sm:text-sm">
                      Todos
                    </span>
                    <span
                      className={`mt-0.5 block text-[10px] font-black sm:text-xs ${
                        mesActivo ===
                        "todos"
                          ? "text-white/75"
                          : "text-blue-600"
                      }`}
                    >
                      {
                        imagenes.length
                      }
                    </span>
                  </button>

                  {mesesDisponibles.map(
                    (mes) => {
                      const cantidad =
                        imagenes.filter(
                          (
                            item
                          ) =>
                            obtenerClaveMes(
                              item.modificado
                            ) ===
                            mes
                        ).length;

                      return (
                        <button
                          key={mes}
                          type="button"
                          onClick={() =>
                            cambiarMes(
                              mes
                            )
                          }
                          className={`min-w-0 rounded-xl border px-0.5 py-1.5 text-center transition sm:flex-1 sm:rounded-2xl sm:px-1.5 sm:py-2.5 ${
                            mesActivo ===
                            mes
                              ? "border-[#0a3183] bg-[#0a3183] text-white shadow-md"
                              : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40"
                          }`}
                        >
                          <span className="mx-auto mb-0.5 flex h-3.5 w-3.5 items-center justify-center text-blue-500 sm:mb-1 sm:h-6 sm:w-6">
                            <IconoCalendario className="h-4 w-4 sm:h-5 sm:w-5" />
                          </span>

                          <span className="block truncate text-[9px] font-black sm:hidden">
                            {formatearMesCorto(
                              mes
                            )}
                          </span>

                          <span className="hidden truncate text-sm font-black sm:block">
                            {formatearMes(
                              mes
                            )}
                          </span>

                          <span
                            className={`mt-0.5 block text-[10px] font-black sm:text-xs ${
                              mesActivo ===
                              mes
                                ? "text-white/75"
                                : "text-blue-600"
                            }`}
                          >
                            {
                              cantidad
                            }
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {imagenes.length ===
            0 ? (
              <div className="mt-5 rounded-[28px] border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
                Aún no hay fotos disponibles.
              </div>
            ) : imagenesFiltradas.length ===
              0 ? (
              <div className="mt-5 rounded-[28px] border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
                No hay fotos disponibles en este mes.
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                  {imagenesVisibles.map(
                    (
                      item,
                      index
                    ) => (
                    <article
                      key={
                        item.id
                      }
                      className="group min-w-0 overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-md shadow-slate-200/50 transition hover:-translate-y-1 hover:shadow-xl sm:rounded-[22px]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setFotoActiva(
                            index
                          )
                        }
                        className="relative block w-full overflow-hidden bg-slate-100 text-left"
                        aria-label={`Abrir foto ${item.nombre}`}
                      >
                        <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                          <img
                            src={srcImagen(
                              item
                            )}
                            alt={
                              item.nombre
                            }
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>

                        <div className="absolute left-2 top-2 flex h-8 min-w-8 items-center justify-center rounded-xl bg-white px-2 text-xs font-black text-slate-900 shadow-md sm:left-3 sm:top-3 sm:h-9 sm:min-w-9 sm:text-sm">
                          {String(
                            index +
                              1
                          ).padStart(
                            2,
                            "0"
                          )}
                        </div>
                      </button>

                      <div className="p-2.5 sm:p-4">
                        <p className="truncate text-sm font-black text-slate-900 sm:text-base">
                          {
                            item.nombre
                          }
                        </p>

                        <div className="mt-2 space-y-1.5 text-[11px] font-semibold text-slate-400 sm:text-xs">
                          <div className="flex items-center gap-2">
                            <IconoCalendario className="h-4 w-4 shrink-0 text-blue-400" />
                            <span>
                              {formatearFecha(
                                item.modificado
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <IconoDocumento className="h-4 w-4 shrink-0 text-blue-400" />
                            <span>
                              {formatearTamaño(
                                item.tamaño
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                  )}
                </div>

                {imagenesVisibles.length < imagenesFiltradas.length && (
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        setLimiteFotos((actual) =>
                          Math.min(
                            actual + FOTOS_POR_BLOQUE,
                            imagenesFiltradas.length
                          )
                        )
                      }
                      className="w-full rounded-2xl border border-blue-200 bg-white px-5 py-3 text-sm font-black text-[#0a3183] shadow-sm transition hover:bg-blue-50 sm:w-auto"
                    >
                      Mostrar 24 fotos más
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {otrosArchivos.length > 0 && (
            <div className="mt-10 rounded-[28px] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/40 sm:p-7">
              <div className="flex items-center gap-2">
                <IconoCarpeta className="h-6 w-6 text-amber-500" />
                <h2 className="text-2xl font-black text-slate-900">
                  Otros archivos
                </h2>
              </div>

              {videos.length > 0 && (
                <div className="mt-5">
                  <div className="mb-3 flex items-center gap-2 text-[#0a3183]">
                    <IconoVideo className="h-5 w-5" />
                    <p className="text-sm font-black uppercase tracking-[0.1em]">
                      Videos
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {videos.map((item) => (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50 shadow-sm transition hover:border-blue-200 hover:shadow-lg"
                      >
                        <div className="relative overflow-hidden bg-black">
                          <video
                            controls
                            playsInline
                            preload="none"
                            src={srcImagen(item)}
                            className="aspect-video w-full bg-black object-contain"
                          >
                            Tu navegador no puede reproducir este video.
                          </video>

                          <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-black/55 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white backdrop-blur">
                            Video
                          </div>
                        </div>

                        <div className="p-4">
                          <p className="truncate text-sm font-black text-slate-900 sm:text-base">
                            {item.nombre}
                          </p>

                          <div className="mt-3 space-y-1.5 text-[11px] font-semibold text-slate-500 sm:text-xs">
                            <div className="flex items-center gap-2">
                              <IconoCalendario className="h-4 w-4 shrink-0 text-blue-400" />
                              <span>{formatearFecha(item.modificado)}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <IconoDocumento className="h-4 w-4 shrink-0 text-blue-400" />
                              <span>{formatearTamaño(item.tamaño)}</span>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-center text-xs font-black text-[#0a3183]">
                            Reproducir directamente en tu inventario
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {documentos.length > 0 && (
                <div className={videos.length > 0 ? "mt-7" : "mt-5"}>
                  {videos.length > 0 && (
                    <div className="mb-3 flex items-center gap-2 text-amber-600">
                      <IconoDocumento className="h-5 w-5" />
                      <p className="text-sm font-black uppercase tracking-[0.1em]">
                        Documentos
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {documentos.map((item) => (
                      <a
                        key={item.id}
                        href={item.webUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-900">
                            {item.nombre}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                            <span>{formatearFecha(item.modificado)}</span>
                            <span>{formatearTamaño(item.tamaño)}</span>
                          </div>
                        </div>

                        <span className="shrink-0 text-sm font-black text-[#0a3183]">
                          Abrir
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 overflow-hidden rounded-[24px] bg-gradient-to-r from-violet-600 via-blue-600 to-sky-500 p-4 text-white shadow-xl shadow-blue-200/50 sm:mt-10 sm:rounded-[26px] sm:p-6">
            <div className="flex items-center justify-between gap-5">
              <div>
                <p className="text-lg font-black sm:text-xl">
                  Tu inventario, siempre al alcance
                </p>
                <p className="mt-1 text-sm font-medium text-white/80 sm:text-base">
                  Revisa tus paquetes, evidencia y más.
                </p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-md sm:h-14 sm:w-14">
                <IconoCaja className="h-7 w-7" />
              </div>
            </div>
          </div>

          <footer className="py-8 text-center">
            <p className="text-xs font-semibold text-slate-400 sm:text-sm">
              Inventario administrado por{" "}
              <span className="font-black text-[#0a3183]">
                VIPACK Envíos
              </span>
            </p>
          </footer>
        </section>
      </main>

      {imagenSeleccionada &&
        fotoActiva !== null && (
          <div
            className="fixed inset-0 z-[100] bg-black/95"
            role="dialog"
            aria-modal="true"
            aria-label="Galería de fotos"
            onClick={cerrarGaleria}
          >
            <div
              className="mx-auto grid h-[100dvh] w-full max-w-[1600px] grid-rows-[64px_minmax(0,1fr)_48px] sm:grid-rows-[72px_minmax(0,1fr)_52px]"
              onClick={(
                event
              ) =>
                event.stopPropagation()
              }
              onTouchStart={(
                event
              ) => {
                inicioTouchX.current =
                  event
                    .touches[0]
                    ?.clientX ??
                  null;
              }}
              onTouchEnd={(
                event
              ) => {
                if (
                  inicioTouchX.current ===
                  null
                )
                  return;

                const fin =
                  event
                    .changedTouches[0]
                    ?.clientX;

                if (
                  typeof fin !==
                  "number"
                ) {
                  inicioTouchX.current =
                    null;
                  return;
                }

                const diferencia =
                  fin -
                  inicioTouchX.current;

                inicioTouchX.current =
                  null;

                if (
                  Math.abs(
                    diferencia
                  ) < 50
                )
                  return;

                if (
                  diferencia >
                  0
                ) {
                  fotoAnterior();
                } else {
                  fotoSiguiente();
                }
              }}
            >
              <div className="flex items-center justify-between gap-3 px-4 pt-[max(8px,env(safe-area-inset-top))] text-white sm:px-8">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black sm:text-base">
                    {
                      imagenSeleccionada.nombre
                    }
                  </p>
                  <p className="mt-0.5 text-xs text-white/60">
                    {fotoActiva +
                      1}{" "}
                    de{" "}
                    {
                      imagenesFiltradas.length
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    cerrarGaleria
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl font-light text-white transition hover:bg-white/25 sm:h-11 sm:w-11"
                  aria-label="Cerrar galería"
                >
                  ×
                </button>
              </div>

              <div className="relative min-h-0 overflow-hidden px-2 py-2 sm:px-6 sm:py-3 lg:px-20">
                <div className="flex h-full w-full items-center justify-center">
                  <img
                    src={srcImagen(
                      imagenSeleccionada
                    )}
                    alt={
                      imagenSeleccionada.nombre
                    }
                    className="max-h-full max-w-full select-none rounded-xl object-contain shadow-2xl"
                    draggable={
                      false
                    }
                  />
                </div>

                {imagenesFiltradas.length >
                  1 && (
                  <>
                    <button
                      type="button"
                      onClick={
                        fotoAnterior
                      }
                      className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-2xl text-white backdrop-blur transition hover:bg-black/80 sm:left-4 sm:h-12 sm:w-12 sm:text-3xl lg:left-8"
                      aria-label="Foto anterior"
                    >
                      ‹
                    </button>

                    <button
                      type="button"
                      onClick={
                        fotoSiguiente
                      }
                      className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-2xl text-white backdrop-blur transition hover:bg-black/80 sm:right-4 sm:h-12 sm:w-12 sm:text-3xl lg:right-8"
                      aria-label="Foto siguiente"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-black/30 px-4 pb-[max(8px,env(safe-area-inset-bottom))] text-xs text-white/65 sm:text-sm">
                <span>
                  {formatearFecha(
                    imagenSeleccionada.modificado
                  )}
                </span>
                <span>•</span>
                <span>
                  {formatearTamaño(
                    imagenSeleccionada.tamaño
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
    </>
  );
}