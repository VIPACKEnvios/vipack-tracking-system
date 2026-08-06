"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

type BazarConsulta = {
  id: string;
  folio: string;
  nombre_bazar: string;
  estado: "activo";
};

type RespuestaConsulta = {
  success: boolean;
  encontrado?: boolean;
  bazares?: BazarConsulta[];
  total?: number;
  mensaje?: string;
  error?: string;
};

export default function ConsultaBazaresPage() {
  const [busqueda, setBusqueda] = useState("");

  const [bazares, setBazares] =
    useState<BazarConsulta[]>([]);

  const [consultando, setConsultando] =
    useState(true);

  const [mensaje, setMensaje] = useState("");

  const [busquedaAplicada, setBusquedaAplicada] =
    useState("");

  async function cargarBazares(
    textoBusqueda = ""
  ) {
    setConsultando(true);
    setMensaje("");

    try {
      const parametros = new URLSearchParams();

      if (textoBusqueda.trim()) {
        parametros.set(
          "buscar",
          textoBusqueda.trim()
        );
      }

      const url = parametros.toString()
        ? `/api/consulta-bazares?${parametros.toString()}`
        : "/api/consulta-bazares";

      const respuesta = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

      const resultado: RespuestaConsulta =
        await respuesta.json();

      if (!respuesta.ok || !resultado.success) {
        throw new Error(
          resultado.error ||
            "No fue posible consultar los bazares."
        );
      }

      setBazares(resultado.bazares || []);
      setBusquedaAplicada(textoBusqueda.trim());

      setMensaje(
        resultado.mensaje || ""
      );
    } catch (error) {
      console.error(
        "Error consultando bazares:",
        error
      );

      setBazares([]);

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
    cargarBazares();
  }, []);

  function consultarBazar(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();
    cargarBazares(busqueda);
  }

  function limpiarConsulta() {
    setBusqueda("");
    cargarBazares();
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">
            Bazares Registrados
          </h1>

          <p className="mt-3 text-slate-600">
            Consulta la lista de bazares aprobados antes de
            recibir sus paquetes.
          </p>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-lg md:p-8">
          <form
            onSubmit={consultarBazar}
            className="space-y-4"
          >
            <label
              htmlFor="buscar-bazar"
              className="block text-lg font-bold text-slate-800"
            >
              Buscar bazar
            </label>

            <input
              id="buscar-bazar"
              type="search"
              value={busqueda}
              onChange={(evento) =>
                setBusqueda(evento.target.value)
              }
              placeholder="Escribe el nombre del bazar"
              autoComplete="off"
              className="w-full rounded-xl border border-slate-300 px-5 py-4 text-lg outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            />

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <button
                type="submit"
                disabled={consultando}
                className="rounded-xl bg-[#072c74] px-6 py-4 text-lg font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {consultando
                  ? "Buscando..."
                  : "Buscar bazar"}
              </button>

              <button
                type="button"
                onClick={limpiarConsulta}
                disabled={consultando}
                className="rounded-xl bg-slate-200 px-6 py-4 font-bold text-slate-800 transition hover:bg-slate-300 disabled:opacity-50"
              >
                Mostrar todos
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-lg">
          <header className="flex flex-wrap items-center justify-between gap-3 bg-[#072c74] px-6 py-5 text-white">
            <div>
              <h2 className="text-xl font-bold">
                Lista de bazares activos
              </h2>

              <p className="mt-1 text-sm text-blue-100">
                Solo aparecen los bazares aprobados.
              </p>
            </div>

            <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold">
              {bazares.length} registrados
            </span>
          </header>

          {consultando ? (
            <div className="p-10 text-center text-slate-600">
              Cargando bazares...
            </div>
          ) : bazares.length === 0 ? (
            <div className="p-8">
              <div className="rounded-xl border border-red-300 bg-red-50 p-6">
                <p className="text-xl font-bold text-red-800">
                  Bazar no registrado
                </p>

                <p className="mt-2 text-red-700">
                  {mensaje ||
                    "No se encontró un bazar activo con ese nombre."}
                </p>

                {busquedaAplicada && (
                  <div className="mt-5 rounded-xl bg-white p-5">
                    <p className="font-semibold text-slate-800">
                      Invítalo a registrarse en:
                    </p>

                    <p className="mt-2 break-all font-bold text-blue-700">
                      vipack-envios.com/registro-bazar
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              <ul className="divide-y divide-slate-200">
                {bazares.map((bazar) => (
                  <li
                    key={bazar.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-lg font-bold text-slate-900">
                        {bazar.nombre_bazar}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {bazar.folio}
                      </p>
                    </div>

                    <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-800">
                      Registrado
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {!consultando &&
          bazares.length > 0 &&
          busquedaAplicada && (
            <div className="mt-5 rounded-xl border border-green-300 bg-green-50 px-5 py-4 text-green-800">
              Se encontraron {bazares.length} resultados
              para “{busquedaAplicada}”.
            </div>
          )}
      </div>
    </main>
  );
}