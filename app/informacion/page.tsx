"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Vista =
  | "comprar"
  | "enviar"
  | "recolecciones"
  | "donde";

type CompraSeccion =
  | "bazares"
  | "bodegas"
  | "grupo";

type CardProps = {
  titulo: string;
  descripcion: string;
  icono: React.ReactNode;
  onClick?: () => void;
  href?: string;
  destacado?: boolean;
};

function IconoCaja({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}

function IconoCamion({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 6h11v10H3V6Z" />
      <path d="M14 9h4l3 3v4h-7V9Z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

function IconoBolsa({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M5 8h14l1 12H4L5 8Z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </svg>
  );
}

function IconoCarpeta({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 7h7l2 2h9v10H3V7Z" />
    </svg>
  );
}

function IconoTienda({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 10h16v10H4V10Z" />
      <path d="M3 10 5 4h14l2 6" />
      <path d="M8 20v-6h5v6" />
      <path d="M3 10c1 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0" />
    </svg>
  );
}

function IconoEscudo({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}

function IconoDocumento({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M7 3h7l4 4v14H7V3Z" />
      <path d="M14 3v5h5" />
      <path d="M10 12h5M10 16h5" />
    </svg>
  );
}

function IconoCheck({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function IconoFlecha({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}

function IconoAvion({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="m3 11 18-7-6 16-3-6-6-3-3 0Z" />
      <path d="m12 14 4-4" />
    </svg>
  );
}

function IconoReloj({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconoCamara({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 7h4l1.5-2h5L16 7h4v12H4V7Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}


function IconoEstrella({
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
      <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3Z" />
    </svg>
  );
}

function IconoDinero({
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
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5c-.8-.7-1.9-1-3.3-1-1.8 0-3.2.9-3.2 2.3 0 3.5 6.5 1.3 6.5 4.7 0 1.4-1.3 2.5-3.5 2.5-1.5 0-2.8-.5-3.7-1.4M12 5.5v13" />
    </svg>
  );
}

function AccesoCard({
  titulo,
  descripcion,
  icono,
  onClick,
  href,
  destacado = false,
}: CardProps) {
  const clases = destacado
    ? "border-cyan-200/50 bg-gradient-to-br from-[#0a3183] to-[#0c5ad7] text-white shadow-blue-200/60"
    : "border-slate-200 bg-white text-slate-950 shadow-slate-200/50";

  const contenido = (
    <div
      className={`group relative h-full min-h-[150px] overflow-hidden rounded-[24px] border p-4 shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-2xl sm:min-h-0 sm:rounded-[28px] sm:p-5 ${clases}`}
    >
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-300/15 blur-2xl" />
      <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent opacity-70" />

      <div className="relative flex h-full flex-col">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-[14px] sm:h-12 sm:w-12 sm:rounded-2xl ${
            destacado
              ? "bg-white/15 text-white ring-1 ring-white/15"
              : "bg-blue-50 text-[#0a3183]"
          }`}
        >
          {icono}
        </div>

        <h3 className="mt-4 text-[16px] font-black leading-tight tracking-tight sm:mt-5 sm:text-xl">
          {titulo}
        </h3>

        <p
          className={`mt-2 hidden text-sm leading-6 sm:block ${
            destacado ? "text-blue-100/85" : "text-slate-500"
          }`}
        >
          {descripcion}
        </p>

        <div
          className={`mt-auto flex items-center gap-1.5 pt-4 text-xs font-black sm:mt-5 sm:pt-0 sm:text-sm ${
            destacado ? "text-white" : "text-[#0a3183]"
          }`}
        >
          Ver
          <IconoFlecha className="h-3.5 w-3.5 transition group-hover:translate-x-1 sm:h-4 sm:w-4" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {contenido}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="block h-full w-full text-left"
    >
      {contenido}
    </button>
  );
}

const opciones: Array<{
  id: Vista;
  titulo: string;
  descripcion: string;
  icono: React.ReactNode;
}> = [
  {
    id: "comprar",
    titulo: "Quiero comprar",
    descripcion:
      "Bodegas, bazares, reglas y recomendaciones antes de pagar.",
    icono: <IconoBolsa />,
  },
  {
    id: "enviar",
    titulo: "Quiero enviar",
    descripcion:
      "Recolección, almacenamiento, empaque y modalidades de envío.",
    icono: <IconoCamion />,
  },
  {
    id: "recolecciones",
    titulo: "Mis recolecciones",
    descripcion:
      "Carpeta personalizada, evidencias, fotos, videos e inventario.",
    icono: <IconoCarpeta />,
  },
  {
    id: "donde",
    titulo: "¿Dónde puedo comprar?",
    descripcion:
      "Bazares registrados y bodegas confiables.",
    icono: <IconoTienda />,
  },
];

export default function InformacionPage() {
  const [vista, setVista] = useState<Vista>("comprar");
  const [compraSeccion, setCompraSeccion] =
    useState<CompraSeccion>("bazares");

  const tituloActivo = useMemo(
    () => opciones.find((item) => item.id === vista)?.titulo || "",
    [vista]
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#eef4ff_0%,#f8fafc_42%,#f4f7fb_100%)] text-slate-950">
      <header className="relative isolate overflow-hidden rounded-b-[34px] bg-[#061b4f] text-white shadow-[0_18px_50px_rgba(5,28,78,.22)] sm:rounded-b-none sm:shadow-none">
        <div className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_18%_15%,rgba(34,211,238,.22),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(59,130,246,.28),transparent_32%),radial-gradient(circle_at_55%_100%,rgba(99,102,241,.18),transparent_30%)]" />
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-[#061b4f]/40 via-[#092e81]/75 to-[#0b57d0]/60" />
        <div className="absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="mx-auto max-w-7xl px-5 pb-16 pt-4 sm:px-6 sm:pb-28 sm:pt-5 lg:px-8">
          <nav className="flex items-center justify-between gap-4">
            <Link href="/informacion" className="flex items-center gap-3">
              <img
                src="/vipack-logo.jpg"
                alt="VIPACK Envíos"
                className="h-11 w-11 rounded-[14px] object-cover shadow-xl ring-1 ring-white/15 sm:h-14 sm:w-14 sm:rounded-2xl"
              />

              <div>
                <p className="text-[13px] font-black tracking-[0.16em] sm:text-sm sm:tracking-[0.18em]">
                  VIPACK ENVÍOS
                </p>
                <p className="text-[10px] font-medium text-blue-100/70 sm:text-xs">
                  Centro de información
                </p>
              </div>
            </Link>

            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/informacion/bazares"
                className="rounded-xl px-4 py-2 text-sm font-bold text-blue-100 transition hover:bg-white/10 hover:text-white"
              >
                Bazares
              </Link>
              <Link
                href="/informacion/terminos"
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-black text-white backdrop-blur-xl transition hover:bg-white/15"
              >
                Términos
              </Link>
            </div>
          </nav>

          <div className="mt-8 grid items-center gap-7 sm:mt-12 lg:grid-cols-[1.08fr_.92fr] lg:gap-14 lg:py-8">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-cyan-200/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100 backdrop-blur-xl sm:px-3.5 sm:py-2 sm:text-xs sm:tracking-[0.16em]">
                Información para clientes
              </div>

              <h1 className="mt-4 max-w-[390px] text-[36px] font-black leading-[1.02] tracking-[-.04em] sm:mt-6 sm:max-w-none sm:text-6xl sm:leading-[.98] lg:text-[68px]">
                Todo lo que necesitas
                <span className="block bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-transparent">
                  para comprar y enviar.
                </span>
              </h1>

              <p className="mt-4 max-w-[390px] text-[14px] leading-6 text-blue-100/80 sm:mt-6 sm:max-w-2xl sm:text-lg sm:leading-8">
                Compra en Tijuana, reúne tus mercancías y envíalas a cualquier
                parte de México. Aquí encontrarás cómo funciona cada paso.
              </p>

              <div className="mt-6 grid grid-cols-[1.35fr_.85fr] gap-2.5 pb-2 sm:mt-8 sm:flex sm:flex-row sm:gap-3 sm:pb-0">
                <a
                  href="#elige"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-[16px] bg-gradient-to-r from-cyan-300 via-cyan-100 to-white px-3 py-3 text-[12px] font-black text-[#061b4f] shadow-[0_14px_34px_rgba(0,0,0,.16)] transition hover:-translate-y-0.5 sm:w-auto sm:gap-2 sm:rounded-2xl sm:px-5 sm:py-3.5 sm:text-sm"
                >
                  ¿Qué necesitas hacer?
                  <IconoFlecha />
                </a>

                <Link
                  href="/informacion/bazares"
                  className="inline-flex w-full items-center justify-center rounded-[16px] border border-white/20 bg-white/10 px-3 py-3 text-[12px] font-black text-white backdrop-blur-xl transition hover:bg-white/15 sm:w-auto sm:rounded-2xl sm:px-5 sm:py-3.5 sm:text-sm"
                >
                  Ver bazares
                </Link>
              </div>

            </div>

            <div className="relative mx-auto hidden w-full max-w-xl sm:block">
              <div className="absolute -inset-8 rounded-[40px] bg-cyan-300/10 blur-3xl" />

              <div className="relative rounded-[34px] border border-white/15 bg-white/[0.08] p-3 shadow-[0_30px_80px_rgba(2,17,58,.45)] backdrop-blur-2xl sm:p-4">
                <div className="rounded-[28px] bg-white p-5 text-slate-950 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">
                        Tu información VIPACK
                      </p>
                      <h2 className="mt-2 text-2xl font-black">
                        Todo organizado en un solo lugar.
                      </h2>
                    </div>

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0a3183] text-white shadow-lg">
                      <IconoEscudo className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {[
                      "Compras en bodegas y bazares.",
                      "Recolecciones y evidencias.",
                      "Aéreo y terrestre.",
                      "Inventario personalizado.",
                    ].map((texto) => (
                      <div
                        key={texto}
                        className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <IconoCheck className="h-4 w-4" />
                        </span>
                        <p className="text-sm font-bold text-slate-700">
                          {texto}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section
        id="elige"
        className="relative z-10 mx-auto mt-0 max-w-7xl px-4 pt-6 sm:-mt-12 sm:px-6 sm:pt-0 lg:px-8"
      >
        <div className="mb-5 text-center sm:mb-6">
          <h2 className="mt-1.5 text-[24px] font-black tracking-[-.02em] sm:mt-2 sm:text-3xl">
            ¿Qué necesitas hacer?
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {opciones.map((item, index) => (
            <AccesoCard
              key={item.id}
              titulo={item.titulo}
              descripcion={item.descripcion}
              icono={item.icono}
              onClick={() => setVista(item.id)}
              destacado={vista === item.id || index === 0}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-16 lg:px-8">
        <div className="min-w-0 overflow-hidden rounded-[26px] border border-white/80 bg-white/95 p-4 shadow-[0_20px_55px_rgba(15,23,42,.10)] backdrop-blur sm:rounded-[34px] sm:p-8 lg:p-10">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-700">
                Guía rápida
              </p>
              <h2 className="mt-1 text-[28px] font-black tracking-[-.03em] sm:mt-2 sm:text-4xl">
                {tituloActivo}
              </h2>
            </div>

            <p className="max-w-xl text-sm leading-6 text-slate-500">
              Información organizada para que puedas encontrar rápidamente lo
              que necesitas sin buscar entre mensajes o imágenes.
            </p>
          </div>

          {vista === "comprar" && (
            <div className="mt-6 sm:mt-8">
              <div className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-2 shadow-inner sm:p-3">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCompraSeccion("bazares")}
                    className={`group flex min-h-[96px] flex-col items-center justify-center rounded-[20px] border px-2 py-3 text-center transition sm:min-h-[112px] sm:px-4 ${
                      compraSeccion === "bazares"
                        ? "border-violet-300 bg-violet-700 text-white shadow-lg shadow-violet-200"
                        : "border-transparent bg-white text-slate-700 hover:border-violet-200"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        compraSeccion === "bazares"
                          ? "bg-white/15"
                          : "bg-violet-50 text-violet-700"
                      }`}
                    >
                      <IconoTienda className="h-5 w-5" />
                    </span>
                    <span className="mt-2 text-[12px] font-black leading-tight sm:text-sm">
                      Bazares
                    </span>
                    <span
                      className={`mt-1 hidden text-[10px] font-semibold sm:block ${
                        compraSeccion === "bazares"
                          ? "text-violet-100"
                          : "text-slate-400"
                      }`}
                    >
                      Facebook
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompraSeccion("bodegas")}
                    className={`group flex min-h-[96px] flex-col items-center justify-center rounded-[20px] border px-2 py-3 text-center transition sm:min-h-[112px] sm:px-4 ${
                      compraSeccion === "bodegas"
                        ? "border-emerald-300 bg-emerald-600 text-white shadow-lg shadow-emerald-200"
                        : "border-transparent bg-white text-slate-700 hover:border-emerald-200"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        compraSeccion === "bodegas"
                          ? "bg-white/15"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      <IconoEscudo className="h-5 w-5" />
                    </span>
                    <span className="mt-2 text-[12px] font-black leading-tight sm:text-sm">
                      Bodegas
                    </span>
                    <span
                      className={`mt-1 hidden text-[10px] font-semibold sm:block ${
                        compraSeccion === "bodegas"
                          ? "text-emerald-100"
                          : "text-slate-400"
                      }`}
                    >
                      WhatsApp
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompraSeccion("grupo")}
                    className={`group flex min-h-[96px] flex-col items-center justify-center rounded-[20px] border px-2 py-3 text-center transition sm:min-h-[112px] sm:px-4 ${
                      compraSeccion === "grupo"
                        ? "border-cyan-300 bg-[#0a3183] text-white shadow-lg shadow-blue-200"
                        : "border-transparent bg-white text-slate-700 hover:border-blue-200"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        compraSeccion === "grupo"
                          ? "bg-white/15"
                          : "bg-blue-50 text-[#0a3183]"
                      }`}
                    >
                      <IconoEstrella className="h-5 w-5" />
                    </span>
                    <span className="mt-2 text-[12px] font-black leading-tight sm:text-sm">
                      Grupo VIPACK
                    </span>
                    <span
                      className={`mt-1 hidden text-[10px] font-semibold sm:block ${
                        compraSeccion === "grupo"
                          ? "text-blue-100"
                          : "text-slate-400"
                      }`}
                    >
                      Exclusivo
                    </span>
                  </button>
                </div>
              </div>

              <div className="mt-4">
                {compraSeccion === "bazares" && (
                  <div className="animate-[fadeIn_.25s_ease-out]">
                    <div className="min-w-0 overflow-hidden rounded-[26px] border border-violet-200 sm:rounded-[30px] bg-gradient-to-br from-violet-50 via-white to-white shadow-sm">
                      <div className="p-5 sm:p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-700 text-white shadow-lg shadow-violet-200">
                            <IconoTienda className="h-6 w-6" />
                          </div>
                    
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                              Compra en bazares
                            </p>
                            <h3 className="mt-1 text-2xl font-black">
                              ¿Cómo comprar en un bazar?
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              Sigue estos pasos para que tu compra quede correctamente
                              identificada y pueda ser entregada a VIPACK.
                            </p>
                          </div>
                        </div>
                    
                        <div className="mt-6 space-y-3">
                          {[
                            {
                              titulo: "Aparta tu producto",
                              texto:
                                'En publicaciones o álbumes normalmente se aparta comentando “Yo” o “Mío”. Preguntar por un artículo no significa que esté apartado.',
                            },
                            {
                              titulo: "Indica quién recolecta",
                              texto:
                                'Al comentar o confirmar tu compra, menciona: “Me recolecta VIPACK”.',
                            },
                            {
                              titulo: "Confirma tu compra y total",
                              texto:
                                "El bazar te indicará por Inbox, Messenger o el medio que utilice el total y los datos necesarios para realizar tu pago.",
                            },
                            {
                              titulo: "Identifica correctamente tu pago",
                              texto:
                                "Coloca tu nombre o el dato solicitado por el bazar en el concepto para que tu pago pueda identificarse.",
                            },
                            {
                              titulo: "Respeta la fecha límite de pago",
                              texto:
                                "Realiza el pago dentro del plazo indicado por el bazar. Los días y horarios pueden variar.",
                            },
                            {
                              titulo: "Entrega a VIPACK",
                              texto:
                                "Los bazares entregan las compras de nuestros clientes en nuestro punto de recolección, Local C-10, en el pasillo de la comida de Swap Meet.",
                            },
                            {
                              titulo: "Revisa los detalles del producto",
                              texto:
                                "En artículos como calzado, confirma si el producto se vende con o sin caja y revisa cualquier condición indicada en la publicación.",
                            },
                            {
                              titulo: "Conserva evidencia de tu compra",
                              texto:
                                "Guarda capturas, comprobantes y mensajes hasta que tu mercancía aparezca en tu carpeta de recolecciones.",
                            },
                          ].map((paso, index) => (
                            <div
                              key={paso.titulo}
                              className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-white p-4"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xs font-black text-violet-700">
                                {index + 1}
                              </span>
                    
                              <div>
                                <p className="text-sm font-black text-slate-800">
                                  {paso.titulo}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                  {paso.texto}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                    
                        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <p className="text-sm font-black text-amber-900">
                            Importante
                          </p>
                          <p className="mt-1 text-sm leading-6 text-amber-800/80">
                            Cada bazar puede manejar sus propios días de entrega,
                            horarios, formas de apartado, pagos y políticas. Revisa
                            siempre las condiciones de la publicación antes de comprar.
                          </p>
                        </div>
                    
                        <Link
                          href="/informacion/bazares"
                          className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-violet-700 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-800"
                        >
                          Ver bazares donde puedo comprar
                          <IconoFlecha className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {compraSeccion === "bodegas" && (
                  <div className="animate-[fadeIn_.25s_ease-out]">
                    <div className="min-w-0 overflow-hidden rounded-[26px] border border-emerald-200 sm:rounded-[30px] bg-gradient-to-br from-emerald-50 via-white to-white shadow-sm">
                      <div className="p-5 sm:p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
                            <IconoEscudo className="h-6 w-6" />
                          </div>
                    
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                              Compra en bodegas
                            </p>
                            <h3 className="mt-1 text-2xl font-black">
                              ¿Cómo comprar en una bodega por WhatsApp?
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              Algunas bodegas realizan sus ventas por grupos de
                              WhatsApp. Sigue esta dinámica para que podamos
                              identificar y corroborar correctamente tu recolección.
                            </p>
                          </div>
                        </div>
                    
                        <div className="mt-6 space-y-3">
                          {[
                            {
                              titulo: "Publicación de productos",
                              texto:
                                "La bodega o vendedor publica los productos disponibles directamente en su grupo de WhatsApp. Algunos artículos pueden ser pieza única y otros tener varias piezas disponibles.",
                            },
                            {
                              titulo: "Aparta tu producto",
                              texto:
                                'Cuando encuentres un producto que quieras comprar, responde directamente a la foto o deslízala y escribe “Yo”.',
                            },
                            {
                              titulo: "Confirma que alcanzaste",
                              texto:
                                "Si el vendedor reacciona con 👍 o Like a tu comentario, significa que alcanzaste el producto y será agregado a tu nota o pedido.",
                            },
                            {
                              titulo: "Acumula tus compras",
                              texto:
                                "Durante los días de venta puedes seguir comprando. Los productos que alcances se irán agregando a tu nota.",
                            },
                            {
                              titulo: "Recibe y paga tu nota",
                              texto:
                                "La bodega o vendedor te enviará tu nota con los artículos comprados y el total a pagar. Liquídala dentro del plazo indicado.",
                            },
                            {
                              titulo: "Indica que recolecta VIPACK",
                              texto:
                                'Al proporcionar tus datos de entrega, indica claramente: “Me recolecta VIPACK”.',
                            },
                            {
                              titulo: "Comparte tu nota o pedido con VIPACK",
                              texto:
                                "Cuando recibas tu nota, pedido o comprobante de compra, debes enviárselo a VIPACK antes de la recolección. Lo utilizamos para saber qué mercancía debemos recoger y corroborar que la entrega de la bodega esté completa.",
                            },
                            {
                              titulo: "VIPACK realiza la recolección",
                              texto:
                                "VIPACK acude a la ubicación acordada con la bodega, recibe tu mercancía y la identifica para continuar con el proceso.",
                            },
                            {
                              titulo: "Revisa tus evidencias",
                              texto:
                                "Una vez procesada la recolección, podrás consultar las evidencias disponibles en tu carpeta o inventario.",
                            },
                          ].map((paso, index) => (
                            <div
                              key={paso.titulo}
                              className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-white p-4"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xs font-black text-emerald-700">
                                {index + 1}
                              </span>
                    
                              <div>
                                <p className="text-sm font-black text-slate-800">
                                  {paso.titulo}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                  {paso.texto}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                    
                        <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                          <p className="text-sm font-black text-amber-900">
                            Muy importante
                          </p>
                          <p className="mt-1 text-sm leading-6 text-amber-800/85">
                            Comparte con VIPACK tu nota, pedido o comprobante de
                            compra antes de la recolección. Esto nos permite
                            corroborar que la mercancía entregada por la bodega
                            corresponda con tu pedido.
                          </p>
                        </div>
                    
                        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                          <p className="text-sm font-black text-emerald-900">
                            Recuerda
                          </p>
                          <p className="mt-1 text-sm leading-6 text-emerald-800/80">
                            Cada bodega puede manejar diferentes días de venta,
                            horarios, fechas de pago, formas de entrega y políticas.
                            Revisa siempre las reglas particulares del grupo antes de
                            comprar.
                          </p>
                        </div>
                      </div>
                    
                    </div>
                  </div>
                )}

                {compraSeccion === "grupo" && (
                  <div className="animate-[fadeIn_.25s_ease-out]">
                    <div className="mt-5 min-w-0 overflow-hidden rounded-[26px] border border-blue-200 sm:rounded-[30px] bg-gradient-to-br from-[#071f57] via-[#0a3183] to-[#0b57d0] text-white shadow-[0_24px_70px_rgba(10,49,131,.18)]">
                      <div className="p-5 sm:p-7">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                              <IconoEstrella className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
                                Modalidad exclusiva
                              </p>
                              <h3 className="mt-1 text-2xl font-black sm:text-3xl">
                                Grupo Exclusivo VIPACK
                              </h3>
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/85">
                                Compra productos de bodegas de Tijuana mientras nuestro
                                equipo realiza la visita por ti. Las fotos y avisos se
                                comparten en tiempo real dentro del grupo.
                              </p>
                            </div>
                          </div>
                    
                          <span className="w-fit rounded-full bg-cyan-300 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#061b4f]">
                            Venta en tiempo real
                          </span>
                        </div>
                    
                        <div className="mt-7 grid gap-4 md:grid-cols-2">
                          {[
                            {
                              titulo: "Equipo autorizado",
                              texto:
                                "María forma parte del equipo autorizado de VIPACK para visitar las bodegas, tomar fotografías en tiempo real y realizar las ventas.",
                            },
                            {
                              titulo: "Aviso de visita",
                              texto:
                                "Se avisa dentro del grupo cuando nuestro equipo ya se encuentra en la bodega para que puedas estar al pendiente de las publicaciones.",
                            },
                            {
                              titulo: "Horario de las visitas",
                              texto:
                                "Las visitas se realizan entre 10:00 a. m. y 5:00 p. m., hora de Tijuana. Considera la diferencia de horario con el centro del país.",
                            },
                            {
                              titulo: "Fotos en tiempo real",
                              texto:
                                "Las fotografías se suben mientras nuestro equipo está en la bodega. Puedes realizar tus compras durante la visita y cada producto apartado se marca con 👍.",
                            },
                            {
                              titulo: "Último aviso",
                              texto:
                                "Aproximadamente media hora antes de salir se avisa que queda poco tiempo para seguir comprando. Antes de cerrar nota o pagar se dará un último aviso.",
                            },
                            {
                              titulo: "Precios reales de bodega",
                              texto:
                                "Los precios que aparecen en las fotografías son los precios reales de la bodega. La comisión de VIPACK no se agrega directamente al precio del producto.",
                            },
                          ].map((item, index) => (
                            <div
                              key={item.titulo}
                              className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur"
                            >
                              <div className="flex items-start gap-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-black text-[#0a3183]">
                                  {index + 1}
                                </span>
                                <div>
                                  <p className="text-sm font-black">{item.titulo}</p>
                                  <p className="mt-1 text-sm leading-6 text-blue-100/80">
                                    {item.texto}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                    
                        <div className="mt-6 rounded-[26px] bg-white p-5 text-slate-950 sm:p-6">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                              <IconoDinero className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                                Comisión de compra
                              </p>
                              <h4 className="text-xl font-black">
                                La comisión se cobra al final
                              </h4>
                            </div>
                          </div>
                    
                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                              <p className="text-sm font-bold text-slate-600">
                                Compra de hasta $500
                              </p>
                              <p className="mt-1 text-3xl font-black text-emerald-700">
                                $50
                              </p>
                              <p className="text-xs font-bold text-slate-500">
                                de comisión
                              </p>
                            </div>
                    
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                              <p className="text-sm font-bold text-slate-600">
                                Compra mayor a $500
                              </p>
                              <p className="mt-1 text-3xl font-black text-emerald-700">
                                $150
                              </p>
                              <p className="text-xs font-bold text-slate-500">
                                de comisión
                              </p>
                            </div>
                          </div>
                        </div>
                    
                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          {[
                            "No se hacen listas",
                            "No hay cancelaciones",
                            "Las compras son por retiro sin tarjeta",
                          ].map((regla) => (
                            <div
                              key={regla}
                              className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-black text-rose-800"
                            >
                              {regla}
                            </div>
                          ))}
                        </div>
                    
                        <div className="mt-5 grid gap-4 lg:grid-cols-2">
                          <div className="rounded-[24px] border border-amber-300 bg-amber-50 p-5 text-slate-950">
                            <p className="font-black text-amber-900">
                              Responsabilidad en las compras
                            </p>
                            <p className="mt-2 text-sm leading-6 text-amber-900/80">
                              La persona que quede mal 2 veces será expulsada del grupo.
                              No se compran productos por encargo, ya que todo se maneja
                              en el momento y un artículo puede agotarse.
                            </p>
                          </div>
                    
                          <div className="rounded-[24px] border border-violet-200 bg-violet-50 p-5 text-slate-950">
                            <p className="font-black text-violet-900">
                              Aclaraciones y reembolsos
                            </p>
                            <p className="mt-2 text-sm leading-6 text-violet-900/80">
                              Para cualquier aclaración es obligatorio enviar un video
                              abriendo la caja, sin cortes. Sin video no hay reembolso.
                            </p>
                          </div>
                        </div>
                    
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          <div className="rounded-[22px] border border-white/15 bg-white/10 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-200">
                              Envíos
                            </p>
                            <p className="mt-2 font-black">
                              Solicita tu envío directamente con VIPACK
                            </p>
                            <p className="mt-1 text-sm leading-6 text-blue-100/80">
                              Una vez terminadas tus compras, podrás solicitar el envío
                              de tu mercancía mediante los canales de atención de VIPACK.
                            </p>
                          </div>
                    
                          <div className="rounded-[22px] border border-white/15 bg-white/10 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-200">
                              Almacenamiento
                            </p>
                            <p className="mt-2 text-2xl font-black">
                              Hasta por 5 semanas
                            </p>
                            <p className="mt-1 text-sm leading-6 text-blue-100/80">
                              Puedes reunir tus compras antes de solicitar tu envío.
                            </p>
                          </div>
                        </div>
                    
                        <div className="mt-6 rounded-[26px] border border-rose-200 bg-white p-5 text-slate-950 sm:p-6">
                          <div className="text-center">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-600">
                              Importante sobre pagos
                            </p>
                            <h4 className="mt-1 text-xl font-black">
                              Las bodegas dan un plazo de 1 a 2 días para liquidar la mercancía
                            </h4>
                            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                              Para cuidar el crédito con las bodegas y poder continuar
                              ofreciendo la facilidad de realizar apartados, se aplican
                              las siguientes condiciones por mora:
                            </p>
                          </div>
                    
                          <div className="mt-5 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 text-center">
                              <p className="text-3xl font-black text-orange-600">5%</p>
                              <p className="mt-1 text-sm font-bold text-slate-700">
                                si pagas después de la hora acordada el mismo día
                              </p>
                            </div>
                    
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center">
                              <p className="text-3xl font-black text-rose-600">10%</p>
                              <p className="mt-1 text-sm font-bold text-slate-700">
                                si pagas al día siguiente
                              </p>
                            </div>
                    
                            <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5 text-center">
                              <p className="text-3xl font-black text-fuchsia-700">15%</p>
                              <p className="mt-1 text-sm font-bold text-slate-700">
                                si VIPACK tiene que pagar por ti
                              </p>
                            </div>
                          </div>
                    
                          <div className="mt-5 rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white">
                            No buscamos afectarles, sino fomentar la responsabilidad en sus compras.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {vista === "enviar" && (
            <div className="mt-8">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
                      <IconoAvion className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-600">
                        Servicio aéreo
                      </p>
                      <h3 className="text-2xl font-black">
                        2 a 3 días hábiles
                      </h3>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    Opción rápida para envíos nacionales. Los días de operación
                    se informan de acuerdo con la disponibilidad vigente.
                  </p>
                </div>

                <div className="rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                      <IconoCamion className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                        Servicio terrestre
                      </p>
                      <h3 className="text-2xl font-black">
                        8 a 10 días hábiles
                      </h3>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    Alternativa para envíos con tiempos de tránsito más amplios.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Recolección", "Recolectamos tu mercancía en bodegas de Tijuana.", <IconoTienda key="i1" />],
                  ["Almacenamiento", "Puedes reunir compras durante varias semanas antes de enviar.", <IconoCarpeta key="i2" />],
                  ["Consolidación", "Varias compras pueden viajar juntas en una sola caja.", <IconoCaja key="i3" />],
                  ["Peso y volumen", "La cotización considera las medidas y el peso de la caja empacada.", <IconoReloj key="i4" />],
                ].map(([titulo, descripcion, icono]) => (
                  <div
                    key={titulo as string}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0a3183] shadow-sm">
                      {icono as React.ReactNode}
                    </div>
                    <h4 className="mt-4 font-black">{titulo as string}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {descripcion as string}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {vista === "recolecciones" && (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_.9fr]">
              <div>
                <div className="rounded-[30px] bg-gradient-to-br from-[#071f57] to-[#0b57d0] p-6 text-white shadow-xl">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    <IconoCarpeta className="h-6 w-6" />
                  </div>

                  <h3 className="mt-5 text-3xl font-black">
                    Tu carpeta de recolecciones
                  </h3>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100/85">
                    Cada cliente cuenta con un enlace personalizado para revisar
                    sus evidencias y dar seguimiento a sus recolecciones de forma
                    ordenada.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/10 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-100">
                        Bazares
                      </p>
                      <p className="mt-1 text-sm font-black">
                        Actualización semanal
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/10 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-100">
                        Bodegas
                      </p>
                      <p className="mt-1 text-sm font-black">
                        Después de la recolección
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                {[
                  ["Evidencias", "Consulta fotografías de tus paquetes.", <IconoCamara key="c1" />],
                  ["Videos", "Cuando exista video, podrás reproducirlo desde tu inventario.", <IconoCamara key="c2" />],
                  ["Por fecha", "Las evidencias se organizan para ayudarte a localizar compras anteriores.", <IconoReloj key="c3" />],
                  ["Enlace privado", "Tu acceso utiliza un enlace personal sin necesidad de usuario del ERP.", <IconoEscudo key="c4" />],
                ].map(([titulo, descripcion, icono]) => (
                  <div
                    key={titulo as string}
                    className="flex items-start gap-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0a3183]">
                      {icono as React.ReactNode}
                    </div>
                    <div>
                      <h4 className="font-black">{titulo as string}</h4>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {descripcion as string}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {vista === "donde" && (
            <div className="mt-6 grid min-w-0 gap-5 lg:mt-8 lg:grid-cols-2">
              <Link
                href="/informacion/bazares"
                className="group rounded-[30px] bg-gradient-to-br from-[#071f57] via-[#0a3183] to-[#0b57d0] p-6 text-white shadow-xl transition hover:-translate-y-1"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                  <IconoTienda className="h-6 w-6" />
                </div>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">
                  Directorio público
                </p>

                <h3 className="mt-2 text-3xl font-black">
                  Bazares registrados
                </h3>

                <p className="mt-3 text-sm leading-6 text-blue-100/85">
                  Consulta bazares y entra directamente a sus redes para revisar sus publicaciones.
                </p>

                <div className="mt-6 flex items-center gap-2 text-sm font-black">
                  Consultar ahora
                  <IconoFlecha className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>

              <Link
                href="/informacion/bodegas"
                className="group rounded-[30px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-xl shadow-emerald-100/50 transition hover:-translate-y-1"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                  <IconoEscudo className="h-6 w-6" />
                </div>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                  Recomendaciones VIPACK
                </p>

                <h3 className="mt-2 text-3xl font-black">
                  Bodegas confiables
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Consulta el apartado de bodegas recomendadas y la información
                  disponible para comprar con mayor confianza.
                </p>

                <div className="mt-6 flex items-center gap-2 text-sm font-black text-emerald-700">
                  Ver sección
                  <IconoFlecha className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-lg sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
              Información importante
            </p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              Términos y condiciones del servicio
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Consulta políticas de recolección, almacenamiento, mercancía,
              pagos, empaque, envío y responsabilidades antes de utilizar el
              servicio.
            </p>
          </div>

          <Link
            href="/informacion/terminos"
            className="inline-flex h-full min-h-[82px] items-center justify-center gap-2 rounded-[24px] bg-[#0a3183] px-6 text-sm font-black text-white shadow-xl shadow-blue-200 transition hover:-translate-y-1"
          >
            Ver términos
            <IconoFlecha />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 text-center sm:px-6 md:flex-row md:items-center md:justify-between md:text-left lg:px-8">
          <div className="flex items-center justify-center gap-3 md:justify-start">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a3183] text-white">
              <IconoCaja className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black text-[#0a3183]">VIPACK Envíos</p>
              <p className="text-xs text-slate-400">
                Centro de información para clientes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-bold text-slate-500 md:justify-end">
            <Link href="/informacion/bazares" className="hover:text-[#0a3183]">
              Bazares
            </Link>
            <Link href="/informacion/bodegas" className="hover:text-[#0a3183]">
              Bodegas
            </Link>
            <Link href="/informacion/terminos" className="hover:text-[#0a3183]">
              Términos
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}