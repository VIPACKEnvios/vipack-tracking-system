"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

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

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function InventarioClientePage() {
  const params = useParams();

  const token =
    typeof params.token === "string"
      ? params.token
      : Array.isArray(params.token)
      ? params.token[0]
      : "";

  const [data, setData] =
    useState<InventarioResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [fotoActiva, setFotoActiva] =
    useState<number | null>(null);

  const inicioTouchX = useRef<number | null>(null);

  useEffect(() => {
    if (!token) return;

    const cargarInventario = async () => {
      try {
        setLoading(true);

        const response = await fetch(
          `/api/inventario/${encodeURIComponent(token)}`,
          {
            cache: "no-store",
          }
        );

        const result = await response.json();
        setData(result);
      } catch {
        setData({
          success: false,
          error: "No se pudo cargar el inventario.",
        });
      } finally {
        setLoading(false);
      }
    };

    cargarInventario();
  }, [token]);

  const inventario = data?.inventario || [];

  const imagenes = inventario.filter((item) =>
    item.mime_type?.startsWith("image/")
  );

  const otrosArchivos = inventario.filter(
    (item) => !item.mime_type?.startsWith("image/")
  );

  const cerrarGaleria = () => setFotoActiva(null);

  const fotoAnterior = () => {
    setFotoActiva((actual) => {
      if (actual === null) return null;
      return actual === 0 ? imagenes.length - 1 : actual - 1;
    });
  };

  const fotoSiguiente = () => {
    setFotoActiva((actual) => {
      if (actual === null) return null;
      return actual === imagenes.length - 1 ? 0 : actual + 1;
    });
  };

  useEffect(() => {
    if (fotoActiva === null) return;

    const manejarTeclado = (event: KeyboardEvent) => {
      if (event.key === "Escape") cerrarGaleria();
      if (event.key === "ArrowLeft") fotoAnterior();
      if (event.key === "ArrowRight") fotoSiguiente();
    };

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", manejarTeclado);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", manejarTeclado);
    };
  }, [fotoActiva, imagenes.length]);

  if (loading) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-slate-50">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-5">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#072c74]" />
            <p className="mt-5 text-base font-semibold text-slate-600 sm:text-lg">
              Cargando inventario...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!data || !data.success) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-slate-50">
        <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-5">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">
              !
            </div>

            <h1 className="mt-5 text-2xl font-black text-slate-900">
              Inventario no disponible
            </h1>

            <p className="mt-3 text-slate-500">
              {data?.error || "No fue posible abrir este inventario."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const imagenSeleccionada =
    fotoActiva !== null ? imagenes[fotoActiva] : null;

  const srcImagen = (item: InventarioItem) =>
    `/api/inventario/${encodeURIComponent(
      token
    )}/archivo/${encodeURIComponent(item.id)}`;

  return (
    <>
      <main className="min-h-screen w-full overflow-x-hidden bg-slate-50">
        <header className="bg-[#072c74] text-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-200 sm:text-sm">
                  VIPACK Envíos
                </p>

                <h1 className="mt-1 text-3xl font-black leading-none sm:text-4xl">
                  Mi inventario
                </h1>
              </div>

              <div className="w-full rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur sm:w-auto">
                Cliente #
                {String(data.cliente?.id_cliente || "").padStart(5, "0")}
              </div>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-7">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 sm:text-sm">
              Inventario de
            </p>

            <h2 className="mt-2 break-words text-2xl font-black leading-tight text-slate-900 sm:text-3xl">
              {data.cliente?.nombre}
            </h2>

            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">
              <div className="min-w-0 rounded-2xl bg-slate-50 p-3 sm:p-5">
                <p className="text-[11px] font-semibold text-slate-500 sm:text-sm">
                  Archivos
                </p>
                <p className="mt-1 text-2xl font-black text-[#072c74] sm:text-3xl">
                  {data.total || 0}
                </p>
              </div>

              <div className="min-w-0 rounded-2xl bg-slate-50 p-3 sm:p-5">
                <p className="text-[11px] font-semibold text-slate-500 sm:text-sm">
                  Fotos
                </p>
                <p className="mt-1 text-2xl font-black text-[#072c74] sm:text-3xl">
                  {imagenes.length}
                </p>
              </div>

              <div className="min-w-0 rounded-2xl bg-slate-50 p-3 sm:p-5">
                <p className="text-[11px] font-semibold leading-tight text-slate-500 sm:text-sm">
                  Otros archivos
                </p>
                <p className="mt-1 text-2xl font-black text-[#072c74] sm:text-3xl">
                  {otrosArchivos.length}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 sm:text-sm">
                  Evidencias
                </p>

                <h2 className="mt-1 text-2xl font-black leading-tight text-slate-900">
                  Fotos de recolección
                </h2>
              </div>

              <p className="shrink-0 pb-1 text-xs font-semibold text-slate-500 sm:text-sm">
                {imagenes.length} fotos
              </p>
            </div>

            {imagenes.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                Aún no hay fotos disponibles.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {imagenes.map((item, index) => (
                  <article
                    key={item.id}
                    className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:rounded-3xl"
                  >
                    <button
                      type="button"
                      onClick={() => setFotoActiva(index)}
                      className="block w-full cursor-zoom-in overflow-hidden bg-slate-100 text-left"
                      aria-label={`Abrir foto ${item.nombre}`}
                    >
                      <div className="flex aspect-square items-center justify-center overflow-hidden">
                        <img
                          src={srcImagen(item)}
                          alt={item.nombre}
                          className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]"
                          loading="lazy"
                        />
                      </div>
                    </button>

                    <div className="p-3 sm:p-5">
                      <p className="truncate text-sm font-bold text-slate-900 sm:text-base">
                        {item.nombre}
                      </p>

                      <div className="mt-2 flex flex-col gap-1 text-[11px] font-medium text-slate-500 sm:mt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:text-xs">
                        <span>{formatearFecha(item.modificado)}</span>
                        <span>{formatearTamaño(item.tamaño)}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {otrosArchivos.length > 0 && (
            <div className="mt-10">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 sm:text-sm">
                Documentos
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-900">
                Otros archivos
              </h2>

              <div className="mt-5 space-y-3">
                {otrosArchivos.map((item) => (
                  <a
                    key={item.id}
                    href={item.webUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#072c74] sm:p-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">
                        {item.nombre}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatearFecha(item.modificado)}
                      </p>
                    </div>

                    <span className="shrink-0 text-sm font-bold text-[#072c74]">
                      Abrir
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <footer className="mt-12 border-t border-slate-200 py-8 text-center">
            <p className="text-sm text-slate-500">
              Inventario administrado por
              <span className="font-bold text-[#072c74]">
                {" "}
                VIPACK Envíos
              </span>
            </p>
          </footer>
        </section>
      </main>

      {imagenSeleccionada && fotoActiva !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Galería de fotos"
          onClick={cerrarGaleria}
        >
          <div
            className="grid h-[100dvh] w-full grid-rows-[64px_minmax(0,1fr)_52px] sm:grid-rows-[72px_minmax(0,1fr)_56px]"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => {
              inicioTouchX.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              if (inicioTouchX.current === null) return;

              const fin = event.changedTouches[0]?.clientX;

              if (typeof fin !== "number") {
                inicioTouchX.current = null;
                return;
              }

              const diferencia = fin - inicioTouchX.current;
              inicioTouchX.current = null;

              if (Math.abs(diferencia) < 50) return;

              if (diferencia > 0) {
                fotoAnterior();
              } else {
                fotoSiguiente();
              }
            }}
          >
            <div className="flex items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] text-white sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold sm:text-base">
                  {imagenSeleccionada.nombre}
                </p>
                <p className="mt-0.5 text-xs text-white/65">
                  {fotoActiva + 1} de {imagenes.length}
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarGaleria}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl font-light text-white transition active:scale-95 hover:bg-white/25 sm:h-11 sm:w-11"
                aria-label="Cerrar galería"
              >
                ×
              </button>
            </div>

            <div className="relative min-h-0 overflow-hidden px-3 py-3 sm:px-20 sm:py-4">
              <div className="flex h-full w-full items-center justify-center overflow-hidden">
                <img
                  src={srcImagen(imagenSeleccionada)}
                  alt={imagenSeleccionada.nombre}
                  className="max-h-[calc(100dvh-150px)] max-w-full select-none rounded-lg object-contain shadow-2xl sm:max-h-[calc(100dvh-160px)] sm:rounded-xl"
                  draggable={false}
                />
              </div>

              {imagenes.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={fotoAnterior}
                    className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl text-white backdrop-blur transition active:scale-95 hover:bg-black/75 sm:left-5 sm:h-14 sm:w-14 sm:text-3xl"
                    aria-label="Foto anterior"
                  >
                    ‹
                  </button>

                  <button
                    type="button"
                    onClick={fotoSiguiente}
                    className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl text-white backdrop-blur transition active:scale-95 hover:bg-black/75 sm:right-5 sm:h-14 sm:w-14 sm:text-3xl"
                    aria-label="Foto siguiente"
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-black/30 px-4 pb-[env(safe-area-inset-bottom)] text-xs text-white/65 sm:text-sm">
              <span>{formatearFecha(imagenSeleccionada.modificado)}</span>
              <span>•</span>
              <span>{formatearTamaño(imagenSeleccionada.tamaño)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}