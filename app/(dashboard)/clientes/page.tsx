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

  telefono_whatsapp: string | null;

  token_inventario: string | null;

  activo: boolean;

};

type ClientePDF = {
  id: string;
  nombre: string;
  telefono: string;
  carpeta: string;
};

type RespuestaPDF = {
  success: boolean;
  clientes?: ClientePDF[];
  incidencias?: { carpeta: string; motivo: string }[];
  error?: string;
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

  const [pestana, setPestana] = useState<"solicitudes" | "registrados" | "pdf">("registrados");

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesPDF, setClientesPDF] = useState<ClientePDF[]>([]);
  const [incidenciasPDF, setIncidenciasPDF] = useState(0);

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

      } else if (pestana === "pdf") {
        const res = await fetch("/api/admin/clientes-pdf", { cache: "no-store" });
        const data: RespuestaPDF = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "No se pudo consultar las carpetas de OneDrive.");
        }
        const lista = Array.isArray(data.clientes) ? data.clientes : [];
        setClientesPDF([...lista].sort((a, b) => Number(a.id) - Number(b.id)));
        setIncidenciasPDF(data.incidencias?.length ?? 0);
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

    const clientesParaMaria = clientesPDF;

  function generarPdfMaria() {

    if (cargando || clientesParaMaria.length === 0) return;

    // Abrir desde el clic para evitar bloqueos de ventanas emergentes.

    const ventana = window.open("", "_blank");

    if (!ventana) {

      setError("Permite las ventanas emergentes para imprimir el listado.");

      return;

    }

    const escapar = (valor: string) => valor.replace(/[&<>"']/g, (c) =>

      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c)

    );

    const filas = clientesParaMaria.map((c) => `

      <tr><td>${escapar(c.id)}</td>

      <td>${escapar(c.nombre)}</td>

      <td>${escapar(c.telefono?.trim() || "—")}</td></tr>`).join("");

    const fecha = new Date().toLocaleDateString("es-MX", {

      year: "numeric", month: "long", day: "numeric"

    });

    ventana.document.open();

    ventana.document.write(`<!doctype html><html lang="es"><head>

      <meta charset="utf-8"><title>VIPACK - Clientes activos con carpeta</title>

      <style>

        @page { size: letter landscape; margin: 13mm; }

        * { box-sizing: border-box; }

        body { font-family: Arial, sans-serif; color: #14213d; margin: 0; }

        header { border-bottom: 3px solid #072c74; padding-bottom: 12px; margin-bottom: 16px; }

        .marca { font-size: 22px; font-weight: 900; color: #072c74; letter-spacing: 1px; }

        h1 { font-size: 17px; margin: 7px 0; }

        .meta { font-size: 11px; color: #475569; }

        table { border-collapse: collapse; width: 100%; font-size: 11px; }

        th { background: #072c74; color: white; text-align: left; padding: 9px; }

        td { padding: 7px 9px; border-bottom: 1px solid #dbe3ef; overflow-wrap: anywhere; }

        tr:nth-child(even) td { background: #f2f7fc; }

        thead { display: table-header-group; }

        tr { break-inside: avoid; }

        th:first-child { width: 17%; } th:last-child { width: 27%; }

        footer { margin-top: 16px; font-weight: bold; font-size: 11px; }

      </style></head><body>

      <header><div class="marca">VIPACK ENVÍOS</div>

      <h1>Listado de clientes activos con carpeta</h1>

      <div class="meta">Fecha: ${escapar(fecha)} · Total: ${clientesParaMaria.length} clientes</div></header>

      <table><thead><tr><th>ID</th><th>Nombre</th><th>Teléfono</th></tr></thead>

      <tbody>${filas}</tbody></table>

      <footer>Total de clientes: ${clientesParaMaria.length}</footer>

      <script>window.onload = () => { window.focus(); window.print(); };<\/script>

      </body></html>`);

    ventana.document.close();

  }

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

  const [paginaPdf, setPaginaPdf] = useState(1);

  const pdfFiltrados = useMemo(() => clientesParaMaria.filter(c =>

    `${c.nombre} ${c.id} ${c.telefono ?? ""}`

      .toLocaleLowerCase("es").includes(busqueda.trim().toLocaleLowerCase("es"))

  ), [clientesParaMaria, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(pdfFiltrados.length / 15));

  const paginaActual = Math.min(paginaPdf, totalPaginas);

  const pdfPagina = pdfFiltrados.slice((paginaActual - 1) * 15, paginaActual * 15);

  return (

    <div className="min-h-full bg-[#f5f7fc] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">

      <div className="mx-auto w-full max-w-7xl space-y-6">

        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">

          <div className="flex items-center gap-4">

            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#152d84] to-[#6b42d9] text-2xl text-white shadow-md">👥</div>

            <div>

              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#6b42d9]">Centro de operaciones · VIPACK</p>

              <h1 className="mt-1 text-3xl font-black tracking-tight text-[#111c4b]">Clientes</h1>

              <p className="mt-1 text-sm text-slate-500">Registros, solicitudes y listados de tu operación.</p>

            </div>

          </div>

          <div className="flex flex-wrap gap-2">

            <Link href="/registro-cliente" className="rounded-xl bg-[#0b9cbf] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#087f9d]">+ Registrar cliente</Link>

            <button type="button" onClick={() => void cargar()} disabled={cargando || aprobando || cambiandoEstado} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#172d77] hover:bg-slate-50 disabled:opacity-50">{cargando ? "Actualizando..." : "↻ Actualizar"}</button>

          </div>

        </header>

        <nav aria-label="Secciones de clientes" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">

          {([ ["registrados", "👥 Clientes registrados"], ["solicitudes", "📋 Solicitudes"], ["pdf", "🖨️ PDF para María"] ] as const).map(([clave, texto]) => (

            <button key={clave} type="button" onClick={() => { setPestana(clave); setPaginaPdf(1); }} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${pestana === clave ? "bg-gradient-to-r from-[#172d87] to-[#6840d4] text-white shadow-md" : "text-slate-600 hover:bg-slate-100"}`}>{texto}</button>

          ))}

        </nav>

        {mensaje && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{mensaje}</div>}

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}

        {pestana === "pdf" ? (

          <section className="space-y-5">

            <div className="rounded-3xl bg-gradient-to-r from-[#172d87] to-[#6840d4] p-6 text-white shadow-md sm:p-7">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <p className="text-xs font-bold uppercase tracking-widest text-indigo-100">Control interno · VIPACK</p>

                  <h2 className="mt-2 text-2xl font-black">Listado para María</h2>

                  <p className="mt-1 text-sm text-indigo-100">Solo clientes activos con carpeta confirmada en OneDrive · Orden por ID</p>

                </div>

                <div className="rounded-2xl bg-white/15 px-6 py-4 text-center backdrop-blur-sm">

                  <p className="text-3xl font-black">{clientesParaMaria.length}</p>

                  <p className="text-xs font-semibold">Clientes con carpeta</p>

                </div>

              </div>

            </div>

            {incidenciasPDF > 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              {incidenciasPDF} carpeta(s) requieren revisión y no se incluyeron en el listado.
            </p>
          )}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">

                <div className="flex-1">

                  <label htmlFor="buscar-pdf" className="sr-only">Buscar clientes</label>

                  <input id="buscar-pdf" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPaginaPdf(1); }} placeholder="Buscar por nombre, ID o teléfono..." className="w-full max-w-xl rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#6840d4]" />

                </div>

                <button type="button" onClick={generarPdfMaria} disabled={cargando || clientesParaMaria.length === 0 || Boolean(error)} className="rounded-xl bg-[#5531c6] px-6 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-[#4526a8] disabled:opacity-50">🖨️ Imprimir / Guardar PDF</button>

              </div>

              <div className="overflow-x-auto">

                <table className="w-full min-w-[600px] text-left text-sm">

                  <thead className="bg-[#f1f2fb] text-xs font-black uppercase tracking-wide text-[#243270]"><tr><th className="px-5 py-4">N.º</th><th className="px-5 py-4">ID</th><th className="px-5 py-4">Nombre del cliente</th><th className="px-5 py-4">Teléfono / WhatsApp</th></tr></thead>

                  <tbody className="divide-y divide-slate-100">

                    {!cargando && pdfPagina.map((c, i) => <tr key={c.carpeta} className="hover:bg-indigo-50/50"><td className="px-5 py-3 text-slate-500">{(paginaActual - 1) * 15 + i + 1}</td><td className="px-5 py-3 font-extrabold text-[#5531c6]">{c.id}</td><td className="px-5 py-3 font-semibold text-slate-800">{c.nombre}</td><td className="px-5 py-3 text-slate-600">{c.telefono?.trim() || "—"}</td></tr>)}

                  </tbody>

                </table>

                {cargando && <p className="p-6 text-center text-sm text-slate-500">Cargando clientes...</p>}

                {!cargando && !error && pdfFiltrados.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No se encontraron clientes activos con carpeta confirmada en OneDrive.</p>}

              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500">

                <span>Mostrando {pdfFiltrados.length ? (paginaActual - 1) * 15 + 1 : 0}–{Math.min(paginaActual * 15, pdfFiltrados.length)} de {pdfFiltrados.length}</span>

                <div className="flex items-center gap-2"><button type="button" onClick={() => setPaginaPdf(p => Math.max(1, p - 1))} disabled={paginaActual === 1} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><span className="font-bold text-[#5531c6]">{paginaActual} / {totalPaginas}</span><button type="button" onClick={() => setPaginaPdf(p => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas} className="rounded-lg border px-3 py-2 disabled:opacity-40">Siguiente</button></div>

              </div>

            </div>

          </section>

        ) : (

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">

            <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

              <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder={pestana === "registrados" ? "Buscar por nombre o número..." : "Buscar por nombre, teléfono o folio..."} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#6840d4]" />

              {pestana === "registrados" ? <div className="mt-4 grid grid-cols-3 gap-2">{(["activos", "inactivos", "todos"] as const).map(f => <button key={f} type="button" onClick={() => { setFiltroClientes(f); setClienteSeleccionado(null); }} disabled={cambiandoEstado} className={`rounded-xl px-2 py-3 text-sm font-bold capitalize ${filtroClientes === f ? "bg-[#172d87] text-white" : "bg-slate-100 text-slate-600 hover:bg-indigo-50"}`}>{f}</button>)}</div> : <select value={estado} onChange={e => setEstado(e.target.value)} disabled={aprobando} className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold"><option value="pendiente">Pendientes</option><option value="procesando">Procesando</option><option value="aprobado">Aprobados</option><option value="rechazado">Rechazados</option><option value="archivado">Archivados</option></select>}

              <div className="mt-5 flex items-center justify-between"><h2 className="font-black text-[#111c4b]">{pestana === "registrados" ? "Clientes registrados" : "Solicitudes"}</h2><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-[#5531c6]">{pestana === "registrados" ? clientesFiltrados.length : solicitudesFiltradas.length}</span></div>

              <div className="mt-3 max-h-[640px] space-y-2 overflow-y-auto pr-1">

                {cargando && <p className="p-5 text-center text-sm text-slate-500">Cargando...</p>}

                {!cargando && !error && (pestana === "registrados" ? clientesFiltrados.length === 0 : solicitudesFiltradas.length === 0) && <p className="p-5 text-center text-sm text-slate-500">No hay resultados.</p>}

                {!cargando && pestana === "registrados" && clientesFiltrados.map(c => <button key={c.id} type="button" onClick={() => setClienteSeleccionado(c)} className={`w-full rounded-xl border px-4 py-3 text-left transition hover:border-indigo-300 ${clienteSeleccionado?.id === c.id ? "border-[#6840d4] bg-indigo-50" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-extrabold text-[#111c4b]">#{numero(c.id_cliente)} · {c.nombre}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${c.activo ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{c.activo ? "Activo" : "Inactivo"}</span></div><p className="mt-1 text-xs text-slate-500">{c.telefono_whatsapp?.trim() || "Sin teléfono"}</p></button>)}

                {!cargando && pestana === "solicitudes" && solicitudesFiltradas.map(s => <button key={s.id} type="button" onClick={() => setSeleccionada(s)} className={`w-full rounded-xl border px-4 py-3 text-left hover:border-indigo-300 ${seleccionada?.id === s.id ? "border-[#6840d4] bg-indigo-50" : "border-slate-200"}`}><p className="text-sm font-extrabold text-[#111c4b]">{s.nombre}</p><p className="mt-1 text-xs font-bold text-[#5531c6]">{s.folio} · {s.telefono}</p></button>)}

              </div>

            </section>

            <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

              {pestana === "registrados" ? (!clienteSeleccionado ? <Vacio texto="Selecciona un cliente de la lista para ver su información." /> : <>

                <p className="text-xs font-black uppercase tracking-widest text-[#6840d4]">Cliente registrado</p><h2 className="mt-2 text-2xl font-black text-[#111c4b]">{clienteSeleccionado.nombre}</h2><p className="mt-1 text-sm font-bold text-slate-500">#{numero(clienteSeleccionado.id_cliente)}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2"><Dato titulo="Estado" valor={clienteSeleccionado.activo ? "Activo" : "Inactivo"}/><Dato titulo="Carpeta de OneDrive" valor={clienteSeleccionado.carpeta_cliente || "—"}/><div className="sm:col-span-2"><Dato titulo="Teléfono / WhatsApp" valor={clienteSeleccionado.telefono_whatsapp || "—"}/></div></div>

                {clienteSeleccionado.activo && clienteSeleccionado.token_inventario ? <Link href={`/inventario/${encodeURIComponent(clienteSeleccionado.token_inventario)}`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex rounded-xl bg-[#0b9cbf] px-5 py-3 text-sm font-bold text-white hover:bg-[#087f9d]">Abrir inventario privado ↗</Link> : <p className="mt-5 text-sm text-amber-700">{clienteSeleccionado.activo ? "Este cliente no tiene enlace de inventario disponible." : "El acceso al inventario está suspendido mientras el cliente permanezca inactivo."}</p>}

                <div className="mt-6 border-t border-slate-100 pt-5"><p className="mb-3 text-xs text-slate-500">Cambiar el estado no elimina el registro ni la carpeta de OneDrive.</p><button type="button" onClick={() => void cambiarEstadoCliente()} disabled={cambiandoEstado || cargando} className={`w-full rounded-xl px-5 py-4 text-sm font-black text-white disabled:opacity-50 ${clienteSeleccionado.activo ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>{cambiandoEstado ? "Guardando cambios..." : clienteSeleccionado.activo ? "Dar de baja cliente" : "Reactivar cliente"}</button></div>

              </>) : (!seleccionada ? <Vacio texto="Selecciona una solicitud para consultar sus datos." /> : <>

                <p className="text-xs font-black uppercase tracking-widest text-[#6840d4]">Solicitud de cliente</p><h2 className="mt-2 text-2xl font-black text-[#111c4b]">{seleccionada.nombre}</h2><p className="mt-1 text-sm font-bold text-slate-500">{seleccionada.folio}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2"><Dato titulo="Teléfono / WhatsApp" valor={seleccionada.telefono}/><Dato titulo="Fecha de registro" valor={seleccionada.created_at ? new Date(seleccionada.created_at).toLocaleString("es-MX") : "—"}/><div className="sm:col-span-2"><Dato titulo="Dirección" valor={seleccionada.direccion}/></div><div className="sm:col-span-2"><Dato titulo="Referencia del domicilio" valor={seleccionada.referencia_domicilio}/></div></div>

                {seleccionada.estado === "pendiente" && <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-black text-amber-950">Pendiente de aprobación</p><p className="mt-2 text-sm text-amber-800">Al aprobar, se reservará un número, se actualizará el Excel y se creará la carpeta de OneDrive.</p><button type="button" onClick={() => void aprobar()} disabled={aprobando} className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-4 font-black text-white disabled:opacity-50">{aprobando ? "Creando cliente..." : "Crear cliente"}</button></div>}

                {seleccionada.estado === "aprobado" && <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-800"><p className="font-black">Cliente aprobado</p><p>ID asignado: {seleccionada.id_cliente_asignado ?? "—"}</p><p>Carpeta: {seleccionada.carpeta_cliente || "—"}</p></div>}

                {seleccionada.estado === "procesando" && <div className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm text-amber-800">Solicitud en proceso. No intentes aprobarla de nuevo hasta revisar su estado.</div>}

              </>)}

            </section>

          </div>

        )}

      </div>

    </div>

  );

}

function Vacio({ texto }: { texto: string }) {

  return <div className="flex min-h-[220px] items-center justify-center text-center"><div><div className="text-3xl">👤</div><h2 className="mt-3 text-lg font-black text-[#111c4b]">Selecciona un registro</h2><p className="mt-2 text-sm text-slate-500">{texto}</p></div></div>;

}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {

  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p><p className="mt-2 break-words text-sm font-bold text-slate-900">{valor || "—"}</p></div>;

}
