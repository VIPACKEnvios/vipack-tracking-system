"use client";

import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ClienteInventario = {
  id: number;
  id_cliente: number;
  nombre: string;
  carpeta_cliente: string | null;
  onedrive_folder_id: string | null;
  token_inventario: string | null;
  activo: boolean;
  total_archivos?: number;
};

type RespuestaClientes = {
  success: boolean;
  clientes?: ClienteInventario[];
  error?: string;
};

type RespuestaSesionCarga = {
  success: boolean;
  uploadUrl?: string;
  expirationDateTime?: string | null;
  error?: string;
  detalle?: unknown;
};


type RespuestaSincronizacion = {
  success: boolean;
  resumen?: {
    total_clientes?: number;
    carpetas_creadas?: number;
    sincronizados?: number;
    ya_sincronizados?: number;
    tokens_generados?: number;
    duplicados_onedrive?: number;
    errores?: number;
    carpetas_onedrive?: number;
  };
  error?: string;
  detalle?: unknown;
};

type ArchivoPendiente = {
  id: string;
  archivo: File;
  progreso: number;
  estado:
    | "pendiente"
    | "subiendo"
    | "completado"
    | "error";
  error?: string;
};

function numeroCliente(valor: number) {
  return `#${String(valor).padStart(5, "0")}`;
}

function formatearTamaño(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function IconoBuscar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function IconoSubir() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function IconoCarpeta() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M3 7h7l2 2h9v10H3V7Z" />
    </svg>
  );
}

function IconoImagen() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m5 18 5-5 3 3 2-2 4 4" />
    </svg>
  );
}

function IconoCerrar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}


function IconoSincronizar({
  girando = false,
}: {
  girando?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`h-5 w-5 ${
        girando ? "animate-spin" : ""
      }`}
      aria-hidden="true"
    >
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M6.1 9A7 7 0 0 1 18 6l2 1" />
      <path d="M17.9 15A7 7 0 0 1 6 18l-2-1" />
    </svg>
  );
}


function IconoCopiar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconoWhatsApp() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" />
      <path d="M8.5 8.5c.5 2.8 2.2 4.5 5 5" />
    </svg>
  );
}

