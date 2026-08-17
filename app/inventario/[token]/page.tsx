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

  const [mesActivo, setMesActivo] =
    useState<string>("");

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

  const mesesDisponibles = Array.from(
    new Set(
      imagenes
        .map((item) =>
          obtenerClaveMes(item.modificado)
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
    !mesActivo || mesActivo === "todos"
      ? imagenes
      : imagenes.filter(
          (item) =>
            obtenerClaveMes(
              item.modificado
            ) === mesActivo
        );

  const cerrarGaleria = () => setFotoActiva(null);

  useEffect(() => {
    if (mesesDisponibles.length === 0) {
      setMesActivo("todos");
      return;
    }

    setMesActivo((actual) => {
      if (
        actual &&
        (
          actual === "todos" ||
          mesesDisponibles.includes(actual)
        )
      ) {
        return actual;
      }

      return mesesDisponibles[0];
    });
  }, [data?.cliente?.id_cliente, mesesDisponibles.join("|")]);

  const cambiarMes = (mes: string) => {
    setMesActivo(mes);
    setFotoActiva(null);
  };

  const fotoAnterior = () => {
    setFotoActiva((actual) => {
      if (actual === null) return null;
      return actual === 0 ? imagenesFiltradas.length - 1 : actual - 1;
    });
  };

  const fotoSiguiente = () => {
    setFotoActiva((actual) => {
      if (actual === null) return null;
      return actual === imagenesFiltradas.length - 1 ? 0 : actual + 1;
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
  }, [fotoActiva, imagenesFiltradas.length]);

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
    fotoActiva !== null
      ? imagenesFiltradas[fotoActiva]
      : null;

  const srcImagen = (item: InventarioItem) =>
    `/api/inventario/${encodeURIComponent(
      token
    )}/archivo/${encodeURIComponent(item.id)}`;

  return (
    <>
      <main className="min-h-screen w-full overflow-x-hidden bg-[#f6f9fd]">
        <header className="relative overflow-hidden bg-gradient-to-br from-[#061f5c] via-[#083783] to-[#0755d5] text-white shadow-lg">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="mx-auto max-w-7xl px-4 py-7 sm:px-8 sm:py-9">
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-blue-100 sm:text-sm">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/25 bg-white/10">◇</span>
                  VIPACK Envíos
                </p>
                <h1 className="mt-2 text-4xl font-black leading-none tracking-tight sm:text-5xl">Mi inventario</h1>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/15 px-4 py-2.5 text-sm font-bold shadow-inner backdrop-blur">
                <span className="text-base">♙</span>
                Cliente #{String(data.cliente?.id_cliente || "").padStart(5, "0")}
              </div>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
          <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-blue-50" />
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400 sm:text-sm">Inventario de</p>
              <h2 className="mt-2 max-w-3xl break-words text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
                {data.cliente?.nombre}
              </h2>

              <div className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-4">
                <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-3 sm:p-5">
                  <div className="flex items-center gap-2 text-violet-700">
                    <span className="hidden text-xl sm:inline">▤</span>
                    <p className="text-[10px] font-bold uppercase tracking-wide sm:text-sm">Archivos</p>
                  </div>
                  <p className="mt-1 text-2xl font-black text-violet-700 sm:text-3xl">{data.total || 0}</p>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 sm:p-5">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <span className="hidden text-xl sm:inline">▧</span>
                    <p className="text-[10px] font-bold uppercase tracking-wide sm:text-sm">Fotos</p>
                  </div>
                  <p className="mt-1 text-2xl font-black text-emerald-600 sm:text-3xl">{imagenes.length}</p>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 sm:p-5">
                  <div className="flex items-center gap-2 text-amber-700">
                    <span className="hidden text-xl sm:inline">□</span>
                    <p className="text-[10px] font-bold uppercase leading-tight tracking-wide sm:text-sm">Otros archivos</p>
                  </div>
                  <p className="mt-1 text-2xl font-black text-amber-500 sm:text-3xl">{otrosArchivos.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-9">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#0755d5] sm:text-sm">
                  <span>▣</span> Evidencias
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Fotos de recolección</h2>
              </div>
              <div className="rounded-2xl bg-blue-50 px-3 py-2 text-center text-[#0755d5]">
                <span className="block text-lg font-black leading-none">{imagenesFiltradas.length}</span>
                <span className="text-[10px] font-bold">total</span>
              </div>
            </div>

            {imagenes.length > 0 && (
              <div className="mb-5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max gap-2">
                  <button type="button" onClick={() => cambiarMes("todos")}
                    className={`min-w-[76px] rounded-2xl border px-3 py-2.5 text-center transition ${mesActivo === "todos" ? "border-[#0755d5] bg-[#0755d5] text-white shadow-md shadow-blue-200" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}>
                    <span className="block text-[11px] font-black sm:text-sm">Todos</span>
                    <span className={`mt-0.5 block text-[11px] font-black ${mesActivo === "todos" ? "text-white/85" : "text-[#0755d5]"}`}>{imagenes.length}</span>
                  </button>

                  {mesesDisponibles.map((mes) => {
                    const cantidad = imagenes.filter((item) => obtenerClaveMes(item.modificado) === mes).length;
                    return (
                      <button key={mes} type="button" onClick={() => cambiarMes(mes)}
                        className={`min-w-[88px] rounded-2xl border px-3 py-2.5 text-center transition sm:min-w-[110px] ${mesActivo === mes ? "border-[#0755d5] bg-[#0755d5] text-white shadow-md shadow-blue-200" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}>
                        <span className="block whitespace-nowrap text-[11px] font-black sm:hidden">{formatearMesCorto(mes)}</span>
                        <span className="hidden whitespace-nowrap text-sm font-black sm:block">{formatearMes(mes)}</span>
                        <span className={`mt-0.5 block text-[11px] font-black ${mesActivo === mes ? "text-white/85" : "text-[#0755d5]"}`}>{cantidad}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {imagenes.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Aún no hay fotos disponibles.</div>
            ) : imagenesFiltradas.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No hay fotos disponibles en este mes.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {imagenesFiltradas.map((item, index) => (
                  <article key={item.id} className="group min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_5px_18px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:rounded-3xl">
                    <button type="button" onClick={() => setFotoActiva(index)} className="relative block w-full cursor-zoom-in overflow-hidden bg-slate-100 text-left" aria-label={`Abrir foto ${item.nombre}`}>
                      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden sm:aspect-square">
                        <img src={srcImagen(item)} alt={item.nombre} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" loading="lazy" />
                      </div>
                      <span className="absolute left-2.5 top-2.5 flex h-7 min-w-7 items-center justify-center rounded-lg bg-white/95 px-2 text-xs font-black text-slate-800 shadow-sm">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </button>
                    <div className="p-3 sm:p-4">
                      <p className="truncate text-sm font-black text-slate-950 sm:text-base">{item.nombre}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-slate-500 sm:text-xs">
                        <span>▣ {formatearFecha(item.modificado)}</span><span>•</span><span>{formatearTamaño(item.tamaño)}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {otrosArchivos.length > 0 && (
            <div className="mt-10">
              <p className="text-xs font-black uppercase tracking-wider text-[#0755d5] sm:text-sm">Documentos</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Otros archivos</h2>
              <div className="mt-5 space-y-3">
                {otrosArchivos.map((item) => (
                  <a key={item.id} href={item.webUrl || "#"} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#0755d5] sm:p-5">
                    <div className="min-w-0"><p className="truncate font-bold text-slate-900">{item.nombre}</p><p className="mt-1 text-sm text-slate-500">{formatearFecha(item.modificado)}</p></div>
                    <span className="shrink-0 text-sm font-bold text-[#0755d5]">Abrir</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <footer className="mt-12 overflow-hidden rounded-[26px] bg-gradient-to-r from-[#072c74] to-[#0755d5] px-5 py-5 text-white shadow-lg sm:px-7">
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-base font-black sm:text-lg">Tu inventario, siempre al alcance</p><p className="mt-1 text-xs text-blue-100 sm:text-sm">Revisa tus paquetes, evidencias y archivos en un solo lugar.</p></div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xl text-[#0755d5] shadow">◇</div>
            </div>
          </footer>
        </section>
      </main>

      {imagenSeleccionada && fotoActiva !== null && (
        <div className="fixed inset-0 z-[100] bg-black/95" role="dialog" aria-modal="true" aria-label="Galería de fotos" onClick={cerrarGaleria}>
          <div className="mx-auto grid h-[100dvh] w-full max-w-[1600px] grid-rows-[64px_minmax(0,1fr)_48px] sm:grid-rows-[72px_minmax(0,1fr)_52px]" onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => { inicioTouchX.current = event.touches[0]?.clientX ?? null; }}
            onTouchEnd={(event) => { if (inicioTouchX.current === null) return; const fin = event.changedTouches[0]?.clientX; if (typeof fin !== "number") { inicioTouchX.current = null; return; } const diferencia = fin - inicioTouchX.current; inicioTouchX.current = null; if (Math.abs(diferencia) < 50) return; if (diferencia > 0) fotoAnterior(); else fotoSiguiente(); }}>
            <div className="flex items-center justify-between gap-3 px-4 pt-[max(8px,env(safe-area-inset-top))] text-white sm:px-8">
              <div className="min-w-0"><p className="truncate text-sm font-bold sm:text-base">{imagenSeleccionada.nombre}</p><p className="mt-0.5 text-xs text-white/65">{fotoActiva + 1} de {imagenesFiltradas.length}</p></div>
              <button type="button" onClick={cerrarGaleria} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl font-light text-white transition active:scale-95 hover:bg-white/25 sm:h-11 sm:w-11" aria-label="Cerrar galería">×</button>
            </div>
            <div className="relative min-h-0 overflow-hidden px-2 py-2 sm:px-6 sm:py-3 lg:px-20">
              <div className="flex h-full w-full items-center justify-center"><img src={srcImagen(imagenSeleccionada)} alt={imagenSeleccionada.nombre} className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl sm:rounded-xl" draggable={false} /></div>
              {imagenesFiltradas.length > 1 && <><button type="button" onClick={fotoAnterior} className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-2xl text-white backdrop-blur transition active:scale-95 hover:bg-black/80 sm:left-4 sm:h-12 sm:w-12 sm:text-3xl lg:left-8" aria-label="Foto anterior">‹</button><button type="button" onClick={fotoSiguiente} className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-2xl text-white backdrop-blur transition active:scale-95 hover:bg-black/80 sm:right-4 sm:h-12 sm:w-12 sm:text-3xl lg:right-8" aria-label="Foto siguiente">›</button></>}
            </div>
            <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-black/30 px-4 pb-[max(8px,env(safe-area-inset-bottom))] text-xs text-white/65 sm:text-sm"><span>{formatearFecha(imagenSeleccionada.modificado)}</span><span>•</span><span>{formatearTamaño(imagenSeleccionada.tamaño)}</span></div>
          </div>
        </div>
      )}
    </>
  );
}