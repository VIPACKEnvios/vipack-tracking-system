'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type EnlaceMenu = {
  etiqueta: string;
  href: string;
  icono: ReactNode;
  exacto?: boolean;
  nuevaPestana?: boolean;
};

const menuOperaciones: EnlaceMenu[] = [
  {
    etiqueta: "Inicio",
    href: "/",
    icono: <IconoInicio />,
    exacto: true,
  },
  {
    etiqueta: "Guías",
    href: "/guias",
    icono: <IconoPaquete />,
  },
  {
    etiqueta: "Envíos",
    href: "/envios",
    icono: <IconoCamion />,
  },
  {
    etiqueta: "Importaciones",
    href: "/importaciones",
    icono: <IconoImportar />,
  },
];

const menuVentas: EnlaceMenu[] = [
  {
    etiqueta: "Cotizaciones",
    href: "/cotizaciones",
    icono: <IconoCotizacion />,
  },
  {
    etiqueta: "Pagos",
    href: "/pagos",
    icono: <IconoPago />,
  },
];

const menuBazares: EnlaceMenu[] = [
  {
    etiqueta: "Administración",
    href: "/admin/bazares",
    icono: <IconoCarpeta />,
  },
  {
    etiqueta: "Consulta",
    href: "/consulta-bazares",
    icono: <IconoBuscar />,
  },
  {
    etiqueta: "Nuevo registro",
    href: "/registro-bazar",
    icono: <IconoFormulario />,
    nuevaPestana: true,
  },
];

