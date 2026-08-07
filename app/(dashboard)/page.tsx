"use client";

import {
  useEffect,
  useState,
} from "react";

type Bazar = {
  id: string;
  estado: string | null;
};

export default function DashboardPage() {
  const [cargando, setCargando] =
    useState(true);

  const [totalBazares, setTotalBazares] =
    useState(0);

  const [bazaresActivos, setBazaresActivos] =
    useState(0);

  const [
    bazaresPendientes,
    setBazaresPendientes,
  ] = useState(0);

  useEffect(() => {
    async function cargarResumen() {
      try {
        const respuesta = await fetch(
          "/api/admin/bazares",
          {
            cache: "no-store",
          }
        );

        const resultado =
          await respuesta.json();

        if (
          !respuesta.ok ||
          !resultado.success
        ) {
          throw new Error(
            resultado.error ||
              "No fue posible cargar los bazares."
          );
        }

        const bazares: Bazar[] =
          resultado.bazares || [];

        const activos =
          bazares.filter(
            (bazar) =>
              String(
                bazar.estado || ""
              )
                .trim()
                .toLowerCase() ===
              "activo"
          ).length;

        const pendientes =
          bazares.filter(
            (bazar) =>
              String(
                bazar.estado || ""
              )
                .trim()
                .toLowerCase() ===
              "pendiente"
          ).length;

        setTotalBazares(
          bazares.length
        );

        setBazaresActivos(
          activos
        );

        setBazaresPendientes(
          pendientes
        );
      } catch (error) {
        console.error(
          "Error cargando resumen del dashboard:",
          error
        );
      } finally {
        setCargando(false);
      }
    }

    cargarResumen();
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-100 via-white to-blue-50 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#061b48] via-[#073b88] to-[#00a7a7] px-6 py-10 text-white shadow-2xl ring-1 ring-blue-300/30 md:px-10 md:py-12">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="absolute -bottom-24 right-24 h-60 w-60 rounded-full bg-blue-300/20 blur-2xl" />

          <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-sm font-bold text-white shadow-sm backdrop-blur">
                Panel principal
              </span>

              <h1 className="mt-5 text-3xl font-black tracking-tight text-white md:text-5xl">
                Bienvenida, Viridiana
              </h1>

              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-cyan-50 md:text-lg">
                Consulta el estado general de las operaciones de VIPACK
                desde un solo lugar.
              </p>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-white/25 bg-white/15 p-4 shadow-lg backdrop-blur">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-300 text-emerald-950 shadow-md">
                <IconoEstado />
              </div>

              <div>
                <p className="text-sm font-semibold text-cyan-50">
                  Estado del sistema
                </p>

                <p className="font-black text-white">
                  Operando correctamente
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TarjetaResumen
            titulo="Bazares registrados"
            cantidad={
              cargando
                ? "..."
                : String(totalBazares)
            }
            descripcion="Total de registros"
            icono={<IconoUsuarios />}
            claseIcono="bg-blue-600 text-white"
            claseBorde="border-blue-200"
            claseFondo="bg-gradient-to-br from-white to-blue-50"
          />

          <TarjetaResumen
            titulo="Bazares activos"
            cantidad={
              cargando
                ? "..."
                : String(bazaresActivos)
            }
            descripcion="Aprobados actualmente"
            icono={<IconoActivo />}
            claseIcono="bg-emerald-600 text-white"
            claseBorde="border-emerald-200"
            claseFondo="bg-gradient-to-br from-white to-emerald-50"
          />

          <TarjetaResumen
            titulo="Pendientes"
            cantidad={
              cargando
                ? "..."
                : String(
                    bazaresPendientes
                  )
            }
            descripcion="Esperando revisión"
            icono={<IconoReloj />}
            claseIcono="bg-amber-500 text-white"
            claseBorde="border-amber-200"
            claseFondo="bg-gradient-to-br from-white to-amber-50"
          />

          <TarjetaResumen
            titulo="Módulos activos"
            cantidad="4"
            descripcion="Disponibles en el sistema"
            icono={<IconoCuadricula />}
            claseIcono="bg-violet-600 text-white"
            claseBorde="border-violet-200"
            claseFondo="bg-gradient-to-br from-white to-violet-50"
          />
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-2">
          <article className="rounded-3xl border border-amber-200 bg-gradient-to-br from-white to-amber-50 p-6 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-700">
                  Seguimiento
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Pendientes
                </h2>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md">
                <IconoReloj />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-white p-4 shadow-sm">
                <div>
                  <p className="font-black text-slate-950">
                    Bazares por revisar
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-600">
                    Registros pendientes de aprobación
                  </p>
                </div>

                <span className="rounded-xl bg-amber-100 px-4 py-2 text-3xl font-black text-amber-800">
                  {cargando
                    ? "..."
                    : bazaresPendientes}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-blue-300 bg-white p-4 shadow-sm">
                <div>
                  <p className="font-black text-slate-950">
                    Guías pendientes
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-600">
                    Envíos que requieren seguimiento
                  </p>
                </div>

                <span className="rounded-xl bg-blue-100 px-4 py-2 text-3xl font-black text-blue-800">
                  0
                </span>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">
                  Operaciones
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Actividad reciente
                </h2>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
                <IconoActividad />
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <Actividad
                titulo="Bazar aprobado"
                descripcion="Un registro cambió a estado activo."
                hora="Hoy"
                clasePunto="bg-emerald-500"
                claseFondo="bg-emerald-50"
              />

              <Actividad
                titulo="Sistema conectado"
                descripcion="Supabase y servicios internos están operando."
                hora="Activo"
                clasePunto="bg-blue-500"
                claseFondo="bg-blue-50"
              />

              <Actividad
                titulo="Expedientes organizados"
                descripcion="Los documentos se guardan por folio."
                hora="Actualizado"
                clasePunto="bg-violet-500"
                claseFondo="bg-violet-50"
              />
            </div>
          </article>
        </section>

        <section className="mt-8 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-cyan-50 p-6 shadow-lg">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">
                Estado general
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Servicios conectados
              </h2>

              <p className="mt-2 font-medium text-slate-700">
                Los módulos internos y la base de datos están disponibles.
              </p>
            </div>

            <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-5 py-4 shadow-sm">
              <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.15)]" />

              <div>
                <p className="font-black text-emerald-800">
                  Sistema operativo
                </p>

                <p className="text-sm font-semibold text-emerald-600">
                  Sin incidencias detectadas
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 py-6 text-center text-sm font-medium text-slate-500">
          VIPACK Envíos · Sistema interno de administración y operaciones
        </footer>
      </div>
    </div>
  );
}

