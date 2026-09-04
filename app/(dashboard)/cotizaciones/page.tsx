'use client';

import { useMemo, useState } from "react";

type TipoServicio = "Aereo" | "Terrestre";

type Tarifa = {
  tipo: TipoServicio;
  peso_min: number;
  peso_max: number;
  precio: number;
};

type Caja = {
  id: number;
  largo: string;
  ancho: string;
  alto: string;
  peso: string;
};

const TARIFAS: Tarifa[] = [
  { tipo: "Terrestre", peso_min: 2, peso_max: 5, precio: 650 },
  { tipo: "Terrestre", peso_min: 6, peso_max: 10, precio: 950 },
  { tipo: "Terrestre", peso_min: 11, peso_max: 15, precio: 1050 },
  { tipo: "Terrestre", peso_min: 16, peso_max: 20, precio: 1250 },
  { tipo: "Terrestre", peso_min: 21, peso_max: 25, precio: 1350 },
  { tipo: "Terrestre", peso_min: 26, peso_max: 30, precio: 1500 },
  { tipo: "Terrestre", peso_min: 31, peso_max: 35, precio: 1650 },
  { tipo: "Terrestre", peso_min: 36, peso_max: 40, precio: 1850 },
  { tipo: "Terrestre", peso_min: 41, peso_max: 45, precio: 2000 },
  { tipo: "Terrestre", peso_min: 46, peso_max: 50, precio: 2250 },
  { tipo: "Terrestre", peso_min: 51, peso_max: 55, precio: 2450 },
  { tipo: "Terrestre", peso_min: 56, peso_max: 60, precio: 2650 },

  { tipo: "Aereo", peso_min: 2, peso_max: 5, precio: 850 },
  { tipo: "Aereo", peso_min: 6, peso_max: 10, precio: 1130 },
  { tipo: "Aereo", peso_min: 11, peso_max: 15, precio: 1350 },
  { tipo: "Aereo", peso_min: 16, peso_max: 20, precio: 1600 },
  { tipo: "Aereo", peso_min: 21, peso_max: 25, precio: 1700 },
  { tipo: "Aereo", peso_min: 26, peso_max: 30, precio: 1990 },
  { tipo: "Aereo", peso_min: 31, peso_max: 35, precio: 2160 },
  { tipo: "Aereo", peso_min: 36, peso_max: 40, precio: 2355 },
  { tipo: "Aereo", peso_min: 41, peso_max: 45, precio: 2530 },
  { tipo: "Aereo", peso_min: 46, peso_max: 50, precio: 2750 },
  { tipo: "Aereo", peso_min: 51, peso_max: 60, precio: 3100 },
];

const CAJA_INICIAL: Caja = {
  id: 1,
  largo: "",
  ancho: "",
  alto: "",
  peso: "",
};

function dinero(valor: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(valor);
}

function obtenerTarifa(
  tipo: TipoServicio,
  pesoIngresado: number
) {
  if (!Number.isFinite(pesoIngresado) || pesoIngresado <= 0) {
    return null;
  }

  const pesoRedondeado = Math.ceil(pesoIngresado);

  return (
    TARIFAS.find(
      (tarifa) =>
        tarifa.tipo === tipo &&
        pesoRedondeado >= tarifa.peso_min &&
        pesoRedondeado <= tarifa.peso_max
    ) || null
  );
}

