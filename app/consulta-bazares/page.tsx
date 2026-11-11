"use client";

import {
  FormEvent,
  type MouseEvent,
  useEffect,
  useState,
} from "react";

type BazarConsulta = {
  id: string;
  folio: string;
  nombre_bazar: string;
  estado: "activo";
  facebook: string | null;
  logo_url: string | null;
};

type RespuestaConsulta = {
  success: boolean;
  encontrado?: boolean;
  bazares?: BazarConsulta[];
  total?: number;
  mensaje?: string;
  error?: string;
};

function iniciales(nombre: string) {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((palabra) => palabra.charAt(0).toUpperCase())
      .join("") || "BZ"
  );
}

function facebookSeguro(valor: string | null) {
  if (!valor) return null;

  try {
    const url = new URL(valor);

    if (
      url.protocol !== "https:" ||
      ![
        "facebook.com",
        "www.facebook.com",
        "web.facebook.com",
        "m.facebook.com",
        "fb.com",
        "www.fb.com",
      ].includes(url.hostname.toLowerCase()) ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}


// Intenta abrir la aplicación de Facebook en Chrome para Android.
// En iPhone y otros navegadores se usa el enlace HTTPS original,
// que puede abrir Facebook mediante los enlaces universales del sistema.
function abrirFacebook(evento: MouseEvent<HTMLAnchorElement>, enlace: string) {
  if (typeof navigator === "undefined") return;
  const esAndroid = /Android/i.test(navigator.userAgent);
  if (!esAndroid) return;

  const url = new URL(enlace);
  // Evitar web.facebook.com: la app normalmente reconoce www.facebook.com.
  url.hostname = "www.facebook.com";
  const ruta = `${url.pathname}${url.search}${url.hash}`;
  const respaldo = encodeURIComponent(url.toString());
  const intent = `intent://www.facebook.com${ruta}#Intent;scheme=https;package=com.facebook.katana;S.browser_fallback_url=${respaldo};end`;

  evento.preventDefault();
  window.location.href = intent;
}


function TarjetaBazar({
  bazar,
  vista,
}: {
  bazar: BazarConsulta;
  vista: "cuadricula" | "lista";
}) {
  const [imagenFallida, setImagenFallida] = useState(false);
  const facebook = facebookSeguro(bazar.facebook);
  const esLista = vista === "lista";

  useEffect(() => {
    setImagenFallida(false);
  }, [bazar.logo_url]);

  if (esLista) {
    return (
      <article className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:gap-5 sm:p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-gradient-to-br from-cyan-50 to-purple-100 shadow-md ring-1 ring-slate-200 sm:h-[88px] sm:w-[88px]">
            {bazar.logo_url && !imagenFallida ? (
              <img
                src={bazar.logo_url}
                alt={`Logotipo de ${bazar.nombre_bazar}`}
                loading="lazy"
                onError={() => setImagenFallida(true)}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xl font-extrabold text-[#123D83] sm:text-2xl">
                {iniciales(bazar.nombre_bazar)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="min-w-0 break-words text-sm font-extrabold text-[#09244B] sm:text-base">
                {bazar.nombre_bazar}
              </h3>
              <span title="Bazar registrado" aria-label="Bazar registrado" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500 text-xs font-black text-white">✓</span>
            </div>
            <p className="mt-1 break-all text-xs font-bold text-slate-600">{bazar.folio}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Registrado
            </p>
          </div>
        </div>
        <div className="w-full shrink-0 sm:w-52">
          {facebook ? (
            <a
              href={facebook}
              target="_self"
              onClick={(evento) => abrirFacebook(evento, facebook)}
              aria-label={`Abrir Facebook de ${bazar.nombre_bazar}`}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#073B88] px-3 py-2.5 text-center text-sm font-extrabold !text-white transition hover:bg-[#0756AE] hover:!text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 font-black !text-white">f</span>
              Ver Facebook <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <div className="flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-3 py-2.5 text-center text-sm font-bold text-slate-700">
              Facebook no disponible
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-20 shrink-0 overflow-hidden bg-gradient-to-br from-[#0B2D65] via-[#1357A1] to-[#10C8BC] sm:h-24">
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border-[20px] border-white/10" />
        <div className="absolute bottom-0 left-0 h-12 w-full bg-gradient-to-t from-black/20 to-transparent" />
        <div className="absolute right-3 top-2 text-[10px] font-black tracking-widest text-white/90">
          VIPACK
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col px-2.5 pb-3 sm:px-4 sm:pb-4">
        {/* El logo ocupa espacio real: crece sin tapar el nombre ni el folio. */}
        <div className="relative z-10 -mt-9 mb-2 flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-gradient-to-br from-cyan-50 to-purple-100 shadow-lg sm:-mt-11 sm:h-[88px] sm:w-[88px] lg:-mt-12 lg:h-24 lg:w-24">
          {bazar.logo_url && !imagenFallida ? (
            <img
              src={bazar.logo_url}
              alt={`Logotipo de ${bazar.nombre_bazar}`}
              loading="lazy"
              onError={() => setImagenFallida(true)}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-xl font-extrabold text-[#123D83] sm:text-2xl">
              {iniciales(bazar.nombre_bazar)}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-[38px] items-start justify-between gap-1.5 sm:gap-2">
            <h3 className="line-clamp-2 min-w-0 flex-1 break-words text-[13px] font-extrabold leading-snug text-[#09244B] sm:text-base">
              {bazar.nombre_bazar}
            </h3>
            <span
              title="Bazar registrado"
              aria-label="Bazar registrado"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500 text-xs font-black text-white sm:h-6 sm:w-6 sm:text-sm"
            >
              ✓
            </span>
          </div>

          <p className="mt-0.5 break-all text-[11px] font-bold tracking-wide text-slate-600 sm:text-xs">
            {bazar.folio}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 sm:gap-2 sm:text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span>Registrado</span>
          </div>

          <div className="mt-auto pt-3">
            {facebook ? (
              <a
                href={facebook}
                target="_self"
                onClick={(evento) => abrirFacebook(evento, facebook)}
                aria-label={`Abrir Facebook de ${bazar.nombre_bazar}`}
                className="flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-xl bg-[#073B88] px-1.5 py-2.5 text-center text-[11px] font-extrabold !text-white shadow-sm transition hover:bg-[#0756AE] hover:!text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:gap-2 sm:px-3 sm:text-sm"
              >
                <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-black !text-white sm:h-5 sm:w-5 sm:text-sm">f</span>
                <span className="font-extrabold leading-tight !text-white sm:hidden">Ver Facebook</span>
                <span className="hidden font-extrabold leading-snug !text-white sm:inline">Ver perfil de Facebook</span>
                <span aria-hidden="true" className="font-extrabold !text-white">↗</span>
              </a>
            ) : (
              <div className="flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-1.5 py-2.5 text-center text-[11px] font-bold text-slate-700 sm:px-3 sm:text-[13px]">
                <span className="sm:hidden">No disponible</span>
                <span className="hidden sm:inline">Facebook no disponible</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function ConsultaBazaresPage() {
  const [busqueda, setBusqueda] = useState("");
  const [bazares, setBazares] = useState<BazarConsulta[]>([]);
  const [consultando, setConsultando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [errorConsulta, setErrorConsulta] = useState(false);
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [vista, setVista] = useState<"cuadricula" | "lista">("cuadricula");

  async function cargarBazares(textoBusqueda = "") {
    setConsultando(true);
    setMensaje("");
    setErrorConsulta(false);
    setBusquedaAplicada(textoBusqueda.trim());

    try {
      const parametros = new URLSearchParams();

      if (textoBusqueda.trim()) {
        parametros.set("buscar", textoBusqueda.trim());
      }

      const url = parametros.toString()
        ? `/api/consulta-bazares?${parametros.toString()}`
        : "/api/consulta-bazares";

      const respuesta = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

      const resultado: RespuestaConsulta = await respuesta.json();

      if (!respuesta.ok || !resultado.success) {
        throw new Error(
          resultado.error || "No fue posible consultar los bazares."
        );
      }

      setBazares(resultado.bazares || []);
      setBusquedaAplicada(textoBusqueda.trim());
      setMensaje(resultado.mensaje || "");
    } catch (error) {
      console.error("Error consultando bazares:", error);
      setBazares([]);
      setErrorConsulta(true);
      setMensaje(
        error instanceof Error
          ? error.message
          : "No fue posible realizar la consulta."
      );
    } finally {
      setConsultando(false);
    }
  }

  useEffect(() => {
    void cargarBazares();
  }, []);

  function consultarBazar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void cargarBazares(busqueda);
  }

  function limpiarConsulta() {
    setBusqueda("");
    void cargarBazares();
  }

  return (
    <main className="min-h-screen bg-[#F0F5FA]">
      {/* Banner completo: sin duplicar textos ni recortar el logotipo. */}
      <header className="w-full overflow-hidden bg-[#041A36]">
        <div className="relative mx-auto w-full max-w-[1700px]">
          <img
            src="/banner-bazares-nuevo.png"
            alt="VIPACK Envíos - Directorio oficial de bazares registrados"
            className="block h-auto w-full"
            fetchPriority="high"
          />
        </div>
        <div className="h-1 bg-gradient-to-r from-[#0877C9] via-[#00D9C6] to-[#0877C9]" />
      </header>

      <div className="mx-auto max-w-[1480px] px-3 pb-12 sm:px-6 sm:pb-16">
        <section className="relative mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:mt-5 sm:p-5">
          <form onSubmit={consultarBazar}>
            <label
              htmlFor="buscar-bazar"
              className="mb-2 block text-sm font-bold text-slate-700"
            >
              Buscar bazar por nombre
            </label>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-3">
              <input
                id="buscar-bazar"
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar bazar por nombre..."
                autoComplete="off"
                className="col-span-2 min-w-0 rounded-xl border border-slate-300 px-3 py-3 text-base text-slate-900 sm:flex-1 sm:px-4 sm:text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />

              <button
                type="submit"
                disabled={consultando}
                className="min-h-11 rounded-xl bg-[#073D85] px-3 py-2.5 text-sm font-bold text-white transition sm:px-6 hover:bg-[#062C66] disabled:opacity-50"
              >
                {consultando ? "Buscando..." : "Buscar"}
              </button>

              <button
                type="button"
                onClick={limpiarConsulta}
                disabled={consultando}
                className="min-h-11 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold text-slate-700 transition sm:px-5 hover:bg-slate-200 disabled:opacity-50"
              >
                Mostrar todos
              </button>
            </div>
          </form>
        </section>

        <section className="mt-5 sm:mt-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
            <div>
              <h2 className="text-xl font-extrabold text-[#09244B] sm:text-2xl">
                Directorio de bazares
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Bazares aprobados por VIPACK.
              </p>
            </div>

            <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-start sm:gap-3">
              <div className="flex rounded-xl border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  aria-label="Vista de cuadrícula"
                  title="Vista de cuadrícula"
                  onClick={() => setVista("cuadricula")}
                  aria-pressed={vista === "cuadricula"}
                  className={`rounded-lg px-3 py-2 text-sm font-bold ${
                    vista === "cuadricula"
                      ? "bg-[#073D85] text-white"
                      : "text-slate-600"
                  }`}
                >
                  ▦
                </button>

                <button
                  type="button"
                  aria-label="Vista de lista"
                  title="Vista de lista"
                  onClick={() => setVista("lista")}
                  aria-pressed={vista === "lista"}
                  className={`rounded-lg px-3 py-2 text-sm font-bold ${
                    vista === "lista"
                      ? "bg-[#073D85] text-white"
                      : "text-slate-600"
                  }`}
                >
                  ☰
                </button>
              </div>

              <span className="rounded-full bg-teal-100 px-3 py-2 text-xs font-extrabold text-[#073D85] sm:px-5 sm:text-sm">
                {bazares.length} {bazares.length === 1 ? "bazar registrado" : "bazares registrados"}
              </span>
            </div>
          </div>

          {consultando ? (
            <div className="rounded-2xl bg-white p-12 text-center text-slate-600">
              Cargando bazares...
            </div>
          ) : errorConsulta ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <h3 className="text-xl font-bold text-red-800">
                No fue posible cargar el directorio
              </h3>
              <p className="mt-3 text-red-700">{mensaje}</p>
              <button
                type="button"
                onClick={() => void cargarBazares(busquedaAplicada)}
                className="mt-5 rounded-xl bg-[#073D85] px-5 py-3 font-bold !text-white"
              >
                Reintentar
              </button>
            </div>
          ) : bazares.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center">
              <h3 className="text-xl font-bold text-slate-900">
                {busquedaAplicada
                  ? "Bazar no registrado"
                  : "Todavía no hay bazares activos"}
              </h3>

              <p className="mt-3 text-slate-600">{mensaje}</p>

              {busquedaAplicada && (
                <a
                  href="/registro-bazar"
                  className="mt-5 inline-block rounded-xl bg-[#073D85] px-5 py-3 font-bold !text-white hover:bg-[#062C66]"
                >
                  Invitar a registrar un bazar
                </a>
              )}
            </div>
          ) : (
            <div
              className={
                vista === "cuadricula"
                  ? "grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
                  : "grid grid-cols-1 items-stretch gap-3 sm:gap-4"
              }
            >
              {bazares.map((bazar) => (
                <TarjetaBazar
                  key={bazar.id}
                  bazar={bazar}
                  vista={vista}
                />
              ))}
            </div>
          )}

          {!consultando &&
            !errorConsulta &&
            bazares.length > 0 &&
            busquedaAplicada && (
              <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
                Se {bazares.length === 1 ? "encontró" : "encontraron"} {bazares.length} {bazares.length === 1 ? "resultado" : "resultados"} para
                {" “"}{busquedaAplicada}{"”"}.
              </p>
            )}
        </section>

        <footer className="mt-12 rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="font-bold text-slate-900">
            ¿Tienes un bazar y quieres aparecer en nuestro directorio?
          </p>

          <p className="mt-2 text-sm text-slate-600">
            Regístrate para que VIPACK revise tu solicitud.
          </p>

          <a
            href="/registro-bazar"
            className="mt-4 inline-flex rounded-xl bg-[#073D85] px-6 py-3 font-bold !text-white transition hover:bg-[#062C66] hover:!text-white"
          >
            Registrar mi bazar
          </a>
        </footer>
      </div>
    </main>
  );
}