function TarjetaResumen({
  titulo,
  cantidad,
  descripcion,
  icono,
  claseIcono,
  claseBorde,
  claseFondo,
}: {
  titulo: string;
  cantidad: string;
  descripcion: string;
  icono: React.ReactNode;
  claseIcono: string;
  claseBorde: string;
  claseFondo: string;
}) {
  return (
    <article
      className={`rounded-3xl border ${claseBorde} ${claseFondo} p-5 shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-600">
            {titulo}
          </p>

          <p className="mt-3 text-4xl font-black text-slate-950">
            {cantidad}
          </p>

          <p className="mt-1 text-sm font-medium text-slate-500">
            {descripcion}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${claseIcono} shadow-md`}
        >
          {icono}
        </div>
      </div>
    </article>
  );
}

function Actividad({
  titulo,
  descripcion,
  hora,
  clasePunto,
  claseFondo,
}: {
  titulo: string;
  descripcion: string;
  hora: string;
  clasePunto: string;
  claseFondo: string;
}) {
  return (
    <div
      className={`flex items-start gap-4 rounded-2xl p-4 ${claseFondo}`}
    >
      <span
        className={`mt-2 h-3 w-3 shrink-0 rounded-full ${clasePunto}`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-black text-slate-950">
            {titulo}
          </p>

          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
            {hora}
          </span>
        </div>

        <p className="mt-1 text-sm font-medium text-slate-600">
          {descripcion}
        </p>
      </div>
    </div>
  );
}

function IconoEstado() {
  return (
    <IconoBase>
      <path d="m5 12 4 4L19 6" />
    </IconoBase>
  );
}

function IconoUsuarios() {
  return (
    <IconoBase>
      <circle
        cx="9"
        cy="8"
        r="3"
      />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5a3 3 0 0 1 0 6" />
      <path d="M18 14a5 5 0 0 1 3 6" />
    </IconoBase>
  );
}

function IconoActivo() {
  return (
    <IconoBase>
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path d="m8 12 3 3 5-6" />
    </IconoBase>
  );
}

function IconoReloj() {
  return (
    <IconoBase>
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path d="M12 7v5l3 2" />
    </IconoBase>
  );
}

function IconoCuadricula() {
  return (
    <IconoBase>
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1"
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1"
      />
      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="1"
      />
    </IconoBase>
  );
}

function IconoActividad() {
  return (
    <IconoBase>
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </IconoBase>
  );
}

function IconoBase({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}