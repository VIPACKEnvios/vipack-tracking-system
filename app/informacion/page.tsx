"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Vista =
  | "comprar"
  | "enviar"
  | "recolecciones"
  | "donde";

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
      className={`group relative h-full overflow-hidden rounded-[28px] border p-5 shadow-xl transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${clases}`}
    >
      <div className="absolute right-[-30px] top-[-30px] h-32 w-32 rounded-full bg-cyan-300/10 blur-2xl" />

      <div className="relative">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
            destacado
              ? "bg-white/15 text-white"
              : "bg-blue-50 text-[#0a3183]"
          }`}
        >
          {icono}
        </div>

        <h3 className="mt-5 text-xl font-black tracking-tight">
          {titulo}
        </h3>

        <p
          className={`mt-2 text-sm leading-6 ${
            destacado ? "text-blue-100/85" : "text-slate-500"
          }`}
        >
          {descripcion}
        </p>

        <div
          className={`mt-5 flex items-center gap-2 text-sm font-black ${
            destacado ? "text-white" : "text-[#0a3183]"
          }`}
        >
          Ver información
          <IconoFlecha className="h-4 w-4 transition group-hover:translate-x-1" />
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

  const tituloActivo = useMemo(
    () => opciones.find((item) => item.id === vista)?.titulo || "",
    [vista]
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f7fb] text-slate-950">
      <header className="relative isolate overflow-hidden bg-[#061b4f] text-white">
        <div className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_18%_15%,rgba(34,211,238,.22),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(59,130,246,.28),transparent_32%),radial-gradient(circle_at_55%_100%,rgba(99,102,241,.18),transparent_30%)]" />
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-[#061b4f]/40 via-[#092e81]/75 to-[#0b57d0]/60" />
        <div className="absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6 sm:pb-32 lg:px-8">
          <nav className="flex items-center justify-between gap-4">
            <Link href="/informacion" className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-xl backdrop-blur-xl">
                <IconoCaja className="h-7 w-7" />
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-cyan-300 ring-4 ring-[#092e81]" />
              </div>

              <div>
                <p className="text-sm font-black tracking-[0.18em]">
                  VIPACK ENVÍOS
                </p>
                <p className="text-xs font-medium text-blue-100/75">
                  Centro de información
                </p>
              </div>
            </Link>

            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/consulta-bazares"
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

          <div className="mt-14 grid items-center gap-12 lg:grid-cols-[1.08fr_.92fr] lg:gap-14 lg:py-8">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-cyan-200/20 bg-white/10 px-3.5 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 backdrop-blur-xl">
                Información para clientes
              </div>

              <h1 className="mt-6 text-4xl font-black leading-[.98] tracking-[-.035em] sm:text-6xl lg:text-[68px]">
                Todo lo que necesitas
                <span className="block bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-transparent">
                  para comprar y enviar.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-blue-100/80 sm:text-lg sm:leading-8">
                Compra en Tijuana, reúne tus mercancías y envíalas a cualquier
                parte de México. Aquí encontrarás cómo funciona cada paso.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#elige"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-[#0a3183] shadow-[0_16px_40px_rgba(0,0,0,.18)] transition hover:-translate-y-0.5"
                >
                  ¿Qué necesitas hacer?
                  <IconoFlecha />
                </a>

                <Link
                  href="/consulta-bazares"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3.5 text-sm font-black text-white backdrop-blur-xl transition hover:bg-white/15"
                >
                  Consultar bazares
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
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
        className="relative z-10 mx-auto -mt-12 max-w-7xl px-4 sm:-mt-16 sm:px-6 lg:px-8"
      >
        <div className="mb-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-700">
            Empieza aquí
          </p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">
            ¿Qué necesitas hacer?
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="rounded-[34px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,.08)] sm:p-8 lg:p-10">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-700">
                Guía rápida
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-.03em] sm:text-4xl">
                {tituloActivo}
              </h2>
            </div>

            <p className="max-w-xl text-sm leading-6 text-slate-500">
              Información organizada para que puedas encontrar rápidamente lo
              que necesitas sin buscar entre mensajes o imágenes.
            </p>
          </div>

          {vista === "comprar" && (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_.9fr]">
              <div>
                <h3 className="text-2xl font-black">
                  Antes de realizar una compra
                </h3>

                <div className="mt-5 grid gap-3">
                  {[
                    "Usa siempre tu número o nombre de cliente para identificar la compra.",
                    "Conserva comprobantes, nota o captura de tu pedido.",
                    "Confirma quién entregará la mercancía.",
                    "Evita mercancía sin identificación.",
                    "Revisa las condiciones del bazar o bodega antes de pagar.",
                    "Si es tu primera compra con un bazar, verifica cómo apareces registrado.",
                  ].map((texto) => (
                    <div
                      key={texto}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                        <IconoCheck className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-bold leading-6 text-slate-700">
                        {texto}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[26px] bg-gradient-to-br from-violet-50 to-white p-5 ring-1 ring-violet-100">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                    Bazares
                  </p>
                  <h4 className="mt-2 text-xl font-black">
                    Identifícate correctamente
                  </h4>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Cuando el bazar lo indique, comenta que VIPACK realiza tu
                    recolección para que tu compra quede registrada con el
                    recolector correcto.
                  </p>
                </div>

                <div className="rounded-[26px] bg-gradient-to-br from-emerald-50 to-white p-5 ring-1 ring-emerald-100">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                    Bodegas
                  </p>
                  <h4 className="mt-2 text-xl font-black">
                    Compra mientras el equipo está en visita
                  </h4>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    El equipo autorizado comparte evidencia y mantiene al grupo
                    informado durante las visitas para que puedas comprar en
                    tiempo real.
                  </p>
                </div>

                <div className="rounded-[26px] bg-amber-50 p-5 ring-1 ring-amber-100">
                  <p className="text-sm font-black text-amber-800">
                    Importante
                  </p>
                  <p className="mt-2 text-sm leading-6 text-amber-800/80">
                    Horarios, comisiones, días de visita y condiciones de pago
                    pueden cambiar. Consulta siempre el aviso vigente del grupo.
                  </p>
                </div>
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
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <Link
                href="/consulta-bazares"
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
                  Consulta los bazares que aparecen registrados dentro de VIPACK.
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
            <Link href="/consulta-bazares" className="hover:text-[#0a3183]">
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