export default function CotizacionesPage() {
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cajas, setCajas] = useState<Caja[]>([
    CAJA_INICIAL,
  ]);
  const [enviarAereo, setEnviarAereo] =
    useState(true);
  const [enviarTerrestre, setEnviarTerrestre] =
    useState(true);
  const [observaciones, setObservaciones] =
    useState("");

  const calculo = useMemo(() => {
    const detalle = cajas.map((caja, indice) => {
      const peso = Number(caja.peso || 0);
      const tarifaAerea = obtenerTarifa(
        "Aereo",
        peso
      );
      const tarifaTerrestre = obtenerTarifa(
        "Terrestre",
        peso
      );

      return {
        ...caja,
        numero: indice + 1,
        peso,
        tarifaAerea,
        tarifaTerrestre,
      };
    });

    const totalAereo = detalle.reduce(
      (total, caja) =>
        total + (caja.tarifaAerea?.precio || 0),
      0
    );

    const totalTerrestre = detalle.reduce(
      (total, caja) =>
        total +
        (caja.tarifaTerrestre?.precio || 0),
      0
    );

    const pesoTotal = detalle.reduce(
      (total, caja) => total + caja.peso,
      0
    );

    const cajasSinTarifa = detalle.filter(
      (caja) =>
        caja.peso > 0 &&
        (!caja.tarifaAerea ||
          !caja.tarifaTerrestre)
    ).length;

    return {
      detalle,
      totalAereo,
      totalTerrestre,
      pesoTotal,
      cajasSinTarifa,
    };
  }, [cajas]);

  function agregarCaja() {
    setCajas((actuales) => [
      ...actuales,
      {
        id: Date.now(),
        largo: "",
        ancho: "",
        alto: "",
        peso: "",
      },
    ]);
  }

  function eliminarCaja(id: number) {
    setCajas((actuales) => {
      if (actuales.length === 1) {
        return actuales;
      }

      return actuales.filter(
        (caja) => caja.id !== id
      );
    });
  }

  function actualizarCaja(
    id: number,
    campo: keyof Omit<Caja, "id">,
    valor: string
  ) {
    setCajas((actuales) =>
      actuales.map((caja) =>
        caja.id === id
          ? {
              ...caja,
              [campo]: valor,
            }
          : caja
      )
    );
  }

  function limpiarCotizacion() {
    setCliente("");
    setTelefono("");
    setCajas([CAJA_INICIAL]);
    setEnviarAereo(true);
    setEnviarTerrestre(true);
    setObservaciones("");
  }

  function abrirWhatsApp() {
    const numero = telefono.replace(/\D/g, "");

    if (!numero) {
      window.alert(
        "Selecciona o captura el teléfono del cliente."
      );
      return;
    }

    if (!enviarAereo && !enviarTerrestre) {
      window.alert(
        "Selecciona Aéreo, Terrestre o ambos."
      );
      return;
    }

    if (
      calculo.detalle.some(
        (caja) => caja.peso <= 0
      )
    ) {
      window.alert(
        "Captura el peso de todas las cajas."
      );
      return;
    }

    if (calculo.cajasSinTarifa > 0) {
      window.alert(
        "Hay cajas sin tarifa disponible. Revisa el peso antes de enviar."
      );
      return;
    }

    const lineas = [
      `Hola${cliente ? ` ${cliente}` : ""} 👋`,
      "",
      "Te compartimos tu cotización de VIPACK Envíos 📦",
      "",
      `Cajas: ${cajas.length}`,
      `Peso total registrado: ${calculo.pesoTotal.toFixed(
        1
      )} kg`,
      "",
    ];

    calculo.detalle.forEach((caja) => {
      lineas.push(
        `Caja ${caja.numero}: ${caja.peso.toFixed(
          1
        )} kg${
          caja.largo &&
          caja.ancho &&
          caja.alto
            ? ` · ${caja.largo}×${caja.ancho}×${caja.alto} cm`
            : ""
        }`
      );
    });

    lineas.push("");

    if (enviarAereo) {
      lineas.push(
        `✈️ Aéreo: ${dinero(
          calculo.totalAereo
        )}`
      );
    }

    if (enviarTerrestre) {
      lineas.push(
        `🚚 Terrestre: ${dinero(
          calculo.totalTerrestre
        )}`
      );
    }

    if (observaciones.trim()) {
      lineas.push("", observaciones.trim());
    }

    lineas.push(
      "",
      "Quedamos pendientes de tu confirmación."
    );

    const texto = encodeURIComponent(
      lineas.join("\n")
    );

    window.open(
      `https://wa.me/${numero}?text=${texto}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-700">
              Ventas y cobranza
            </p>

            <h1 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">
              Cotizaciones
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              Calcula una o varias cajas de una misma
              clienta y obtén el total final del envío.
            </p>
          </div>

          <button
            type="button"
            onClick={limpiarCotizacion}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Nueva cotización
          </button>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                  Cliente
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Datos de la clienta
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Buscar cliente
                  </span>
                  <input
                    value={cliente}
                    onChange={(e) =>
                      setCliente(e.target.value)
                    }
                    placeholder="Nombre o número de cliente"
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                  <span className="mt-2 block text-xs text-slate-400">
                    En el siguiente paso conectaremos este
                    buscador con
                    control_recolecciones_bodega.xlsx.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    WhatsApp
                  </span>
                  <input
                    value={telefono}
                    onChange={(e) =>
                      setTelefono(e.target.value)
                    }
                    placeholder="Ej. 6641234567"
                    inputMode="tel"
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                    Mercancía
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    Cajas del envío
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Cada caja se cotiza por separado y
                    después se suman para obtener el total.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={agregarCaja}
                  className="rounded-xl bg-[#072c74] px-5 py-3 font-black text-white shadow-md transition hover:bg-blue-900"
                >
                  + Agregar caja
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {calculo.detalle.map((caja) => (
                  <article
                    key={caja.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-900">
                          Caja {caja.numero}
                        </p>
                        <p className="text-xs text-slate-500">
                          Medidas en cm · peso en kg
                        </p>
                      </div>

                      {cajas.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            eliminarCaja(caja.id)
                          }
                          className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700 hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        ["largo", "Largo"],
                        ["ancho", "Ancho"],
                        ["alto", "Alto"],
                        ["peso", "Peso"],
                      ].map(([campo, etiqueta]) => (
                        <label
                          key={campo}
                          className="block"
                        >
                          <span className="mb-1.5 block text-xs font-bold text-slate-600">
                            {etiqueta}
                          </span>
                          <input
                            value={
                              caja[
                                campo as keyof Omit<
                                  Caja,
                                  "id"
                                >
                              ]
                            }
                            onChange={(e) =>
                              actualizarCaja(
                                caja.id,
                                campo as keyof Omit<
                                  Caja,
                                  "id"
                                >,
                                e.target.value
                              )
                            }
                            type="number"
                            min="0"
                            step="0.1"
                            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                        <p className="text-xs font-bold uppercase text-sky-700">
                          Aéreo
                        </p>
                        <p className="mt-1 text-xl font-black text-sky-950">
                          {caja.peso <= 0
                            ? "—"
                            : caja.tarifaAerea
                            ? dinero(
                                caja.tarifaAerea
                                  .precio
                              )
                            : "Sin tarifa"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-bold uppercase text-amber-700">
                          Terrestre
                        </p>
                        <p className="mt-1 text-xl font-black text-amber-950">
                          {caja.peso <= 0
                            ? "—"
                            : caja.tarifaTerrestre
                            ? dinero(
                                caja.tarifaTerrestre
                                  .precio
                              )
                            : "Sin tarifa"}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="sticky top-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
                Resumen
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Total de la cotización
              </h2>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="text-xs font-bold text-slate-500">
                    Cajas
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {cajas.length}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="text-xs font-bold text-slate-500">
                    Peso total
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {calculo.pesoTotal.toFixed(1)} kg
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <div>
                    <p className="font-black text-sky-950">
                      ✈️ Aéreo
                    </p>
                    <p className="mt-1 text-2xl font-black text-sky-950">
                      {dinero(
                        calculo.totalAereo
                      )}
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={enviarAereo}
                    onChange={(e) =>
                      setEnviarAereo(
                        e.target.checked
                      )
                    }
                    className="h-5 w-5"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div>
                    <p className="font-black text-amber-950">
                      🚚 Terrestre
                    </p>
                    <p className="mt-1 text-2xl font-black text-amber-950">
                      {dinero(
                        calculo.totalTerrestre
                      )}
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={enviarTerrestre}
                    onChange={(e) =>
                      setEnviarTerrestre(
                        e.target.checked
                      )
                    }
                    className="h-5 w-5"
                  />
                </label>
              </div>

              {calculo.cajasSinTarifa > 0 && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                  Hay {calculo.cajasSinTarifa} caja(s)
                  fuera del rango de tarifas de 2 a 60
                  kg.
                </div>
              )}

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Observaciones
                </span>
                <textarea
                  value={observaciones}
                  onChange={(e) =>
                    setObservaciones(
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Opcional"
                  className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <button
                type="button"
                onClick={abrirWhatsApp}
                className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3.5 font-black text-white shadow-lg transition hover:bg-emerald-700"
              >
                Enviar cotización por WhatsApp
              </button>

              <p className="mt-3 text-center text-xs text-slate-400">
                En el siguiente paso guardaremos la
                cotización automáticamente en
                control_cotizaciones.xlsx.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
