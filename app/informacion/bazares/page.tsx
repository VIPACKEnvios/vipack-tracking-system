"use client";

import Link from "next/link";

function IconoFacebook({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5h1.7V4.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V11H7.3v3h2.8v8h3.4Z" />
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

/*
 * BAZARES
 *
 * Para agregar otro bazar:
 *
 * {
 *   id: "nombre-bazar",
 *   nombre: "Nombre del bazar",
 *   descripcion: "Descripción",
 *   facebook: "LINK DE FACEBOOK",
 *   iniciales: "NB",
 * },
 */
const bazares = [
  {
    id: "aline-huerta",
    nombre: "Aline Huerta",
    descripcion:
      "Bazar registrado dentro del directorio de compras de VIPACK.",
    facebook:
      "https://web.facebook.com/aline.huerta.676336",
    iniciales: "AH",
  },
];

export default function BazaresInformacionPage() {
  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950">

      {/* ========================================
          ENCABEZADO
      ======================================== */}
      <header className="relative overflow-hidden bg-[#061b4f] text-white">

        {/* Luces decorativas */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,.20),transparent_30%),radial-gradient(circle_at_82%_20%,rgba(59,130,246,.24),transparent_32%)]" />

        {/* Cuadrícula */}
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 sm:pb-20 lg:px-8">

          {/* ========================================
              MENÚ SUPERIOR
          ======================================== */}
          <nav className="flex items-center justify-between gap-4">

            {/* LOGO VIPACK - UNA SOLA VEZ */}
            <Link
              href="/informacion"
              className="flex items-center gap-3"
            >
              <img
                src="/vipack-logo.jpg"
                alt="VIPACK Envíos"
                className="h-14 w-14 rounded-2xl object-cover shadow-lg"
              />

              <div>
                <p className="text-sm font-black tracking-[0.16em]">
                  VIPACK ENVÍOS
                </p>

                <p className="text-xs text-blue-100/75">
                  Directorio para clientes
                </p>
              </div>
            </Link>

            <Link
              href="/informacion"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-black backdrop-blur transition hover:bg-white/15"
            >
              Volver
            </Link>
          </nav>

          {/* ========================================
              PRESENTACIÓN
          ======================================== */}
          <div className="mt-12 max-w-3xl">

            <span className="inline-flex rounded-full border border-cyan-200/20 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">
              Dónde comprar
            </span>

            <h1 className="mt-5 text-4xl font-black leading-tight tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Bazares para comprar

              <span className="block bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-transparent">
                con mayor confianza.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-blue-100/80 sm:text-lg">
              Consulta los bazares que VIPACK ha agregado a este
              directorio y entra directamente a su Facebook para
              revisar sus publicaciones.
            </p>
          </div>
        </div>
      </header>

      {/* ========================================
          CONTENIDO
      ======================================== */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">

        {/* AVISO */}
        <div className="mb-8 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 sm:p-5">

          <div className="flex items-start gap-3">

            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <IconoCheck className="h-5 w-5" />
            </span>

            <div>
              <p className="font-black text-emerald-900">
                Directorio de bazares
              </p>

              <p className="mt-1 text-sm leading-6 text-emerald-800/80">
                Aquí podrás consultar bazares y acceder directamente
                a sus perfiles de Facebook para revisar sus
                publicaciones y productos.
              </p>
            </div>
          </div>
        </div>

        {/* ========================================
            TARJETAS DE BAZARES
        ======================================== */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">

          {bazares.map((bazar) => (
            <article
              key={bazar.id}
              className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,.08)] transition hover:-translate-y-1.5 hover:shadow-[0_24px_65px_rgba(15,23,42,.13)]"
            >

              {/* CABECERA DE TARJETA */}
              <div className="relative h-36 bg-gradient-to-br from-[#071f57] via-[#0a3183] to-[#0b57d0]">

                <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:30px_30px]" />

                {/* INICIALES */}
                <div className="absolute bottom-[-34px] left-5 flex h-20 w-20 items-center justify-center rounded-[24px] border-4 border-white bg-white text-2xl font-black text-[#0a3183] shadow-xl">
                  {bazar.iniciales}
                </div>

                {/* ESTADO */}
                <span className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
                  Bazar registrado
                </span>
              </div>

              {/* INFORMACIÓN */}
              <div className="px-5 pb-5 pt-12">

                <h2 className="text-xl font-black text-slate-950">
                  {bazar.nombre}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {bazar.descripcion}
                </p>

                {/* BOTÓN FACEBOOK */}
                <a
                  href={bazar.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 flex items-center justify-between rounded-2xl bg-[#1877F2] px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-200/70 transition hover:bg-[#1268d8]"
                >
                  <span className="flex items-center gap-2">
                    <IconoFacebook />

                    Visitar Facebook
                  </span>

                  <IconoFlecha className="h-4 w-4" />
                </a>
              </div>
            </article>
          ))}
        </div>

        {/* ========================================
            RECOMENDACIONES
        ======================================== */}
        <div className="mt-10 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">

          <h3 className="text-xl font-black">
            Antes de comprar
          </h3>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

            {[
              "Confirma las reglas de compra del bazar.",
              "Identifica tu compra con los datos solicitados.",
              "Conserva comprobantes o capturas de tu pedido.",
            ].map((texto) => (
              <div
                key={texto}
                className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4"
              >

                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <IconoCheck className="h-4 w-4" />
                </span>

                <p className="text-sm font-bold leading-6 text-slate-700">
                  {texto}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* VOLVER */}
        <div className="mt-10 text-center">

          <Link
            href="/informacion"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#0a3183] px-6 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5"
          >
            Volver al Centro de Información
          </Link>
        </div>
      </section>
    </main>
  );
}