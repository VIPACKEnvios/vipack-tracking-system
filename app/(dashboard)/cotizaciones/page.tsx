'use client';

import { useEffect, useMemo, useRef, useState } from "react";

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

type BorradorCotizacion = {
  cliente: string;
  telefono: string;
  cajas: Caja[];
  enviarAereo: boolean;
  enviarTerrestre: boolean;
  observaciones: string;
  guardadoEn: string;
};

const CLAVE_BORRADOR_COTIZACION =
  "vipack-cotizacion-borrador-v1";


type RegistroClienteExcel = {
  Cliente?: unknown;
  TelefonoWhatsApp?: unknown;
};

type ClienteBusqueda = {
  nombre: string;
  telefono: string;
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

function normalizarBusqueda(
  valor: string
) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function limpiarTelefonoCliente(
  valor: unknown
) {
  return String(valor ?? "")
    .replace(/\D/g, "")
    .trim();
}


function normalizarTelefonoWhatsApp(
  valor: unknown
) {
  const limpio =
    limpiarTelefonoCliente(valor);

  if (!limpio) {
    return "";
  }

  if (
    limpio.startsWith("521") &&
    limpio.length === 13
  ) {
    return limpio;
  }

  if (
    limpio.startsWith("52") &&
    limpio.length === 12
  ) {
    return `521${limpio.slice(2)}`;
  }

  if (limpio.length === 10) {
    return `521${limpio}`;
  }

  return limpio;
}

const EMOJI = {
  saludo: "\\u{1F44B}",
  paquete: "\\u{1F4E6}",
  avion: "\\u{2708}\\u{FE0F}",
  camion: "\\u{1F69A}",
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

  const [
    guardandoCotizacion,
    setGuardandoCotizacion,
  ] = useState(false);

  const [
    ultimoFolioCotizacion,
    setUltimoFolioCotizacion,
  ] = useState("");

  const [
    clientesApi,
    setClientesApi,
  ] = useState<ClienteBusqueda[]>(
    []
  );

  const [
    clientesRecolecciones,
    setClientesRecolecciones,
  ] = useState<ClienteBusqueda[]>(
    []
  );

  const [
    cargandoClientes,
    setCargandoClientes,
  ] = useState(true);

  const [
    errorClientes,
    setErrorClientes,
  ] = useState("");

  const [
    mostrarResultadosClientes,
    setMostrarResultadosClientes,
  ] = useState(false);

  const [
    borradorRestaurado,
    setBorradorRestaurado,
  ] = useState(false);

  const [
    ultimoGuardado,
    setUltimoGuardado,
  ] = useState<string | null>(
    null
  );

  const borradorHidratado =
    useRef(false);

  useEffect(() => {
    let cancelado = false;

    async function cargarClientes() {
      try {
        setCargandoClientes(
          true
        );
        setErrorClientes("");

        const [
          respuestaClientes,
          respuestaRecolecciones,
        ] = await Promise.all([
          fetch(
            `/api/clientes?t=${Date.now()}`,
            {
              cache: "no-store",
              headers: {
                "Cache-Control":
                  "no-cache",
              },
            }
          ),
          fetch(
            `/api/recolecciones?t=${Date.now()}`,
            {
              cache: "no-store",
              headers: {
                "Cache-Control":
                  "no-cache",
              },
            }
          ),
        ]);

        let listaMaestra: ClienteBusqueda[] =
          [];

        if (respuestaClientes.ok) {
          const dataClientes: unknown =
            await respuestaClientes.json();

          const raiz =
            dataClientes as
              | Record<
                  string,
                  unknown
                >
              | unknown[];

          const filas =
            Array.isArray(raiz)
              ? raiz
              : Array.isArray(
                    raiz?.clientes
                  )
                ? raiz.clientes
                : Array.isArray(
                      raiz?.registros
                    )
                  ? raiz.registros
                  : Array.isArray(
                        raiz?.data
                      )
                    ? raiz.data
                    : [];

          const mapa =
            new Map<
              string,
              ClienteBusqueda
            >();

          for (const fila of filas) {
            if (
              !fila ||
              typeof fila !== "object"
            ) {
              continue;
            }

            const item =
              fila as Record<
                string,
                unknown
              >;

            const nombre =
              String(
                item.nombre ??
                  item.Nombre ??
                  item.name ??
                  item.cliente ??
                  item.Cliente ??
                  item.razonSocial ??
                  item.razon_social ??
                  ""
              ).trim();

            if (!nombre) {
              continue;
            }

            const telefonoCliente =
              normalizarTelefonoWhatsApp(
                item.telefono ??
                  item.Telefono ??
                  item["Teléfono"] ??
                  item.whatsapp ??
                  item.WhatsApp ??
                  item.telefonoWhatsApp ??
                  item.TelefonoWhatsApp
              );

            const key =
              normalizarBusqueda(
                nombre
              );

            const actual =
              mapa.get(key);

            mapa.set(key, {
              nombre,
              telefono:
                telefonoCliente ||
                actual?.telefono ||
                "",
            });
          }

          listaMaestra =
            Array.from(
              mapa.values()
            );
        }

        let listaRecolecciones: ClienteBusqueda[] =
          [];

        if (respuestaRecolecciones.ok) {
          const dataRecolecciones =
            (await respuestaRecolecciones.json()) as {
              success?: boolean;
              registros?: RegistroClienteExcel[];
            };

          const mapa =
            new Map<
              string,
              ClienteBusqueda
            >();

          for (
            const registro of
              dataRecolecciones.registros ||
              []
          ) {
            const nombre =
              String(
                registro.Cliente ??
                  ""
              ).trim();

            if (!nombre) {
              continue;
            }

            const telefonoCliente =
              normalizarTelefonoWhatsApp(
                registro.TelefonoWhatsApp
              );

            const key =
              normalizarBusqueda(
                nombre
              );

            const actual =
              mapa.get(key);

            mapa.set(key, {
              nombre,
              telefono:
                telefonoCliente ||
                actual?.telefono ||
                "",
            });
          }

          listaRecolecciones =
            Array.from(
              mapa.values()
            );
        }

        if (!cancelado) {
          setClientesApi(
            listaMaestra
          );
          setClientesRecolecciones(
            listaRecolecciones
          );

          if (
            listaMaestra.length === 0
          ) {
            setErrorClientes(
              "No se pudo cargar el catálogo maestro; se están mostrando los clientes encontrados en recolecciones."
            );
          }
        }
      } catch (error) {
        console.error(
          "Error cargando clientes para cotizaciones:",
          error
        );

        if (!cancelado) {
          setErrorClientes(
            "No se pudo cargar el catálogo completo de clientes."
          );
        }
      } finally {
        if (!cancelado) {
          setCargandoClientes(
            false
          );
        }
      }
    }

    void cargarClientes();

    return () => {
      cancelado = true;
    };
  }, []);

  const clientes = useMemo(() => {
    const mapa =
      new Map<
        string,
        ClienteBusqueda
      >();

    for (const item of [
      ...clientesRecolecciones,
      ...clientesApi,
    ]) {
      const key =
        normalizarBusqueda(
          item.nombre
        );

      if (!key) {
        continue;
      }

      const actual =
        mapa.get(key);

      mapa.set(key, {
        nombre: item.nombre.trim(),
        telefono:
          item.telefono.trim() ||
          actual?.telefono ||
          "",
      });
    }

    return Array.from(
      mapa.values()
    ).sort((a, b) =>
      a.nombre.localeCompare(
        b.nombre,
        "es",
        {
          sensitivity: "base",
        }
      )
    );
  }, [
    clientesApi,
    clientesRecolecciones,
  ]);

  useEffect(() => {
    try {
      const guardado =
        window.localStorage.getItem(
          CLAVE_BORRADOR_COTIZACION
        );

      if (guardado) {
        const borrador =
          JSON.parse(
            guardado
          ) as BorradorCotizacion;

        setCliente(
          borrador.cliente || ""
        );
        setTelefono(
          borrador.telefono || ""
        );
        setCajas(
          Array.isArray(
            borrador.cajas
          ) &&
            borrador.cajas.length >
              0
            ? borrador.cajas
            : [CAJA_INICIAL]
        );
        setEnviarAereo(
          borrador.enviarAereo ??
            true
        );
        setEnviarTerrestre(
          borrador.enviarTerrestre ??
            true
        );
        setObservaciones(
          borrador.observaciones ||
            ""
        );
        setUltimoGuardado(
          borrador.guardadoEn ||
            null
        );
        setBorradorRestaurado(
          true
        );
      }
    } catch (error) {
      console.error(
        "No fue posible restaurar el borrador de cotización:",
        error
      );
    } finally {
      borradorHidratado.current =
        true;
    }
  }, []);

  useEffect(() => {
    if (
      !borradorHidratado.current
    ) {
      return;
    }

    const temporizador =
      window.setTimeout(() => {
        try {
          const guardadoEn =
            new Date().toISOString();

          const borrador: BorradorCotizacion =
            {
              cliente,
              telefono,
              cajas,
              enviarAereo,
              enviarTerrestre,
              observaciones,
              guardadoEn,
            };

          window.localStorage.setItem(
            CLAVE_BORRADOR_COTIZACION,
            JSON.stringify(
              borrador
            )
          );

          setUltimoGuardado(
            guardadoEn
          );
        } catch (error) {
          console.error(
            "No fue posible guardar el borrador de cotización:",
            error
          );
        }
      }, 350);

    return () =>
      window.clearTimeout(
        temporizador
      );
  }, [
    cliente,
    telefono,
    cajas,
    enviarAereo,
    enviarTerrestre,
    observaciones,
  ]);

  const clientesFiltrados =
    useMemo(() => {
      const q =
        normalizarBusqueda(
          cliente
        );

      const telefonoBuscado =
        cliente.replace(
          /\D/g,
          ""
        );

      if (!q && !telefonoBuscado) {
        return clientes.slice(
          0,
          20
        );
      }

      return clientes
        .filter((item) => {
          const nombre =
            normalizarBusqueda(
              item.nombre
            );

          return (
            nombre.includes(q) ||
            Boolean(
              telefonoBuscado &&
                item.telefono.includes(
                  telefonoBuscado
                )
            )
          );
        })
        .slice(0, 20);
    }, [cliente, clientes]);

  const calculo = useMemo(() => {
    const detalle = cajas.map((caja, indice) => {
      const largo = Number(caja.largo || 0);
      const ancho = Number(caja.ancho || 0);
      const alto = Number(caja.alto || 0);
      const pesoReal = Number(caja.peso || 0);

      const pesoVolumetrico =
        largo > 0 && ancho > 0 && alto > 0
          ? (largo * ancho * alto) / 5000
          : 0;

      const pesoCobrable = Math.max(
        pesoReal,
        pesoVolumetrico
      );

      const tarifaAerea = obtenerTarifa(
        "Aereo",
        pesoCobrable
      );

      const tarifaTerrestre = obtenerTarifa(
        "Terrestre",
        pesoCobrable
      );

      return {
        ...caja,
        numero: indice + 1,
        largo,
        ancho,
        alto,
        pesoReal,
        pesoVolumetrico,
        pesoCobrable,
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

    const pesoRealTotal = detalle.reduce(
      (total, caja) => total + caja.pesoReal,
      0
    );

    const pesoVolumetricoTotal = detalle.reduce(
      (total, caja) =>
        total + caja.pesoVolumetrico,
      0
    );

    const pesoCobrableTotal = detalle.reduce(
      (total, caja) =>
        total + caja.pesoCobrable,
      0
    );

    const cajasSinTarifa = detalle.filter(
      (caja) =>
        caja.pesoCobrable > 0 &&
        (!caja.tarifaAerea ||
          !caja.tarifaTerrestre)
    ).length;

    return {
      detalle,
      totalAereo,
      totalTerrestre,
      pesoRealTotal,
      pesoVolumetricoTotal,
      pesoCobrableTotal,
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
    setBorradorRestaurado(
      false
    );
    setUltimoGuardado(
      null
    );

    try {
      window.localStorage.removeItem(
        CLAVE_BORRADOR_COTIZACION
      );
    } catch (error) {
      console.error(
        "No fue posible borrar el borrador de cotización:",
        error
      );
    }
  }

  async function abrirWhatsApp() {
    const numero =
      normalizarTelefonoWhatsApp(
        telefono
      );

    if (!numero) {
      window.alert(
        "Selecciona o captura un teléfono válido."
      );
      return;
    }

    if (
      !enviarAereo &&
      !enviarTerrestre
    ) {
      window.alert(
        "Selecciona Aéreo, Terrestre o ambos."
      );
      return;
    }

    if (
      calculo.detalle.some(
        (caja) =>
          caja.pesoReal <= 0
      )
    ) {
      window.alert(
        "Captura el peso de todas las cajas."
      );
      return;
    }

    if (
      calculo.cajasSinTarifa > 0
    ) {
      window.alert(
        "Hay cajas sin tarifa disponible. Revisa el peso antes de enviar."
      );
      return;
    }

    if (guardandoCotizacion) {
      return;
    }

    let folioGuardado = "";

    try {
      setGuardandoCotizacion(
        true
      );

      const response =
        await fetch(
          "/api/cotizaciones",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                cliente:
                  cliente.trim(),
                telefono: numero,
                cajas:
                  calculo.detalle.map(
                    (caja) => ({
                      numero:
                        caja.numero,
                      largo:
                        caja.largo,
                      ancho:
                        caja.ancho,
                      alto:
                        caja.alto,
                      pesoReal:
                        caja.pesoReal,
                      pesoVolumetrico:
                        caja.pesoVolumetrico,
                      pesoCobrable:
                        caja.pesoCobrable,
                      precioAereo:
                        caja.tarifaAerea
                          ?.precio ??
                        null,
                      precioTerrestre:
                        caja.tarifaTerrestre
                          ?.precio ??
                        null,
                    })
                  ),
                totalAereo:
                  calculo.totalAereo,
                totalTerrestre:
                  calculo.totalTerrestre,
                enviarAereo,
                enviarTerrestre,
                observaciones:
                  observaciones.trim(),
              }),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          folio?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "No se pudo guardar la cotización en Excel."
        );
      }

      folioGuardado =
        data.folio || "";

      setUltimoFolioCotizacion(
        folioGuardado
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la cotización en Excel."
      );
      return;
    } finally {
      setGuardandoCotizacion(
        false
      );
    }

    const lineas: string[] = [
      `Hola${cliente ? ` ${cliente}` : ""} ${EMOJI.saludo}`,
      "",
      `Te compartimos tu cotización de VIPACK Envíos ${EMOJI.paquete}`,
      "",
      `Cajas: ${cajas.length}`,
      "",
      `Peso real total: ${calculo.pesoRealTotal.toFixed(
        1
      )} kg`,
      `Peso cobrable total: ${calculo.pesoCobrableTotal.toFixed(
        1
      )} kg`,
      "",
    ];

    calculo.detalle.forEach(
      (caja) => {
        lineas.push(
          `Caja ${caja.numero}: real ${caja.pesoReal.toFixed(
            1
          )} kg · volumétrico ${caja.pesoVolumetrico.toFixed(
            1
          )} kg · cobrable ${caja.pesoCobrable.toFixed(
            1
          )} kg · ${caja.largo}×${caja.ancho}×${caja.alto} cm`
        );
      }
    );

    lineas.push("");

    if (enviarAereo) {
      lineas.push(
        `${EMOJI.avion} Aéreo: ${dinero(
          calculo.totalAereo
        )}`
      );
    }

    if (enviarTerrestre) {
      lineas.push(
        `${EMOJI.camion} Terrestre: ${dinero(
          calculo.totalTerrestre
        )}`
      );
    }

    if (
      observaciones.trim()
    ) {
      lineas.push(
        "",
        `Observaciones: ${observaciones.trim()}`
      );
    }

    if (folioGuardado) {
      lineas.push(
        "",
        `Folio VIPACK: ${folioGuardado}`
      );
    }

    lineas.push(
      "",
      "Quedamos pendientes de tu confirmación."
    );

    const mensaje =
      lineas.join("\n");

    const url =
      `https://wa.me/${numero}?text=${encodeURIComponent(
        mensaje
      )}`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-100 p-2.5 sm:p-3 md:p-5">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-3 sm:mb-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-700">
              Ventas y cobranza
            </p>

            <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
              Cotizaciones
            </h1>

            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600 sm:text-sm">
              Calcula una o varias cajas de una misma
              clienta y obtén el total final del envío.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 sm:text-[11px]">
                Guardado automático
              </span>

              {borradorRestaurado && (
                <span className="text-[10px] font-bold text-blue-700 sm:text-[11px]">
                  Borrador recuperado
                </span>
              )}

              {ultimoGuardado && (
                <span className="text-[10px] text-slate-400 sm:text-[11px]">
                  Protegido ante recarga
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const hayDatos =
                Boolean(
                  cliente.trim() ||
                    telefono.trim() ||
                    observaciones.trim()
                ) ||
                cajas.some(
                  (caja) =>
                    Boolean(
                      caja.largo ||
                        caja.ancho ||
                        caja.alto ||
                        caja.peso
                    )
                );

              if (
                hayDatos &&
                !window.confirm(
                  "¿Quieres borrar la cotización actual y empezar una nueva?"
                )
              ) {
                return;
              }

              limpiarCotizacion();
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 sm:w-auto font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Nueva cotización
          </button>
        </header>

        <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4 sm:space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 sm:mb-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                  Cliente
                </p>
                <h2 className="mt-1 text-base font-black text-slate-950 sm:text-lg">
                  Datos de la clienta
                </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-2">
                <div className="relative">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700 sm:mb-2 sm:text-sm">
                    Buscar cliente
                  </span>

                  <input
                    value={cliente}
                    onFocus={() =>
                      setMostrarResultadosClientes(
                        true
                      )
                    }
                    onChange={(e) => {
                      setCliente(
                        e.target.value
                      );
                      setMostrarResultadosClientes(
                        true
                      );
                    }}
                    onBlur={() => {
                      window.setTimeout(
                        () =>
                          setMostrarResultadosClientes(
                            false
                          ),
                        150
                      );
                    }}
                    placeholder="Escribe nombre o teléfono"
                    autoComplete="off"
                    className="h-9.5 w-full sm:h-10 rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />

                  {mostrarResultadosClientes &&
                    clientesFiltrados.length >
                      0 && (
                      <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                        {clientesFiltrados.map(
                          (item) => (
                            <button
                              key={`${item.nombre}-${item.telefono}`}
                              type="button"
                              onMouseDown={(
                                evento
                              ) =>
                                evento.preventDefault()
                              }
                              onClick={() => {
                                setCliente(
                                  item.nombre
                                );
                                setTelefono(
                                  item.telefono
                                );
                                setMostrarResultadosClientes(
                                  false
                                );
                              }}
                              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-blue-50"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-black text-slate-900">
                                  {item.nombre}
                                </span>
                                <span className="block text-xs text-slate-500">
                                  {item.telefono ||
                                    "Sin teléfono registrado"}
                                </span>
                              </span>

                              <span className="shrink-0 text-xs font-bold text-blue-700">
                                Seleccionar
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    )}

                  <div className="mt-1.5 text-[11px] leading-4 sm:text-xs">
                    <span className="text-slate-400">
                      {cargandoClientes
                        ? "Cargando catálogo completo de clientes..."
                        : `${clientes.length} clientes disponibles`}
                    </span>

                    {!cargandoClientes &&
                      clientesApi.length >
                        0 && (
                        <span className="ml-1 font-semibold text-emerald-700">
                          · catálogo maestro conectado
                        </span>
                      )}

                    {errorClientes && (
                      <p className="mt-1 font-semibold text-amber-700">
                        {errorClientes}
                      </p>
                    )}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700 sm:mb-2 sm:text-sm">
                    WhatsApp
                  </span>
                  <input
                    value={telefono}
                    onChange={(e) =>
                      setTelefono(e.target.value)
                    }
                    placeholder="Ej. 6641234567"
                    inputMode="tel"
                    className="h-9.5 w-full sm:h-10 rounded-xl border border-slate-300 bg-white px-4 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                    Mercancía
                  </p>
                  <h2 className="mt-1 text-base font-black text-slate-950 sm:text-lg">
                    Cajas del envío
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Cada caja se cotiza por separado y después se suman.
                    El peso cobrable usa el mayor entre peso real y volumétrico (÷ 5000).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={agregarCaja}
                  className="w-full rounded-xl bg-[#072c74] px-4 py-2.5 font-black text-white shadow-md transition hover:bg-blue-900 sm:w-auto sm:px-5 sm:py-3"
                >
                  + Agregar caja
                </button>
              </div>

              <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
                {calculo.detalle.map((caja) => (
                  <article
                    key={caja.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4"
                  >
                    <div className="mb-2.5 flex items-center justify-between gap-2.5 sm:mb-3 sm:gap-3">
                      <div>
                        <p className="font-black text-slate-900">
                          Caja {caja.numero}
                        </p>
                        <p className="text-[11px] text-slate-500 sm:text-xs">
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

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-2.5">
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
                            className="h-9.5 w-full sm:h-10 rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="mt-2.5 grid grid-cols-3 gap-2 sm:mt-3 sm:gap-2.5">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3">
                        <p className="text-xs font-bold uppercase text-slate-600">
                          Peso real
                        </p>
                        <p className="mt-1 text-base font-black text-slate-950 sm:text-lg">
                          {caja.pesoReal.toFixed(1)} kg
                        </p>
                      </div>

                      <div className="rounded-xl border border-violet-200 bg-violet-50 p-2.5 sm:p-3">
                        <p className="text-xs font-bold uppercase text-violet-700">
                          Peso volumétrico
                        </p>
                        <p className="mt-1 text-base font-black sm:text-lg text-violet-950">
                          {caja.pesoVolumetrico.toFixed(1)} kg
                        </p>
                      </div>

                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 sm:p-3">
                        <p className="text-xs font-bold uppercase text-emerald-700">
                          Peso cobrable
                        </p>
                        <p className="mt-1 text-base font-black sm:text-lg text-emerald-950">
                          {caja.pesoCobrable.toFixed(1)} kg
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-2.5">
                      <div className="rounded-xl border border-sky-200 bg-sky-50 p-2.5 sm:p-3">
                        <p className="text-xs font-bold uppercase text-sky-700">
                          Aéreo
                        </p>
                        <p className="mt-1 text-xl font-black text-sky-950">
                          {caja.pesoCobrable <= 0
                            ? "—"
                            : caja.tarifaAerea
                            ? dinero(
                                caja.tarifaAerea
                                  .precio
                              )
                            : "Sin tarifa"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 sm:p-3">
                        <p className="text-xs font-bold uppercase text-amber-700">
                          Terrestre
                        </p>
                        <p className="mt-1 text-xl font-black text-amber-950">
                          {caja.pesoCobrable <= 0
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

          <aside className="space-y-4 sm:space-y-5">
            <section className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
                Resumen
              </p>

              <h2 className="mt-1 text-lg font-black text-slate-950 sm:text-xl">
                Total de la cotización
              </h2>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-2.5">
                <div className="rounded-xl bg-slate-100 p-2.5 sm:p-3">
                  <p className="text-xs font-bold text-slate-500">
                    Cajas
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950 sm:text-xl">
                    {cajas.length}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-2.5 sm:p-3">
                  <p className="text-xs font-bold text-slate-500">
                    Peso total
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950 sm:text-xl">
                    {calculo.pesoCobrableTotal.toFixed(1)} kg
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-sky-200 bg-sky-50 p-2.5 sm:p-3">
                  <div>
                    <p className="font-black text-sky-950">
                      ✈️ Aéreo
                    </p>
                    <p className="mt-0.5 text-xl font-black text-sky-950 sm:mt-1 sm:text-2xl">
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

                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-2.5 sm:p-3">
                  <div>
                    <p className="font-black text-amber-950">
                      🚚 Terrestre
                    </p>
                    <p className="mt-0.5 text-xl font-black text-amber-950 sm:mt-1 sm:text-2xl">
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

              <label className="mt-3 block sm:mt-4">
                <span className="mb-1.5 block text-xs font-bold text-slate-700 sm:mb-2 sm:text-sm">
                  Observaciones
                </span>
                <textarea
                  value={observaciones}
                  onChange={(e) =>
                    setObservaciones(
                      e.target.value
                    )
                  }
                  rows={2}
                  placeholder="Opcional"
                  className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <button
                type="button"
                onClick={abrirWhatsApp}
                className="mt-3 w-full rounded-xl sm:mt-4 bg-emerald-600 px-5 py-3 font-black text-white shadow-lg transition hover:bg-emerald-700"
              >
                Guardar y enviar por WhatsApp
              </button>

              <p className="mt-2 text-center text-[11px] leading-4 text-slate-400 sm:mt-3 sm:text-xs">
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