import Link from "next/link";

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

function IconoCamion({
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 8h14l1 12H4L5 8Z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </svg>
  );
}

function IconoTienda({
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
      <path d="M4 10h16v10H4V10Z" />
      <path d="M3 10 5 4h14l2 6" />
      <path d="M8 20v-6h5v6" />
      <path d="M3 10c1 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0" />
    </svg>
  );
}

function IconoDocumento({
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
      <path d="M7 3h7l4 4v14H7V3Z" />
      <path d="M14 3v5h5" />
      <path d="M10 12h5M10 16h5" />
    </svg>
  );
}

function IconoEscudo({
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
      <path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}

function IconoFlecha({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}

function IconoSpark({
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
      <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
      <path d="m18.5 15 1 2.3L22 18.5l-2.5 1.2-1 2.3-1-2.3-2.5-1.2 2.5-1.2 1-2.3Z" />
    </svg>
  );
}

function IconoCheck({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

const accesos = [
  {
    titulo: "Envíos",
    descripcion:
      "Conoce el proceso completo desde la recolección hasta la entrega.",
    href: "#envios",
    icono: IconoCamion,
    numero: "01",
    clase:
      "from-cyan-500/20 via-blue-500/10 to-transparent",
  },
  {
    titulo: "Compras",
    descripcion:
      "Aprende cómo comprar, identificar y preparar correctamente tu mercancía.",
    href: "#compras",
    icono: IconoBolsa,
    numero: "02",
    clase:
      "from-violet-500/20 via-fuchsia-500/10 to-transparent",
  },
  {
    titulo: "Bodegas y bazares",
    descripcion:
      "Consulta establecimientos registrados y opciones confiables.",
    href: "#confianza",
    icono: IconoTienda,
    numero: "03",
    clase:
      "from-emerald-500/20 via-cyan-500/10 to-transparent",
  },
  {
    titulo: "Términos",
    descripcion:
      "Revisa políticas, responsabilidades y condiciones del servicio.",
    href: "#terminos",
    icono: IconoDocumento,
    numero: "04",
    clase:
      "from-amber-500/20 via-orange-500/10 to-transparent",
  },
];

const pasos = [
  {
    numero: "01",
    titulo: "Compra",
    descripcion:
      "Realiza tu compra con la bodega o bazar y proporciona correctamente tus datos.",
  },
  {
    numero: "02",
    titulo: "Recolección",
    descripcion:
      "VIPACK recibe la solicitud y programa la recolección de tu mercancía.",
  },
  {
    numero: "03",
    titulo: "Identificación",
    descripcion:
      "La mercancía se relaciona con tu cliente para mantenerla organizada.",
  },
  {
    numero: "04",
    titulo: "Inventario",
    descripcion:
      "Las evidencias disponibles se agregan a tu inventario en línea.",
  },
  {
    numero: "05",
    titulo: "Empaque",
    descripcion:
      "Tu mercancía se prepara para cotizar y elegir el servicio de envío.",
  },
  {
    numero: "06",
    titulo: "Envío",
    descripcion:
      "Tu paquete continúa con la paquetería seleccionada hasta su destino.",
  },
];

export default function InformacionPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f7fb] text-slate-950">
      <header className="relative isolate overflow-hidden bg-[#061b4f] text-white">
        <div className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,0.20),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.25),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(99,102,241,0.18),transparent_30%)]" />
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-[#061b4f]/40 via-[#092e81]/70 to-[#0b57d0]/60" />
        <div className="absolute inset-0 -z-10 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="mx-auto max-w-7xl px-4 pb-20 pt-5 sm:px-6 sm:pb-28 lg:px-8">
          <nav className="flex items-center justify-between gap-4">
            <Link
              href="/informacion"
              className="group flex items-center gap-3"
            >
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-lg shadow-blue-950/20 backdrop-blur-xl">
                <IconoCaja className="h-7 w-7" />
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-cyan-300 ring-4 ring-[#092e81]" />
              </div>

              <div>
                <p className="text-sm font-black tracking-[0.18em]">
                  VIPACK ENVÍOS
                </p>
                <p className="mt-0.5 text-xs font-medium text-blue-100/75">
                  Centro de información
                </p>
              </div>
            </Link>

            <div className="hidden items-center gap-2 md:flex">
              <a
                href="#envios"
                className="rounded-xl px-4 py-2 text-sm font-bold text-blue-100 transition hover:bg-white/10 hover:text-white"
              >
                Envíos
              </a>
              <a
                href="#compras"
                className="rounded-xl px-4 py-2 text-sm font-bold text-blue-100 transition hover:bg-white/10 hover:text-white"
              >
                Compras
              </a>
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
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-white/10 px-3.5 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 shadow-lg shadow-blue-950/10 backdrop-blur-xl">
                <IconoSpark className="h-4 w-4" />
                Información para clientes
              </div>

              <h1 className="mt-6 text-4xl font-black leading-[0.98] tracking-[-0.035em] sm:text-6xl lg:text-[72px]">
                Compra mejor.
                <span className="block bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-transparent">
                  Envía con claridad.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-blue-100/80 sm:text-lg sm:leading-8">
                Un espacio creado para que tengas toda la información de VIPACK
                a la mano: compras, recolecciones, envíos, bazares registrados,
                inventario y condiciones del servicio.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#accesos"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-[#0a3183] shadow-[0_16px_40px_rgba(0,0,0,.18)] transition hover:-translate-y-0.5"
                >
                  Explorar información
                  <IconoFlecha />
                </a>

                <Link
                  href="/consulta-bazares"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3.5 text-sm font-black text-white backdrop-blur-xl transition hover:bg-white/15"
                >
                  Ver bazares registrados
                </Link>
              </div>

              <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
                {[
                  ["Información", "Clara"],
                  ["Acceso", "Rápido"],
                  ["Consulta", "24/7"],
                ].map(([label, valor]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3 backdrop-blur-xl sm:px-4"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-200/75 sm:text-xs">
                      {label}
                    </p>
                    <p className="mt-1 text-base font-black sm:text-lg">
                      {valor}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-8 rounded-[40px] bg-cyan-300/10 blur-3xl" />

              <div className="relative rounded-[32px] border border-white/15 bg-white/[0.08] p-3 shadow-[0_30px_80px_rgba(2,17,58,.45)] backdrop-blur-2xl sm:p-4">
                <div className="overflow-hidden rounded-[26px] bg-white shadow-2xl">
                  <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">
                          Tu experiencia VIPACK
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-400">
                          Todo en un solo lugar
                        </p>
                      </div>

                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0a3183] text-white shadow-lg shadow-blue-200">
                        <IconoEscudo className="h-6 w-6" />
                      </div>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["Envíos", "Proceso paso a paso", IconoCamion],
                        ["Compras", "Antes de pagar", IconoBolsa],
                        ["Bazares", "Consulta registros", IconoTienda],
                        ["Políticas", "Todo por escrito", IconoDocumento],
                      ].map(([titulo, descripcion, Icono]) => {
                        const Componente =
                          Icono as typeof IconoCaja;

                        return (
                          <div
                            key={titulo as string}
                            className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/60"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0a3183] shadow-sm">
                              <Componente className="h-5 w-5" />
                            </div>
                            <p className="mt-3 text-sm font-black text-slate-950">
                              {titulo as string}
                            </p>
                            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                              {descripcion as string}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 rounded-2xl bg-gradient-to-r from-[#071f57] via-[#0a3183] to-[#1266e3] p-4 text-white">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                          <IconoSpark className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black">
                            Información simple, útil y actualizada.
                          </p>
                          <p className="mt-1 text-xs font-medium text-blue-100/80">
                            Diseñada para consultarse desde celular o computadora.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-5 -left-2 hidden rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white shadow-xl backdrop-blur-xl sm:block">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
                  Acceso público
                </p>
                <p className="mt-1 text-sm font-black">
                  Sin usuario ni contraseña
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-12 bg-[#f4f7fb] [clip-path:polygon(0_68%,100%_0,100%_100%,0_100%)] sm:h-20" />
      </header>

      <section
        id="accesos"
        className="relative z-10 mx-auto -mt-3 max-w-7xl px-4 sm:-mt-8 sm:px-6 lg:px-8"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {accesos.map((item) => {
            const Icono = item.icono;

            return (
              <a
                key={item.titulo}
                href={item.href}
                className="group relative overflow-hidden rounded-[26px] border border-white bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,.08)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(15,23,42,.13)]"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${item.clase} opacity-0 transition duration-300 group-hover:opacity-100`}
                />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0a3183] text-white shadow-lg shadow-blue-200/70 transition group-hover:scale-105">
                      <Icono className="h-6 w-6" />
                    </div>

                    <span className="text-4xl font-black leading-none text-slate-100">
                      {item.numero}
                    </span>
                  </div>

                  <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950">
                    {item.titulo}
                  </h3>

                  <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-500">
                    {item.descripcion}
                  </p>

                  <div className="mt-5 flex items-center gap-2 text-sm font-black text-[#0a3183]">
                    Explorar
                    <IconoFlecha className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <section
        id="envios"
        className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="mb-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#0a3183]">
            <IconoCamion className="h-4 w-4" />
            Dinámica de envíos
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-5xl">
            De tu compra a tu destino,
            <span className="block text-[#0a3183]">
              paso a paso.
            </span>
          </h2>

          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">
            Queremos que sepas exactamente qué sucede con tu mercancía durante
            cada etapa del proceso.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pasos.map((paso) => (
            <div
              key={paso.numero}
              className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl sm:p-6"
            >
              <div className="absolute right-4 top-1 text-[72px] font-black leading-none text-slate-50 transition group-hover:text-blue-50">
                {paso.numero}
              </div>

              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0a3183] to-[#1477f8] text-sm font-black text-white shadow-lg shadow-blue-200/60">
                  {paso.numero}
                </div>

                <h3 className="mt-5 text-xl font-black text-slate-950">
                  {paso.titulo}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {paso.descripcion}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="compras"
        className="relative overflow-hidden border-y border-slate-200 bg-white"
      >
        <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-cyan-100/60 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                <IconoBolsa className="h-4 w-4" />
                Antes de comprar
              </div>

              <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] sm:text-5xl">
                Menos confusión.
                <span className="block text-violet-700">
                  Más control.
                </span>
              </h2>

              <p className="mt-4 max-w-xl text-base leading-7 text-slate-500">
                Una compra bien identificada desde el principio facilita todo el
                proceso de recolección, inventario y envío.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Usa siempre tu número o nombre de cliente.",
                "Confirma quién entregará tu mercancía.",
                "Conserva comprobantes de compra.",
                "Evita mercancía sin identificación.",
                "Revisa condiciones del bazar antes de pagar.",
                "Consulta tu inventario cuando tengas acceso.",
              ].map((texto, index) => (
                <div
                  key={texto}
                  className="group rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 transition group-hover:bg-violet-700 group-hover:text-white">
                      <IconoCheck className="h-4 w-4" />
                    </span>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
                        TIP {String(index + 1).padStart(2, "0")}
                      </p>
                      <p className="mt-1 text-sm font-bold leading-6 text-slate-700">
                        {texto}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="confianza"
        className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="relative overflow-hidden rounded-[34px] bg-[#071f57] p-5 text-white shadow-[0_30px_80px_rgba(15,45,105,.25)] sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,.18),transparent_30%),radial-gradient(circle_at_85%_70%,rgba(59,130,246,.25),transparent_35%)]" />

          <div className="relative grid gap-10 lg:grid-cols-[1fr_.9fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-cyan-100 backdrop-blur">
                <IconoEscudo className="h-4 w-4" />
                Compra con mayor confianza
              </div>

              <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] sm:text-5xl">
                Consulta antes de comprar.
              </h2>

              <p className="mt-4 max-w-xl text-base leading-7 text-blue-100/80">
                Accede al directorio de bazares registrados y a una sección de
                bodegas recomendadas para ayudarte a tomar mejores decisiones.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/consulta-bazares"
                className="group rounded-[26px] bg-white p-5 text-slate-950 shadow-xl transition hover:-translate-y-1"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0a3183]">
                  <IconoTienda className="h-6 w-6" />
                </div>

                <p className="mt-5 text-xl font-black">
                  Bazares registrados
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Consulta los registros disponibles dentro de VIPACK.
                </p>

                <div className="mt-5 flex items-center gap-2 text-sm font-black text-[#0a3183]">
                  Consultar ahora
                  <IconoFlecha className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>

              <Link
                href="/informacion/bodegas"
                className="group rounded-[26px] border border-white/15 bg-white/10 p-5 text-white backdrop-blur-xl transition hover:-translate-y-1 hover:bg-white/15"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <IconoEscudo className="h-6 w-6" />
                </div>

                <p className="mt-5 text-xl font-black">
                  Bodegas confiables
                </p>

                <p className="mt-2 text-sm leading-6 text-blue-100/80">
                  Próximamente podrás consultar nuestro directorio recomendado.
                </p>

                <div className="mt-5 flex items-center gap-2 text-sm font-black text-white">
                  Ver sección
                  <IconoFlecha className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="terminos"
        className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8"
      >
        <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,.08)] sm:p-8">
          <div className="absolute right-0 top-0 h-36 w-36 rounded-bl-[100px] bg-gradient-to-br from-blue-50 to-cyan-50" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                <IconoDocumento className="h-4 w-4" />
                Términos y condiciones
              </div>

              <h2 className="mt-4 text-2xl font-black tracking-[-0.02em] sm:text-4xl">
                Todo claro antes de utilizar el servicio.
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base sm:leading-7">
                Consulta políticas relacionadas con compras, recolecciones,
                almacenamiento, empaque, envíos y responsabilidades.
              </p>
            </div>

            <Link
              href="/informacion/terminos"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#0a3183] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-200/70 transition hover:-translate-y-0.5 hover:bg-[#0d42ad]"
            >
              Ver términos
              <IconoFlecha />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 text-center sm:px-6 md:flex-row md:items-center md:justify-between md:text-left lg:px-8">
          <div className="flex items-center justify-center gap-3 md:justify-start">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a3183] text-white">
              <IconoCaja className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black text-[#0a3183]">
                VIPACK Envíos
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Información para clientes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-bold text-slate-500 md:justify-end">
            <a href="#envios" className="hover:text-[#0a3183]">
              Envíos
            </a>
            <a href="#compras" className="hover:text-[#0a3183]">
              Compras
            </a>
            <Link
              href="/consulta-bazares"
              className="hover:text-[#0a3183]"
            >
              Bazares
            </Link>
            <Link
              href="/informacion/terminos"
              className="hover:text-[#0a3183]"
            >
              Términos
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}