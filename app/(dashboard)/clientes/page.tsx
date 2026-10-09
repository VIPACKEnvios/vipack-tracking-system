"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Solicitud = {
  id: number;
  folio: string;
  nombre: string;
  telefono: string;
  direccion: string;
  referencia_domicilio: string;
  estado: string;
  id_cliente_asignado: number | null;
  carpeta_cliente: string | null;
  created_at: string;
};

type Cliente = {
  id: number;
  id_cliente: number;
  nombre: string;
  carpeta_cliente: string | null;
  token_inventario: string | null;
  activo: boolean;
};

type RespuestaSolicitudes = {
  success: boolean;
  solicitudes?: Solicitud[];
  error?: string;
};
type RespuestaClientes = {
  success: boolean;
  clientes?: Cliente[];
  error?: string;
};
type RespuestaAprobar = {
  success: boolean;
  error?: string;
  detalle?: string;
  requiere_revision?: boolean;
  cliente?: { id_cliente: number; carpeta_cliente: string };
};
type RespuestaEstado = {
  success: boolean;
  error?: string;
  mensaje?: string;
  cliente?: Cliente;
};
type FiltroClientes = "activos" | "inactivos" | "todos";

const numero = (id: number) => String(id).padStart(5, "0");

export default function ClientesPage() {
  const [pestana, setPestana] = useState<"solicitudes" | "registrados">("registrados");
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [estado, setEstado] = useState("pendiente");
  const [filtroClientes, setFiltroClientes] = useState<FiltroClientes>("activos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionada, setSeleccionada] = useState<Solicitud | null>(null);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [cargando, setCargando] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      if (pestana === "solicitudes") {
        const res = await fetch(
          `/api/clientes/solicitudes?estado=${encodeURIComponent(estado)}`,
          { cache: "no-store" }
        );
        const data: RespuestaSolicitudes = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "No se pudieron consultar las solicitudes.");
        }
        const lista = Array.isArray(data.solicitudes) ? data.solicitudes : [];
        setSolicitudes(lista);
        setSeleccionada((prev) => lista.find((x) => x.id === prev?.id) || null);
      } else {
        const res = await fetch(
          `/api/inventarios/clientes?estado=${encodeURIComponent(filtroClientes)}`,
          { cache: "no-store" }
        );
        const data: RespuestaClientes = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "No se pudieron consultar los clientes.");
        }
        const lista = Array.isArray(data.clientes) ? data.clientes : [];
        setClientes(lista);
        setClienteSeleccionado((prev) =>
          lista.find((x) => x.id === prev?.id) || null
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error al consultar la información.");
    } finally {
      setCargando(false);
    }
  }, [pestana, estado, filtroClientes]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    setBusqueda("");
    setMensaje("");
    setError("");
  }, [pestana]);

  const solicitudesFiltradas = useMemo(
    () => solicitudes.filter((s) =>
      `${s.nombre} ${s.telefono} ${s.folio} ${s.id_cliente_asignado ?? ""}`
        .toLowerCase()
        .includes(busqueda.trim().toLowerCase())
    ),
    [solicitudes, busqueda]
  );

  const clientesFiltrados = useMemo(
    () => clientes.filter((c) =>
      `${c.nombre} ${c.id_cliente} ${numero(c.id_cliente)} ${c.carpeta_cliente ?? ""}`
        .toLowerCase()
        .includes(busqueda.trim().toLowerCase())
    ),
    [clientes, busqueda]
  );

  async function aprobar() {
    if (!seleccionada || aprobando || seleccionada.estado !== "pendiente") return;
    if (!window.confirm(
      `¿Crear al cliente "${seleccionada.nombre}"? Se reservará un número, se actualizará el Excel y se creará su carpeta de OneDrive.`
    )) return;

    setAprobando(true);
    setError("");
    setMensaje("");
    try {
      const res = await fetch("/api/clientes/aprobar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitud_id: seleccionada.id }),
      });
      const data: RespuestaAprobar = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          `${data.error || "No se pudo aprobar."}${data.detalle ? ` — ${data.detalle}` : ""}${data.requiere_revision ? " Requiere revisión manual antes de reintentar." : ""}`
        );
      }
      setMensaje(data.cliente
        ? `Cliente #${numero(data.cliente.id_cliente)} creado correctamente.`
        : "Cliente creado correctamente."
      );
      setSeleccionada(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el cliente.");
    } finally {
      setAprobando(false);
    }
  }

  async function cambiarEstadoCliente() {
    const cliente = clienteSeleccionado;
    if (!cliente || cambiandoEstado || cargando) return;

    const nuevoEstado = !cliente.activo;
    const pregunta = nuevoEstado
      ? `¿Reactivar a ${cliente.nombre} (#${numero(cliente.id_cliente)})? Volverá a tener acceso a su inventario privado.`
      : `¿Dar de baja a ${cliente.nombre} (#${numero(cliente.id_cliente)})? Dejará de aparecer entre los clientes activos. No se eliminarán su historial ni su carpeta de OneDrive.`;

    if (!window.confirm(pregunta)) return;

    setCambiandoEstado(true);
    setError("");
    setMensaje("");
    try {
      const res = await fetch("/api/inventarios/clientes/estado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cliente.id, activo: nuevoEstado }),
      });
      const data: RespuestaEstado = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo cambiar el estado del cliente.");
      }
      setMensaje(data.mensaje || (nuevoEstado
        ? "Cliente reactivado correctamente."
        : "Cliente dado de baja correctamente."
      ));
      setClienteSeleccionado(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado.");
    } finally {
      setCambiandoEstado(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-100 px-3 py-5 sm:px-5 md:px-7">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Centro de Operaciones</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">Clientes</h1>
            <p className="mt-2 text-sm text-slate-600">Administra las solicitudes y consulta los inventarios registrados en VIPACK.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/registro-cliente" className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-md hover:bg-cyan-700">+ Registrar cliente</Link>
            <button type="button" onClick={() => void cargar()} disabled={cargando || aprobando || cambiandoEstado} className="rounded-xl bg-[#072c74] px-5 py-3 text-sm font-black text-white shadow-md disabled:opacity-50">{cargando ? "Actualizando..." : "Actualizar"}</button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          <button type="button" onClick={() => setPestana("registrados")} className={`rounded-xl px-5 py-3 text-sm font-black ${pestana === "registrados" ? "bg-[#072c74] text-white" : "bg-white text-slate-700"}`}>Clientes registrados</button>
          <button type="button" onClick={() => setPestana("solicitudes")} className={`rounded-xl px-5 py-3 text-sm font-black ${pestana === "solicitudes" ? "bg-[#072c74] text-white" : "bg-white text-slate-700"}`}>Solicitudes</button>
        </div>

        {mensaje && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{mensaje}</div>}
        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>}

        <div className="mt-5 grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={pestana === "registrados" ? "Buscar por nombre o número..." : "Buscar por nombre, teléfono o folio..."} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none focus:border-cyan-500" />

            {pestana === "registrados" ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["activos", "inactivos", "todos"] as const).map((filtro) => (
                  <button key={filtro} type="button" onClick={() => { setFiltroClientes(filtro); setClienteSeleccionado(null); }} disabled={cambiandoEstado} className={`rounded-xl px-2 py-3 text-xs font-black sm:text-sm ${filtroClientes === filtro ? "bg-[#072c74] text-white" : "bg-slate-100 text-slate-700 hover:bg-cyan-50"} disabled:opacity-50`}>
                    {filtro === "activos" ? "Activos" : filtro === "inactivos" ? "Inactivos" : "Todos"}
                  </button>
                ))}
              </div>
            ) : (
              <select value={estado} onChange={(e) => setEstado(e.target.value)} disabled={aprobando} className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800">
                <option value="pendiente">Pendientes</option>
                <option value="procesando">Procesando</option>
                <option value="aprobado">Aprobados</option>
                <option value="rechazado">Rechazados</option>
                <option value="archivado">Archivados</option>
              </select>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm font-black text-slate-800">{pestana === "registrados" ? (filtroClientes === "activos" ? "Clientes activos" : filtroClientes === "inactivos" ? "Clientes inactivos" : "Todos los clientes") : "Solicitudes"}</p>
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">{pestana === "registrados" ? clientesFiltrados.length : solicitudesFiltradas.length}</span>
            </div>
            <div className="mt-3 max-h-[650px] space-y-2 overflow-y-auto pr-1">
              {cargando && <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">Cargando...</p>}
              {!cargando && !error && (pestana === "registrados" ? clientesFiltrados.length === 0 : solicitudesFiltradas.length === 0) && <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">No hay resultados.</p>}
              {!cargando && pestana === "registrados" && clientesFiltrados.map((c) => (
                <button key={c.id} type="button" onClick={() => setClienteSeleccionado(c)} className={`w-full rounded-2xl border p-4 text-left hover:border-cyan-300 ${clienteSeleccionado?.id === c.id ? "border-cyan-500 bg-cyan-50" : "border-slate-200"}`}>
                  <p className="text-sm font-black text-slate-950">#{numero(c.id_cliente)} · {c.nombre}</p>
                  <p className={`mt-1 text-xs font-bold ${c.activo ? "text-emerald-700" : "text-rose-700"}`}>{c.activo ? "Activo" : "Inactivo"}</p>
                </button>
              ))}
              {!cargando && pestana === "solicitudes" && solicitudesFiltradas.map((s) => (
                <button key={s.id} type="button" onClick={() => setSeleccionada(s)} className={`w-full rounded-2xl border p-4 text-left hover:border-cyan-300 ${seleccionada?.id === s.id ? "border-cyan-500 bg-cyan-50" : "border-slate-200"}`}>
                  <p className="text-sm font-black text-slate-950">{s.nombre}</p>
                  <p className="mt-1 text-xs font-bold text-cyan-700">{s.folio}</p>
                  <p className="mt-1 text-xs text-slate-500">{s.telefono}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {pestana === "registrados" ? (
              !clienteSeleccionado ? <Vacio texto="Selecciona un cliente para consultar su información." /> : (
                <>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Cliente registrado</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">{clienteSeleccionado.nombre}</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">#{numero(clienteSeleccionado.id_cliente)}</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <Dato titulo="Estado" valor={clienteSeleccionado.activo ? "Activo" : "Inactivo"} />
                    <Dato titulo="Carpeta de OneDrive" valor={clienteSeleccionado.carpeta_cliente || "—"} />
                  </div>
                  {clienteSeleccionado.activo && clienteSeleccionado.token_inventario ? (
                    <Link href={`/inventario/${encodeURIComponent(clienteSeleccionado.token_inventario)}`} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white hover:bg-cyan-700">Abrir inventario privado</Link>
                  ) : (
                    <p className="mt-5 text-sm text-amber-700">{clienteSeleccionado.activo ? "Este cliente no tiene enlace de inventario disponible." : "El acceso al inventario está suspendido mientras el cliente permanezca inactivo."}</p>
                  )}
                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <p className="mb-3 text-xs text-slate-500">Cambiar el estado no elimina el registro ni su carpeta de OneDrive.</p>
                    <button type="button" onClick={() => void cambiarEstadoCliente()} disabled={cambiandoEstado || cargando} className={`w-full rounded-xl px-5 py-4 text-sm font-black text-white disabled:opacity-50 ${clienteSeleccionado.activo ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                      {cambiandoEstado ? "Guardando cambios..." : clienteSeleccionado.activo ? "Dar de baja cliente" : "Reactivar cliente"}
                    </button>
                  </div>
                </>
              )
            ) : (
              !seleccionada ? <Vacio texto="Selecciona una solicitud para consultar sus datos." /> : (
                <>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Solicitud de cliente</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">{seleccionada.nombre}</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">{seleccionada.folio}</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <Dato titulo="Teléfono / WhatsApp" valor={seleccionada.telefono} />
                    <Dato titulo="Fecha de registro" valor={seleccionada.created_at ? new Date(seleccionada.created_at).toLocaleString("es-MX") : "—"} />
                    <div className="md:col-span-2"><Dato titulo="Dirección" valor={seleccionada.direccion} /></div>
                    <div className="md:col-span-2"><Dato titulo="Referencia del domicilio" valor={seleccionada.referencia_domicilio} /></div>
                  </div>
                  {seleccionada.estado === "pendiente" && (
                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <p className="font-black text-amber-950">Pendiente de aprobación</p>
                      <p className="mt-2 text-sm text-amber-800">Al aprobar, se reservará un número y se registrará al cliente en los sistemas de VIPACK.</p>
                      <button type="button" onClick={() => void aprobar()} disabled={aprobando} className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-4 font-black text-white disabled:opacity-50">{aprobando ? "Creando cliente..." : "Crear cliente"}</button>
                    </div>
                  )}
                  {seleccionada.estado === "aprobado" && <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-800"><p className="font-black">Cliente aprobado</p><p>ID asignado: {seleccionada.id_cliente_asignado ?? "—"}</p><p>Carpeta: {seleccionada.carpeta_cliente || "—"}</p></div>}
                  {seleccionada.estado === "procesando" && <div className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm text-amber-800">Solicitud en proceso. No intentes aprobarla de nuevo hasta revisar su estado.</div>}
                </>
              )
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <div className="flex min-h-[450px] items-center justify-center text-center"><div><div className="text-4xl">👤</div><h2 className="mt-4 text-xl font-black text-slate-900">Selecciona un registro</h2><p className="mt-2 text-sm text-slate-500">{texto}</p></div></div>;
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p><p className="mt-2 break-words text-sm font-bold text-slate-900">{valor || "—"}</p></div>;
}