const menuInventario: EnlaceMenu[] = [
  {
    etiqueta: "Inventarios",
    href: "/inventarios",
    icono: <IconoInventario />,
  },
  {
    etiqueta: "Recolecciones",
    href: "/recolecciones",
    icono: <IconoUbicacion />,
  },
  {
    etiqueta: "Clientes",
    href: "/clientes",
    icono: <IconoUsuarios />,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  const [menuMovilAbierto, setMenuMovilAbierto] =
    useState(false);

  const [menuContraido, setMenuContraido] =
    useState(false);

  useEffect(() => {
    setMenuMovilAbierto(false);
  }, [pathname]);

  function cerrarSesion() {
    document.cookie =
      "vipack-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";

    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        {/* Menú lateral de escritorio */}
        <aside
          className={`hidden shrink-0 flex-col border-r border-slate-800 bg-[#071b3f] text-white transition-[width] duration-300 lg:flex ${
            menuContraido ? "w-20" : "w-64"
          }`}
        >
          <LogoMenu contraido={menuContraido} />

          <nav className="flex-1 overflow-y-auto px-3 py-5">
            <GrupoMenu
              titulo="Operaciones"
              enlaces={menuOperaciones}
              pathname={pathname}
              contraido={menuContraido}
            />

            <GrupoMenu
              titulo="Ventas y cobranza"
              enlaces={menuVentas}
              pathname={pathname}
              contraido={menuContraido}
            />

            <GrupoMenu
              titulo="Bazares"
              enlaces={menuBazares}
              pathname={pathname}
              contraido={menuContraido}
            />

            <GrupoMenu
              titulo="Inventario"
              enlaces={menuInventario}
              pathname={pathname}
              contraido={menuContraido}
            />

            <div className="mt-6 border-t border-white/10 pt-5">
              <BotonProximamente
                etiqueta="Empaque"
                icono={<IconoCaja />}
                contraido={menuContraido}
              />

              <BotonProximamente
                etiqueta="Reportes"
                icono={<IconoGrafica />}
                contraido={menuContraido}
              />
            </div>
          </nav>

          <EstadoSistema contraido={menuContraido} />
        </aside>

        {/* Menú móvil */}
        {menuMovilAbierto && (
          <>
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() =>
                setMenuMovilAbierto(false)
              }
              className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
            />

            <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#071b3f] text-white shadow-2xl lg:hidden">
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <LogoMenu contraido={false} />

                <button
                  type="button"
                  onClick={() =>
                    setMenuMovilAbierto(false)
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
                  aria-label="Cerrar menú"
                >
                  <IconoCerrar />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 py-5">
                <GrupoMenu
                  titulo="Operaciones"
                  enlaces={menuOperaciones}
                  pathname={pathname}
                  contraido={false}
                />

                <GrupoMenu
                  titulo="Ventas y cobranza"
                  enlaces={menuVentas}
                  pathname={pathname}
                  contraido={false}
                />

                <GrupoMenu
                  titulo="Bazares"
                  enlaces={menuBazares}
                  pathname={pathname}
                  contraido={false}
                />

                <GrupoMenu
                  titulo="Inventario"
                  enlaces={menuInventario}
                  pathname={pathname}
                  contraido={false}
                />

                <div className="mt-6 border-t border-white/10 pt-5">
                  <BotonProximamente
                    etiqueta="Empaque"
                    icono={<IconoCaja />}
                    contraido={false}
                  />

                  <BotonProximamente
                    etiqueta="Reportes"
                    icono={<IconoGrafica />}
                    contraido={false}
                  />
                </div>
              </nav>

              <EstadoSistema contraido={false} />
            </aside>
          </>
        )}

        {/* Columna derecha */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setMenuMovilAbierto(true)
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden"
                aria-label="Abrir menú"
              >
                <IconoMenu />
              </button>

              <button
                type="button"
                onClick={() =>
                  setMenuContraido(
                    (actual) => !actual
                  )
                }
                className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 lg:flex"
                aria-label="Contraer menú"
              >
                <IconoMenu />
              </button>

              <div>
                <p className="font-black text-[#072c74]">
                  Centro de Operaciones
                </p>

                <p className="hidden text-xs text-slate-500 sm:block">
                  Administración interna de VIPACK
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#072c74] text-sm font-black text-white">
                  V
                </div>

                <div className="leading-tight">
                  <p className="text-sm font-bold text-slate-800">
                    Viridiana
                  </p>

                  <p className="text-xs text-slate-500">
                    Administradora
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={cerrarSesion}
                className="flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-700 hover:bg-red-100"
              >
                <IconoSalir />

                <span className="hidden sm:inline">
                  Cerrar sesión
                </span>
              </button>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function LogoMenu({
  contraido,
}: {
  contraido: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-5 ${
        contraido ? "justify-center" : ""
      }`}
    >
      <img
        src="/vipack-logo.jpg"
        alt="VIPACK"
        className="h-12 w-12 shrink-0 rounded-xl object-contain"
      />

      {!contraido && (
        <div className="min-w-0">
          <p className="truncate text-lg font-black">
            VIPACK ERP
          </p>

          <p className="truncate text-xs text-cyan-200">
            Sistema de operaciones
          </p>
        </div>
      )}
    </div>
  );
}

function GrupoMenu({
  titulo,
  enlaces,
  pathname,
  contraido,
}: {
  titulo: string;
  enlaces: EnlaceMenu[];
  pathname: string;
  contraido: boolean;
}) {
  return (
    <section className="mb-7">
      {!contraido && (
        <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200/70">
          {titulo}
        </p>
      )}

      <div className="space-y-1">
        {enlaces.map((enlace) => {
          const activo = enlace.exacto
            ? pathname === enlace.href
            : pathname === enlace.href ||
              pathname.startsWith(
                `${enlace.href}/`
              );

          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              target={
                enlace.nuevaPestana
                  ? "_blank"
                  : undefined
              }
              rel={
                enlace.nuevaPestana
                  ? "noopener noreferrer"
                  : undefined
              }
              title={
                contraido
                  ? enlace.etiqueta
                  : undefined
              }
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                activo
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-950/20"
                  : "text-slate-200 hover:bg-white/10 hover:text-white"
              } ${
                contraido
                  ? "justify-center"
                  : ""
              }`}
            >
              <span className="shrink-0">
                {enlace.icono}
              </span>

              {!contraido && (
                <span className="text-sm font-bold">
                  {enlace.etiqueta}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function BotonProximamente({
  etiqueta,
  icono,
  contraido,
}: {
  etiqueta: string;
  icono: ReactNode;
  contraido: boolean;
}) {
  return (
    <div
      title={
        contraido
          ? `${etiqueta} — Próximamente`
          : undefined
      }
      className={`mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-slate-500 ${
        contraido
          ? "justify-center"
          : ""
      }`}
    >
      <span className="shrink-0">
        {icono}
      </span>

      {!contraido && (
        <>
          <span className="flex-1 text-sm font-semibold">
            {etiqueta}
          </span>

          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase text-slate-400">
            Próximamente
          </span>
        </>
      )}
    </div>
  );
}

function EstadoSistema({
  contraido,
}: {
  contraido: boolean;
}) {
  return (
    <div className="border-t border-white/10 p-3">
      <div
        className={`rounded-xl bg-emerald-400/10 p-3 ${
          contraido
            ? "flex justify-center"
            : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,0.12)]" />

          {!contraido && (
            <div>
              <p className="text-xs font-black text-emerald-300">
                Sistema operativo
              </p>

              <p className="text-xs text-emerald-200/70">
                Servicios conectados
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IconoInicio() {
  return (
    <IconoBase>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </IconoBase>
  );
}

function IconoPaquete() {
  return (
    <IconoBase>
      <path d="m3 7 9-4 9 4-9 4-9-4Z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </IconoBase>
  );
}

function IconoCamion() {
  return (
    <IconoBase>
      <path d="M3 6h11v11H3V6Z" />
      <path d="M14 10h4l3 3v4h-7v-7Z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </IconoBase>
  );
}

function IconoCarpeta() {
  return (
    <IconoBase>
      <path d="M3 6h7l2 2h9v11H3V6Z" />
      <path d="M8 12h8" />
      <path d="M8 16h6" />
    </IconoBase>
  );
}

function IconoBuscar() {
  return (
    <IconoBase>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </IconoBase>
  );
}

function IconoFormulario() {
  return (
    <IconoBase>
      <path d="M6 3h9l3 3v15H6V3Z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </IconoBase>
  );
}

function IconoUsuarios() {
  return (
    <IconoBase>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5a3 3 0 0 1 0 6" />
      <path d="M18 14a5 5 0 0 1 3 6" />
    </IconoBase>
  );
}

function IconoUbicacion() {
  return (
    <IconoBase>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </IconoBase>
  );
}

function IconoCotizacion() {
  return (
    <IconoBase>
      <path d="M6 3h9l3 3v15H6V3Z" />
      <path d="M14 3v4h4" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
      <path d="M9 19h4" />
    </IconoBase>
  );
}

function IconoPago() {
  return (
    <IconoBase>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </IconoBase>
  );
}

function IconoCaja() {
  return (
    <IconoBase>
      <path d="M4 8h16v12H4V8Z" />
      <path d="M8 8V4h8v4" />
      <path d="M9 13h6" />
    </IconoBase>
  );
}

function IconoInventario() {
  return (
    <IconoBase>
      <path d="M4 7 12 3l8 4-8 4-8-4Z" />
      <path d="M4 7v10l8 4 8-4V7" />
      <path d="M12 11v10" />
      <path d="M8 9v4l4 2 4-2V9" />
    </IconoBase>
  );
}

function IconoGrafica() {
  return (
    <IconoBase>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </IconoBase>
  );
}

function IconoImportar() {
  return (
    <IconoBase>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </IconoBase>
  );
}

function IconoMenu() {
  return (
    <IconoBase>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </IconoBase>
  );
}

function IconoCerrar() {
  return (
    <IconoBase>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </IconoBase>
  );
}

function IconoSalir() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    </svg>
  );
}

function IconoBase({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}