export default function InventariosAdminPage() {
  const [clientes, setClientes] =
    useState<ClienteInventario[]>([]);

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] =
    useState("");

  const [busqueda, setBusqueda] =
    useState("");

  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<ClienteInventario | null>(null);

  const [archivos, setArchivos] =
    useState<ArchivoPendiente[]>([]);

  const [subiendo, setSubiendo] =
    useState(false);

  const [mensaje, setMensaje] =
    useState("");

  const [sincronizando, setSincronizando] =
    useState(false);

  const [mensajeSincronizacion, setMensajeSincronizacion] =
    useState("");

  const inputArchivos =
    useRef<HTMLInputElement | null>(null);

  const inicioPanelRef =
    useRef<HTMLDivElement | null>(null);

  async function cargarClientes() {
    try {
      setCargando(true);
      setError("");

      const response = await fetch(
        "/api/inventarios/clientes",
        {
          cache: "no-store",
        }
      );

      const data: RespuestaClientes =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "No se pudieron cargar los clientes."
        );
      }

      const lista =
        Array.isArray(
          data.clientes
        )
          ? data.clientes
          : [];

      setClientes(lista);

      /*
       * Si hay un cliente seleccionado,
       * refrescamos sus datos después de
       * sincronizar sin sacarlo del panel.
       */
      setClienteSeleccionado(
        (actual) => {
          if (!actual) {
            return actual;
          }

          return (
            lista.find(
              (cliente) =>
                cliente.id ===
                actual.id
            ) || actual
          );
        }
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los clientes."
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarClientes();
  }, []);

  const clientesFiltrados =
    useMemo(() => {
      const texto =
        busqueda.trim().toLowerCase();

      if (!texto) {
        return clientes;
      }

      return clientes.filter((cliente) => {
        const numero =
          String(cliente.id_cliente);

        const nombre =
          cliente.nombre.toLowerCase();

        const carpeta =
          (cliente.carpeta_cliente || "")
            .toLowerCase();

        return (
          numero.includes(texto) ||
          nombre.includes(texto) ||
          carpeta.includes(texto)
        );
      });
    }, [clientes, busqueda]);

  async function sincronizarClientes() {
    try {
      setSincronizando(true);
      setMensajeSincronizacion("");

      const response = await fetch(
        "/api/onedrive/sync-clientes",
        {
          method: "POST",
          cache: "no-store",
        }
      );

      const data: RespuestaSincronizacion =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        let detalle = "";

        if (
          typeof data.detalle ===
          "string"
        ) {
          detalle = data.detalle;
        } else if (
          data.detalle
        ) {
          try {
            detalle =
              JSON.stringify(
                data.detalle
              );
          } catch {
            detalle = "";
          }
        }

        throw new Error(
          detalle
            ? `${data.error || "No se pudo sincronizar."} — ${detalle}`
            : data.error ||
                "No se pudo sincronizar."
        );
      }

      const resumen =
        data.resumen || {};

      const creadas =
        resumen.carpetas_creadas ||
        0;

      const vinculadas =
        resumen.sincronizados ||
        0;

      const tokens =
        resumen.tokens_generados ||
        0;

      const duplicados =
        resumen.duplicados_onedrive ||
        0;

      const errores =
        resumen.errores ||
        0;

      setMensajeSincronizacion(
        `Sincronización terminada: ${creadas} carpeta(s) creada(s), ${vinculadas} cliente(s) vinculado(s), ${tokens} token(s) generado(s), ${duplicados} duplicado(s) y ${errores} error(es).`
      );

      await cargarClientes();
    } catch (err) {
      setMensajeSincronizacion(
        err instanceof Error
          ? err.message
          : "No se pudo sincronizar clientes."
      );
    } finally {
      setSincronizando(false);
    }
  }

  function agregarArchivos(
    lista: FileList | File[]
  ) {
    const nuevos = Array.from(lista)
      .filter((archivo) => {
        return (
          archivo.type.startsWith("image/") ||
          archivo.type.startsWith("video/")
        );
      })
      .map((archivo) => ({
        id: `${archivo.name}-${archivo.size}-${archivo.lastModified}-${Math.random()}`,
        archivo,
        progreso: 0,
        estado: "pendiente" as const,
      }));

    if (nuevos.length === 0) {
      setMensaje(
        "Selecciona únicamente fotos o videos."
      );
      return;
    }

    setMensaje("");
    setArchivos((actuales) => [
      ...actuales,
      ...nuevos,
    ]);
  }

  function manejarInput(
    event: ChangeEvent<HTMLInputElement>
  ) {
    if (!event.target.files) {
      return;
    }

    agregarArchivos(
      event.target.files
    );

    event.target.value = "";
  }

  function manejarDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    if (
      event.dataTransfer.files.length
    ) {
      agregarArchivos(
        event.dataTransfer.files
      );
    }
  }

  function quitarArchivo(
    id: string
  ) {
    setArchivos((actuales) =>
      actuales.filter(
        (item) => item.id !== id
      )
    );
  }

  function actualizarArchivo(
    id: string,
    cambios: Partial<ArchivoPendiente>
  ) {
    setArchivos((actuales) =>
      actuales.map((item) =>
        item.id === id
          ? {
              ...item,
              ...cambios,
            }
          : item
      )
    );
  }

  async function crearSesionCarga(
    cliente: ClienteInventario,
    item: ArchivoPendiente
  ) {
    const response = await fetch(
      "/api/inventarios/subir",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          id_cliente:
            cliente.id_cliente,
          nombre_archivo:
            item.archivo.name,
          tamaño:
            item.archivo.size,
        }),
      }
    );

    const data: RespuestaSesionCarga =
      await response.json();

    if (
      !response.ok ||
      !data.success ||
      !data.uploadUrl
    ) {
      let detalle = "";

      if (
        typeof data.detalle ===
        "string"
      ) {
        detalle = data.detalle;
      } else if (data.detalle) {
        try {
          detalle =
            JSON.stringify(
              data.detalle
            );
        } catch {
          detalle = "";
        }
      }

      throw new Error(
        detalle
          ? `${data.error || "No se pudo preparar la subida."} — ${detalle}`
          : data.error ||
              "No se pudo preparar la subida."
      );
    }

    return data.uploadUrl;
  }

  async function subirArchivoPorPartes(
    item: ArchivoPendiente,
    uploadUrl: string
  ) {
    /*
     * 5 MiB.
     * Es múltiplo exacto de 320 KiB,
     * como requiere Microsoft Graph.
     */
    const chunkSize =
      5 * 1024 * 1024;

    const total =
      item.archivo.size;

    let inicio = 0;

    while (inicio < total) {
      const finExclusivo =
        Math.min(
          inicio + chunkSize,
          total
        );

      const bloque =
        item.archivo.slice(
          inicio,
          finExclusivo
        );

      const finInclusivo =
        finExclusivo - 1;

      const response = await fetch(
        uploadUrl,
        {
          method: "PUT",
          headers: {
            "Content-Length":
              String(bloque.size),
            "Content-Range":
              `bytes ${inicio}-${finInclusivo}/${total}`,
          },
          body: bloque,
        }
      );

      if (
        response.status !== 200 &&
        response.status !== 201 &&
        response.status !== 202
      ) {
        let detalle = "";

        try {
          const errorData =
            await response.json();

          detalle =
            errorData?.error?.message ||
            errorData?.error ||
            "";
        } catch {
          detalle =
            await response.text();
        }

        throw new Error(
          detalle ||
            `OneDrive devolvió HTTP ${response.status}.`
        );
      }

      inicio =
        finExclusivo;

      const progreso =
        Math.min(
          100,
          Math.round(
            (inicio / total) *
              100
          )
        );

      actualizarArchivo(
        item.id,
        {
          progreso,
          estado:
            progreso === 100
              ? "completado"
              : "subiendo",
        }
      );
    }
  }

  async function subirEvidencias() {
    if (!clienteSeleccionado) {
      setMensaje(
        "Selecciona un cliente."
      );
      return;
    }

    if (
      !clienteSeleccionado.onedrive_folder_id
    ) {
      setMensaje(
        "Este cliente todavía no tiene carpeta de OneDrive vinculada."
      );
      return;
    }

    if (archivos.length === 0) {
      setMensaje(
        "Selecciona al menos una foto o video."
      );
      return;
    }

    try {
      setSubiendo(true);
      setMensaje("");

      let subidos = 0;
      let errores = 0;

      /*
       * Subimos uno por uno para no saturar
       * el navegador ni OneDrive.
       */
      for (const item of archivos) {
        try {
          actualizarArchivo(
            item.id,
            {
              progreso: 0,
              estado:
                "subiendo",
              error:
                undefined,
            }
          );

          const uploadUrl =
            await crearSesionCarga(
              clienteSeleccionado,
              item
            );

          await subirArchivoPorPartes(
            item,
            uploadUrl
          );

          actualizarArchivo(
            item.id,
            {
              progreso: 100,
              estado:
                "completado",
            }
          );

          subidos += 1;
        } catch (err) {
          errores += 1;

          actualizarArchivo(
            item.id,
            {
              estado: "error",
              error:
                err instanceof Error
                  ? err.message
                  : "Error desconocido.",
            }
          );
        }
      }

      if (
        errores === 0
      ) {
        setMensaje(
          `${subidos} archivo(s) subido(s) correctamente a OneDrive.`
        );
      } else {
        setMensaje(
          `${subidos} archivo(s) subido(s) y ${errores} con error. Revisa los archivos marcados.`
        );
      }
    } finally {
      setSubiendo(false);
    }
  }

  function obtenerUrlInventario(
    cliente: ClienteInventario
  ) {
    if (!cliente.token_inventario) {
      return "";
    }

    const path =
      `/inventario/${cliente.token_inventario}`;

    if (typeof window === "undefined") {
      return path;
    }

    return `${window.location.origin}${path}`;
  }

  async function copiarEnlaceInventario(
    cliente: ClienteInventario
  ) {
    if (!cliente.token_inventario) {
      setMensaje(
        "Este cliente todavía no tiene token de inventario."
      );
      return;
    }

    const url =
      obtenerUrlInventario(
        cliente
      );

    try {
      await navigator.clipboard.writeText(url);

      setMensaje(
        "Enlace del inventario copiado."
      );
    } catch {
      setMensaje(
        "No se pudo copiar automáticamente el enlace."
      );
    }
  }

  function compartirWhatsApp(
    cliente: ClienteInventario
  ) {
    if (!cliente.token_inventario) {
      setMensaje(
        "Este cliente todavía no tiene token de inventario."
      );
      return;
    }

    const url =
      obtenerUrlInventario(
        cliente
      );

    const mensajeWhatsApp = `*VIPACK Envíos 📦*

Hola *${cliente.nombre}* 👋

Ya puedes consultar tu *inventario y las evidencias de tus paquetes* desde el siguiente enlace:

${url}

🔔 *¡Nuevo! Ya puedes activar las notificaciones.*
Al ingresar a tu inventario, activa las notificaciones para recibir avisos de *nuevas recolecciones y actualizaciones de tu inventario*.

🔐 Este enlace es *personal*. Te recomendamos conservarlo para consultar tus evidencias cuando lo necesites.

*VIPACK Envíos*
Tu mercancía, siempre más cerca de ti.`;

    const whatsappUrl =
      `https://wa.me/?text=${encodeURIComponent(
        mensajeWhatsApp
      )}`;

    window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function abrirInventario(
    cliente: ClienteInventario
  ) {
    if (!cliente.token_inventario) {
      setMensaje(
        "Este cliente todavía no tiene token de inventario."
      );
      return;
    }

    window.open(
      `/inventario/${cliente.token_inventario}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="min-h-full overflow-x-hidden bg-slate-100 px-2.5 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8">
      <div
        ref={inicioPanelRef}
        className="mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden"
      >
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
              Operación interna
            </p>

            <h1 className="mt-1 text-3xl font-black text-slate-950">
              Inventarios
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Selecciona un cliente, revisa su carpeta vinculada y sube fotos o videos de evidencia directamente a su inventario.
            </p>
          </div>

          <button
            type="button"
            onClick={sincronizarClientes}
            disabled={sincronizando}
            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <IconoSincronizar
              girando={sincronizando}
            />
            {sincronizando
              ? "Sincronizando..."
              : "Sincronizar clientes"}
          </button>
        </div>

        {mensajeSincronizacion && (
          <div className="mt-4 w-full rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-bold leading-5 text-cyan-900">
            {mensajeSincronizacion}
          </div>
        )}

        <div className="mt-5 grid min-w-0 gap-5 sm:mt-6 sm:gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <section
            className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm ${
              clienteSeleccionado
                ? "hidden xl:block"
                : "block"
            }`}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IconoBuscar />
              </span>

              <input
                value={busqueda}
                onChange={(event) =>
                  setBusqueda(
                    event.target.value
                  )
                }
                placeholder="Buscar cliente..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white"
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-800">
                  Clientes activos
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Verde = vinculada · Amarillo = pendiente
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {clientesFiltrados.length}
              </span>
            </div>

            <div className="mt-3 max-h-[58vh] space-y-2 overflow-y-auto pr-1 xl:max-h-[620px]">
              {cargando && (
                <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
                  Cargando clientes...
                </div>
              )}

              {!cargando && error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              {!cargando &&
                !error &&
                clientesFiltrados.length ===
                  0 && (
                  <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
                    No se encontraron clientes.
                  </div>
                )}

              {clientesFiltrados.map(
                (cliente) => {
                  const activo =
                    clienteSeleccionado
                      ?.id ===
                    cliente.id;

                  return (
                    <button
                      key={cliente.id}
                      type="button"
                      onClick={() => {
                        setClienteSeleccionado(
                          cliente
                        );
                        setArchivos([]);
                        setMensaje("");

                        window.setTimeout(
                          () => {
                            if (
                              window.innerWidth <
                              1280
                            ) {
                              inicioPanelRef.current?.scrollIntoView(
                                {
                                  behavior:
                                    "smooth",
                                  block:
                                    "start",
                                }
                              );
                            }
                          },
                          60
                        );
                      }}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        activo
                          ? "border-cyan-500 bg-cyan-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            activo
                              ? "bg-cyan-600 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <IconoCarpeta />
                        </div>

                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-black text-cyan-700">
                              {numeroCliente(
                                cliente.id_cliente
                              )}
                            </p>

                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                cliente.onedrive_folder_id
                                  ? "bg-emerald-500"
                                  : "bg-amber-400"
                              }`}
                            />
                          </div>

                          <p className="mt-1 truncate text-sm font-black text-slate-900">
                            {
                              cliente.nombre
                            }
                          </p>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {cliente.carpeta_cliente ||
                              "Sin carpeta"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </section>

          <section
            className={`min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5 md:p-6 ${
              clienteSeleccionado
                ? "block"
                : "hidden xl:block"
            }`}
          >
            {!clienteSeleccionado ? (
              <div className="flex min-h-[520px] items-center justify-center">
                <div className="max-w-md text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                    <IconoImagen />
                  </div>

                  <h2 className="mt-5 text-2xl font-black text-slate-900">
                    Selecciona un cliente
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Elige un cliente de la lista para consultar su carpeta y subir evidencias.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setClienteSeleccionado(
                      null
                    );
                    setArchivos([]);
                    setMensaje("");

                    window.setTimeout(
                      () => {
                        inicioPanelRef.current?.scrollIntoView(
                          {
                            behavior:
                              "smooth",
                            block:
                              "start",
                          }
                        );
                      },
                      50
                    );
                  }}
                  className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-[#072c74] transition hover:bg-slate-100 xl:hidden"
                >
                  <span aria-hidden="true">←</span>
                  Cambiar cliente
                </button>

                <div className="flex min-w-0 flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between md:gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-700">
                      Cliente seleccionado
                    </p>

                    <h2 className="mt-1 break-words text-xl font-black leading-tight text-slate-950 sm:text-2xl">
                      {
                        clienteSeleccionado.nombre
                      }
                    </h2>

                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {numeroCliente(
                        clienteSeleccionado.id_cliente
                      )}
                    </p>
                  </div>

                  <div className="grid w-full shrink-0 grid-cols-1 gap-2 sm:grid-cols-3 md:w-auto">
                    <button
                      type="button"
                      onClick={() =>
                        abrirInventario(
                          clienteSeleccionado
                        )
                      }
                      className="rounded-xl border border-[#072c74] px-3 py-2.5 text-sm font-black text-[#072c74] transition hover:bg-[#072c74] hover:text-white"
                    >
                      Ver inventario
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        copiarEnlaceInventario(
                          clienteSeleccionado
                        )
                      }
                      disabled={
                        !clienteSeleccionado.token_inventario
                      }
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-black text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <IconoCopiar />
                      Copiar enlace
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        compartirWhatsApp(
                          clienteSeleccionado
                        )
                      }
                      disabled={
                        !clienteSeleccionado.token_inventario
                      }
                      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <IconoWhatsApp />
                      WhatsApp
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid min-w-0 grid-cols-1 gap-2 min-[430px]:grid-cols-3 sm:gap-3">
                  <div className="min-w-0 overflow-hidden rounded-2xl bg-slate-50 p-3 sm:p-4">
                    <p className="text-[10px] font-bold leading-tight text-slate-500 sm:text-xs">
                      Carpeta OneDrive
                    </p>
                    <p
                      className={`mt-2 break-words text-sm font-black leading-tight ${
                        clienteSeleccionado.onedrive_folder_id
                          ? "text-emerald-600"
                          : "text-amber-600"
                      }`}
                    >
                      {clienteSeleccionado.onedrive_folder_id
                        ? "Vinculada"
                        : "Sin vincular"}
                    </p>
                  </div>

                  <div className="min-w-0 overflow-hidden rounded-2xl bg-slate-50 p-3 sm:p-4">
                    <p className="text-[10px] font-bold leading-tight text-slate-500 sm:text-xs">
                      Archivos
                    </p>
                    <p className="mt-2 text-2xl font-black text-[#072c74]">
                      {
                        clienteSeleccionado.total_archivos ??
                        "—"
                      }
                    </p>
                  </div>

                  <div className="min-w-0 overflow-hidden rounded-2xl bg-slate-50 p-3 sm:p-4">
                    <p className="text-[10px] font-bold leading-tight text-slate-500 sm:text-xs">
                      Acceso cliente
                    </p>
                    <p
                      className={`mt-2 break-words text-sm font-black leading-tight ${
                        clienteSeleccionado.token_inventario
                          ? "text-emerald-600"
                          : "text-amber-600"
                      }`}
                    >
                      {clienteSeleccionado.token_inventario
                        ? "Disponible"
                        : "Sin token"}
                    </p>
                  </div>
                </div>

                <div
                  onDragOver={(event) =>
                    event.preventDefault()
                  }
                  onDrop={manejarDrop}
                  className="mt-5 w-full min-w-0 max-w-full overflow-hidden rounded-3xl border-2 border-dashed border-cyan-200 bg-cyan-50/40 p-3.5 text-center transition hover:border-cyan-400 sm:mt-6 sm:p-6"
                >
                  <input
                    ref={inputArchivos}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={
                      manejarInput
                    }
                    className="hidden"
                  />

                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg">
                    <IconoSubir />
                  </div>

                  <h3 className="mt-4 text-lg font-black text-slate-950">
                    Subir evidencia
                  </h3>

                  <p className="mx-auto mt-1 max-w-full break-words px-1 text-sm leading-5 text-slate-500 sm:max-w-md">
                    Arrastra fotos o videos aquí, o selecciónalos desde tu computadora.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      inputArchivos.current?.click()
                    }
                    className="mt-4 w-full max-w-full rounded-xl bg-[#072c74] px-4 py-3 text-sm font-black text-white shadow-md transition hover:bg-[#0a3b8f] sm:w-auto sm:px-5"
                  >
                    Seleccionar archivos
                  </button>
                </div>

                {archivos.length >
                  0 && (
                  <div className="mt-6 min-w-0">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <h3 className="font-black text-slate-900">
                        Archivos seleccionados
                      </h3>

                      <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">
                        {archivos.length}
                      </span>
                    </div>

                    <div className="mt-3 min-w-0 space-y-2">
                      {archivos.map(
                        (item) => (
                          <div
                            key={
                              item.id
                            }
                            className="flex w-full min-w-0 max-w-full items-start gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:items-center sm:gap-3"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm">
                              <IconoImagen />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="block max-w-full truncate text-sm font-black leading-5 text-slate-900">
                                {
                                  item.archivo.name
                                }
                              </p>

                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                <span>
                                  {formatearTamaño(
                                    item.archivo.size
                                  )}
                                </span>

                                {item.estado ===
                                  "completado" && (
                                  <span className="font-black text-emerald-600">
                                    Completado
                                  </span>
                                )}

                                {item.estado ===
                                  "error" && (
                                  <span className="font-black text-red-600">
                                    Error
                                  </span>
                                )}
                              </div>

                              {(item.estado ===
                                "subiendo" ||
                                item.estado ===
                                  "completado") && (
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all"
                                    style={{
                                      width: `${item.progreso}%`,
                                    }}
                                  />
                                </div>
                              )}

                              {item.error && (
                                <p className="mt-2 break-words text-xs font-semibold leading-5 text-red-600">
                                  {item.error}
                                </p>
                              )}
                            </div>

                            <div className="hidden shrink-0 pt-0.5 text-xs font-black text-slate-500 min-[390px]:block">
                              {item.estado ===
                              "subiendo"
                                ? `${item.progreso}%`
                                : ""}
                            </div>

                            <button
                              type="button"
                              disabled={subiendo}
                              onClick={() =>
                                quitarArchivo(
                                  item.id
                                )
                              }
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Quitar archivo"
                            >
                              <IconoCerrar />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {mensaje && (
                  <div className="mt-5 w-full max-w-full break-words rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold leading-5 text-slate-700 sm:p-4">
                    {mensaje}
                  </div>
                )}

                <div className="mt-6 flex w-full min-w-0 justify-stretch sm:justify-end">
                  <button
                    type="button"
                    disabled={
                      subiendo ||
                      archivos.length ===
                        0 ||
                      !clienteSeleccionado.onedrive_folder_id
                    }
                    onClick={
                      subirEvidencias
                    }
                    className="w-full max-w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-6"
                  >
                    {subiendo
                      ? "Subiendo a OneDrive..."
                      : "Subir evidencias"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}