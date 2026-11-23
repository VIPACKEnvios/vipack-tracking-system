"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Bazar = { id: string; estado: string | null };
type EstadoConteo = { estado: string; clientes: number };
type DireccionRemision = {
  id_cliente: number;
  estado: string | null;
  codigo_postal: string | null;
};
type PaqueteUSAAdmin = {
  id: string;
  cliente: string;
  tokenCliente: string;
  rastreo: string;
  tienda: string;
  fechaRegistro: string;
  estatus: string;
  fechaRecibido: string;
  fechaCompra: string;
};
type ResumenPaquetesUSA = {
  total: number;
  registrados: number;
  recibidos: number;
};

const ESTADOS_MEXICO = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche",
  "Chiapas", "Chihuahua", "Ciudad de México", "Coahuila", "Colima",
  "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo",
  "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca",
  "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa",
  "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán",
  "Zacatecas",
] as const;

const ALIAS_ESTADOS: Record<string, string[]> = {
  "Aguascalientes": ["AGUASCALIENTES", "AGS"],
  "Baja California": ["BAJA CALIFORNIA", "B C", "BC"],
  "Baja California Sur": ["BAJA CALIFORNIA SUR", "B C S", "BCS"],
  "Campeche": ["CAMPECHE", "CAMP"],
  "Chiapas": ["CHIAPAS", "CHIS"],
  "Chihuahua": ["CHIHUAHUA", "CHIH"],
  "Ciudad de México": ["CIUDAD DE MEXICO", "CDMX", "DISTRITO FEDERAL", "DF"],
  "Coahuila": ["COAHUILA", "COAH", "COAHUILA DE ZARAGOZA"],
  "Colima": ["COLIMA", "COL"],
  "Durango": ["DURANGO", "DGO"],
  "Estado de México": ["ESTADO DE MEXICO", "EDO DE MEXICO", "EDO MEX", "EDOMEX", "MEXICO MEX"],
  "Guanajuato": ["GUANAJUATO", "GTO"],
  "Guerrero": ["GUERRERO", "GRO"],
  "Hidalgo": ["HIDALGO", "HGO"],
  "Jalisco": ["JALISCO", "JAL"],
  "Michoacán": ["MICHOACAN", "MICH", "MICHOACAN DE OCAMPO"],
  "Morelos": ["MORELOS", "MOR"],
  "Nayarit": ["NAYARIT", "NAY"],
  "Nuevo León": ["NUEVO LEON", "NL", "N L"],
  "Oaxaca": ["OAXACA", "OAX"],
  "Puebla": ["PUEBLA", "PUE"],
  "Querétaro": ["QUERETARO", "QRO", "QUERETARO DE ARTEAGA"],
  "Quintana Roo": ["QUINTANA ROO", "Q ROO", "QROO"],
  "San Luis Potosí": ["SAN LUIS POTOSI", "SLP"],
  "Sinaloa": ["SINALOA", "SIN"],
  "Sonora": ["SONORA", "SON"],
  "Tabasco": ["TABASCO", "TAB"],
  "Tamaulipas": ["TAMAULIPAS", "TAMPS", "TAMP"],
  "Tlaxcala": ["TLAXCALA", "TLAX"],
  "Veracruz": ["VERACRUZ", "VER", "VERACRUZ DE IGNACIO DE LA LLAVE"],
  "Yucatán": ["YUCATAN", "YUC"],
  "Zacatecas": ["ZACATECAS", "ZAC"],
};

function normalizarTexto(valor: string) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ESTADOS_POR_ALIAS = new Map<string, string>();
for (const estado of ESTADOS_MEXICO) {
  for (const alias of [estado, ...(ALIAS_ESTADOS[estado] || [])]) {
    ESTADOS_POR_ALIAS.set(normalizarTexto(alias), estado);
  }
}

function identificarEstado(valor: string | null | undefined) {
  const limpio = normalizarTexto(valor || "");
  // Evitamos asignar erróneamente "México" a CDMX o Estado de México.
  if (!limpio || limpio === "MEXICO") return "";
  return ESTADOS_POR_ALIAS.get(limpio) || "";
}

export default function DashboardPage() {
  const [cargando, setCargando] = useState(true);
  const [cargandoEstados, setCargandoEstados] = useState(true);
  const [errorEstados, setErrorEstados] = useState("");
  const [totalBazares, setTotalBazares] = useState(0);
  const [bazaresActivos, setBazaresActivos] = useState(0);
  const [bazaresPendientes, setBazaresPendientes] = useState(0);
  const [estadosConteo, setEstadosConteo] = useState<EstadoConteo[]>([]);
  const [totalDomicilios, setTotalDomicilios] = useState(0);
  const [domiciliosSinEstado, setDomiciliosSinEstado] = useState(0);

  const [paquetesUSA, setPaquetesUSA] = useState<PaqueteUSAAdmin[]>([]);
  const [cargandoPaquetesUSA, setCargandoPaquetesUSA] = useState(true);
  const [errorPaquetesUSA, setErrorPaquetesUSA] = useState("");
  const [busquedaPaquetesUSA, setBusquedaPaquetesUSA] = useState("");
  const [filtroPaquetesUSA, setFiltroPaquetesUSA] = useState<
    "todos" | "registrados" | "recibidos"
  >("todos");
  const [recibiendoPaqueteId, setRecibiendoPaqueteId] = useState("");
  const [resumenPaquetesUSA, setResumenPaquetesUSA] = useState<ResumenPaquetesUSA>({
    total: 0,
    registrados: 0,
    recibidos: 0,
  });

  async function cargarPaquetesUSA() {
    try {
      setCargandoPaquetesUSA(true);
      setErrorPaquetesUSA("");
      const respuesta = await fetch("/api/admin/paquetes-usa", { cache: "no-store" });
      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.success) {
        throw new Error(resultado.error || "No fue posible cargar los paquetes USA.");
      }
      setPaquetesUSA(resultado.paquetes || []);
      setResumenPaquetesUSA(
        resultado.resumen || { total: 0, registrados: 0, recibidos: 0 }
      );
    } catch (error) {
      console.error("Error cargando Paquetes USA:", error);
      setPaquetesUSA([]);
      setResumenPaquetesUSA({ total: 0, registrados: 0, recibidos: 0 });
      setErrorPaquetesUSA(
        error instanceof Error ? error.message : "No fue posible cargar los paquetes USA."
      );
    } finally {
      setCargandoPaquetesUSA(false);
    }
  }

  async function marcarPaqueteRecibido(paquete: PaqueteUSAAdmin) {
    if (paquete.estatus.trim().toLowerCase() === "recibido") return;
    const confirmar = window.confirm(
      `¿Marcar como recibido el paquete ${paquete.rastreo} de ${paquete.cliente}?`
    );
    if (!confirmar) return;
    try {
      setRecibiendoPaqueteId(paquete.id);
      setErrorPaquetesUSA("");
      const respuesta = await fetch("/api/admin/paquetes-usa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: paquete.id }),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.success) {
        throw new Error(resultado.error || "No fue posible marcar el paquete como recibido.");
      }
      await cargarPaquetesUSA();
    } catch (error) {
      console.error("Error recibiendo paquete USA:", error);
      const mensaje = error instanceof Error
        ? error.message : "No fue posible marcar el paquete como recibido.";
      setErrorPaquetesUSA(mensaje);
      alert(mensaje);
    } finally {
      setRecibiendoPaqueteId("");
    }
  }

  useEffect(() => { void cargarPaquetesUSA(); }, []);

  useEffect(() => {
    async function cargarResumen() {
      try {
        const respuesta = await fetch("/api/admin/bazares", { cache: "no-store" });
        const resultado = await respuesta.json();
        if (!respuesta.ok || !resultado.success) {
          throw new Error(resultado.error || "No fue posible cargar los bazares.");
        }
        const bazares: Bazar[] = resultado.bazares || [];
        setTotalBazares(bazares.length);
        setBazaresActivos(bazares.filter((bazar) =>
          String(bazar.estado || "").trim().toLowerCase() === "activo"
        ).length);
        setBazaresPendientes(bazares.filter((bazar) =>
          String(bazar.estado || "").trim().toLowerCase() === "pendiente"
        ).length);
      } catch (error) {
        console.error("Error cargando resumen del dashboard:", error);
      } finally {
        setCargando(false);
      }
    }
    void cargarResumen();
  }, []);

  useEffect(() => {
    async function cargarEstadosDesdeRemisiones() {
      try {
        setCargandoEstados(true);
        setErrorEstados("");
        const respuesta = await fetch("/api/remisiones/clientes", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok || !resultado.success || !Array.isArray(resultado.direcciones)) {
          throw new Error(resultado.error || "No se pudieron cargar los domicilios de Remisiones.");
        }
        const direcciones = resultado.direcciones as DireccionRemision[];
        const porCliente = new Map<number, DireccionRemision>();
        for (const direccion of direcciones) {
          if (Number.isSafeInteger(direccion.id_cliente) && direccion.id_cliente > 0) {
            porCliente.set(direccion.id_cliente, direccion);
          }
        }
        const conteo = new Map<string, number>();
        let sinEstado = 0;
        for (const direccion of porCliente.values()) {
          const estado = identificarEstado(direccion.estado);
          if (!estado) {
            sinEstado++;
            continue;
          }
          conteo.set(estado, (conteo.get(estado) || 0) + 1);
        }
        setTotalDomicilios(porCliente.size);
        setDomiciliosSinEstado(sinEstado);
        setEstadosConteo(
          Array.from(conteo.entries())
            .map(([estado, clientes]) => ({ estado, clientes }))
            .sort((a, b) => b.clientes - a.clientes || a.estado.localeCompare(b.estado))
        );
      } catch (error) {
        console.error("Error consultando domicilios de Remisiones:", error);
        setErrorEstados(error instanceof Error ? error.message : "No se pudieron cargar los domicilios.");
        setEstadosConteo([]);
        setTotalDomicilios(0);
        setDomiciliosSinEstado(0);
      } finally {
        setCargandoEstados(false);
      }
    }
    void cargarEstadosDesdeRemisiones();
  }, []);

  const paquetesUSAFiltrados = useMemo(() => {
    const termino = normalizarTexto(busquedaPaquetesUSA);
    return paquetesUSA.filter((paquete) => {
      const recibido = paquete.estatus.trim().toLowerCase() === "recibido";
      if (filtroPaquetesUSA === "registrados" && recibido) return false;
      if (filtroPaquetesUSA === "recibidos" && !recibido) return false;
      if (!termino) return true;
      return normalizarTexto(`${paquete.rastreo} ${paquete.cliente} ${paquete.tienda}`).includes(termino);
    });
  }, [paquetesUSA, busquedaPaquetesUSA, filtroPaquetesUSA]);

  const totalClientesConEstado = useMemo(
    () => estadosConteo.reduce((acumulado, item) => acumulado + item.clientes, 0),
    [estadosConteo]
  );
  const estadosConPresencia = estadosConteo.length;
  const estadosSinPresencia = useMemo(
    () => ESTADOS_MEXICO.filter((estado) => !estadosConteo.some((item) => item.estado === estado)),
    [estadosConteo]
  );
  const cobertura = Math.round((estadosConPresencia / ESTADOS_MEXICO.length) * 100);
  const maxClientes = estadosConteo[0]?.clientes || 1;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-100 via-white to-blue-50 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#061b48] via-[#073b88] to-[#00a7a7] px-6 py-10 text-white shadow-2xl ring-1 ring-blue-300/30 md:px-10 md:py-12">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="absolute -bottom-24 right-24 h-60 w-60 rounded-full bg-blue-300/20 blur-2xl" />
          <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-sm font-bold text-white shadow-sm backdrop-blur">Panel principal</span>
              <h1 className="mt-5 text-3xl font-black tracking-tight text-white md:text-5xl">Bienvenida, Viridiana</h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-cyan-50 md:text-lg">Consulta operaciones, envíos y cobertura nacional de VIPACK desde un solo lugar.</p>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/25 bg-white/15 p-4 shadow-lg backdrop-blur">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-300 text-emerald-950 shadow-md"><IconoEstado /></div>
              <div><p className="text-sm font-semibold text-cyan-50">Estado del sistema</p><p className="font-black text-white">Panel de operaciones</p></div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TarjetaResumen titulo="Bazares registrados" cantidad={cargando ? "..." : String(totalBazares)} descripcion="Total de registros" icono={<IconoUsuarios />} claseIcono="bg-blue-600 text-white" claseBorde="border-blue-200" claseFondo="bg-gradient-to-br from-white to-blue-50" />
          <TarjetaResumen titulo="Bazares activos" cantidad={cargando ? "..." : String(bazaresActivos)} descripcion="Aprobados actualmente" icono={<IconoActivo />} claseIcono="bg-emerald-600 text-white" claseBorde="border-emerald-200" claseFondo="bg-gradient-to-br from-white to-emerald-50" />
          <TarjetaResumen titulo="Estados con clientes" cantidad={cargandoEstados ? "..." : errorEstados ? "—" : String(estadosConPresencia)} descripcion={errorEstados ? "Consulta no disponible" : `${cobertura}% de estados con domicilios registrados`} icono={<IconoMapa />} claseIcono="bg-cyan-600 text-white" claseBorde="border-cyan-200" claseFondo="bg-gradient-to-br from-white to-cyan-50" />
          <TarjetaResumen titulo="Oportunidades" cantidad={cargandoEstados ? "..." : errorEstados ? "—" : String(estadosSinPresencia.length)} descripcion="Estados sin domicilios registrados" icono={<IconoObjetivo />} claseIcono="bg-violet-600 text-white" claseBorde="border-violet-200" claseFondo="bg-gradient-to-br from-white to-violet-50" />
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-sky-200 bg-white shadow-lg">
          <div className="bg-gradient-to-r from-[#061b48] via-[#073b88] to-[#00a7a7] px-5 py-6 text-white md:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Recepción de mercancía</p>
                <h2 className="mt-1 text-2xl font-black md:text-3xl">📦 Paquetes USA</h2>
                <p className="mt-1 text-sm font-medium text-cyan-50">Busca por rastreo, cliente o tienda y marca los paquetes cuando lleguen a VIPACK.</p>
              </div>
              <button type="button" onClick={cargarPaquetesUSA} disabled={cargandoPaquetesUSA} className="rounded-xl border border-white/30 bg-white/15 px-4 py-2.5 text-sm font-black text-white shadow-sm backdrop-blur transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60">
                {cargandoPaquetesUSA ? "Actualizando..." : "↻ Actualizar"}
              </button>
            </div>
          </div>
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              <button type="button" onClick={() => setFiltroPaquetesUSA("todos")} className={`rounded-2xl border p-3 text-left transition md:p-4 ${filtroPaquetesUSA === "todos" ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}>
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 md:text-xs">Total</p><p className="mt-1 text-2xl font-black text-slate-950 md:text-3xl">{cargandoPaquetesUSA ? "..." : resumenPaquetesUSA.total}</p>
              </button>
              <button type="button" onClick={() => setFiltroPaquetesUSA("registrados")} className={`rounded-2xl border p-3 text-left transition md:p-4 ${filtroPaquetesUSA === "registrados" ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100" : "border-blue-200 bg-blue-50/50 hover:bg-blue-50"}`}>
                <p className="text-[11px] font-black uppercase tracking-wide text-blue-700 md:text-xs">Por recibir</p><p className="mt-1 text-2xl font-black text-blue-800 md:text-3xl">{cargandoPaquetesUSA ? "..." : resumenPaquetesUSA.registrados}</p>
              </button>
              <button type="button" onClick={() => setFiltroPaquetesUSA("recibidos")} className={`rounded-2xl border p-3 text-left transition md:p-4 ${filtroPaquetesUSA === "recibidos" ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100" : "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50"}`}>
                <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700 md:text-xs">Recibidos</p><p className="mt-1 text-2xl font-black text-emerald-800 md:text-3xl">{cargandoPaquetesUSA ? "..." : resumenPaquetesUSA.recibidos}</p>
              </button>
            </div>
            <div className="mt-5">
              <label htmlFor="buscar-paquete-usa" className="mb-2 block text-sm font-black text-slate-700">Buscar paquete</label>
              <input id="buscar-paquete-usa" type="search" value={busquedaPaquetesUSA} onChange={(event) => setBusquedaPaquetesUSA(event.target.value)} placeholder="Rastreo, cliente o tienda..." className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            </div>
            {errorPaquetesUSA && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{errorPaquetesUSA}</div>}
            {cargandoPaquetesUSA ? (
              <div className="mt-5 rounded-2xl bg-slate-50 p-8 text-center font-semibold text-slate-500">Cargando paquetes USA...</div>
            ) : paquetesUSAFiltrados.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><p className="font-black text-slate-700">No hay paquetes para mostrar.</p><p className="mt-1 text-sm font-medium text-slate-500">Prueba otra búsqueda o cambia el filtro.</p></div>
            ) : (
              <>
                <div className="mt-5 space-y-3 md:hidden">
                  {paquetesUSAFiltrados.map((paquete) => {
                    const recibido = paquete.estatus.trim().toLowerCase() === "recibido";
                    const procesando = recibiendoPaqueteId === paquete.id;
                    return (
                      <article key={paquete.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">{paquete.cliente || "Sin cliente"}</p><p className="mt-1 break-all font-mono text-sm font-black text-blue-700">{paquete.rastreo}</p></div>
                          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${recibido ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>{recibido ? "✓ Recibido" : "Registrado"}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl bg-slate-50 p-2.5"><p className="font-bold text-slate-500">Tienda</p><p className="mt-0.5 font-black text-slate-800">{paquete.tienda || "—"}</p></div>
                          <div className="rounded-xl bg-slate-50 p-2.5"><p className="font-bold text-slate-500">Registro</p><p className="mt-0.5 font-black text-slate-800">{paquete.fechaRegistro || "—"}</p></div>
                        </div>
                        {recibido ? <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800">Recibido: {paquete.fechaRecibido || "Fecha registrada"}</div> : (
                          <button type="button" onClick={() => marcarPaqueteRecibido(paquete)} disabled={procesando} className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{procesando ? "Guardando..." : "✓ Recibir paquete"}</button>
                        )}
                      </article>
                    );
                  })}
                </div>
                <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50"><tr>
                      <th className="px-4 py-3 text-left font-black text-slate-600">Cliente</th><th className="px-4 py-3 text-left font-black text-slate-600">Rastreo</th><th className="px-4 py-3 text-left font-black text-slate-600">Tienda</th><th className="px-4 py-3 text-left font-black text-slate-600">Registro</th><th className="px-4 py-3 text-left font-black text-slate-600">Estado</th><th className="px-4 py-3 text-right font-black text-slate-600">Acción</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {paquetesUSAFiltrados.map((paquete) => {
                        const recibido = paquete.estatus.trim().toLowerCase() === "recibido";
                        const procesando = recibiendoPaqueteId === paquete.id;
                        return <tr key={paquete.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-900">{paquete.cliente || "Sin cliente"}</td><td className="px-4 py-3 font-mono font-black text-blue-700">{paquete.rastreo}</td><td className="px-4 py-3 font-semibold text-slate-700">{paquete.tienda || "—"}</td><td className="px-4 py-3 font-semibold text-slate-600">{paquete.fechaRegistro || "—"}</td>
                          <td className="px-4 py-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${recibido ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>{recibido ? `✓ Recibido${paquete.fechaRecibido ? ` · ${paquete.fechaRecibido}` : ""}` : "Registrado"}</span></td>
                          <td className="px-4 py-3 text-right">{recibido ? <span className="font-black text-emerald-700">Listo</span> : <button type="button" onClick={() => marcarPaqueteRecibido(paquete)} disabled={procesando} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{procesando ? "Guardando..." : "✓ Recibir"}</button>}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-3xl border border-blue-200 bg-white p-6 shadow-lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">Cobertura nacional</p><h2 className="mt-2 text-2xl font-black text-slate-950">Estados con más clientes</h2><p className="mt-2 text-sm font-medium text-slate-600">Calculado con el estado del domicilio guardado en Remisiones. No se consultan PDFs de guías.</p></div>
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Clientes con estado identificado</p><p className="text-2xl font-black text-slate-950">{cargandoEstados ? "..." : errorEstados ? "—" : totalClientesConEstado}</p></div>
            </div>
            {errorEstados && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{errorEstados}</div>}
            <div className="mt-7 space-y-4">
              {cargandoEstados && <div className="rounded-2xl bg-slate-50 p-8 text-center font-semibold text-slate-500">Consultando domicilios de Remisiones...</div>}
              {!cargandoEstados && !errorEstados && estadosConteo.length === 0 && <div className="rounded-2xl bg-slate-50 p-8 text-center font-semibold text-slate-500">Todavía no hay domicilios con estados reconocidos en Remisiones.</div>}
              {!cargandoEstados && !errorEstados && estadosConteo.slice(0, 12).map((item, index) => {
                const porcentaje = Math.max(4, Math.round((item.clientes / maxClientes) * 100));
                return <div key={item.estado}>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-700">{index + 1}</span><p className="font-black text-slate-800">{item.estado}</p></div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">{item.clientes} {item.clientes === 1 ? "cliente" : "clientes"}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all" style={{ width: `${porcentaje}%` }} /></div>
                </div>;
              })}
            </div>
          </article>
          <article className="rounded-3xl border border-violet-200 bg-gradient-to-br from-white to-violet-50 p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-black uppercase tracking-[0.16em] text-violet-700">Expansión</p><h2 className="mt-2 text-2xl font-black text-slate-950">Estados por conquistar</h2><p className="mt-2 text-sm font-medium leading-6 text-slate-600">Estados sin domicilios de clientes registrados en Remisiones. Esto no significa que nunca se hayan realizado envíos allí.</p></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md"><IconoObjetivo /></div>
            </div>
            <div className="mt-6 rounded-2xl border border-violet-200 bg-white p-5">
              <div className="flex items-end justify-between gap-3"><div><p className="text-sm font-bold text-slate-500">Cobertura registrada</p><p className="mt-1 text-4xl font-black text-slate-950">{cargandoEstados ? "..." : errorEstados ? "—" : `${cobertura}%`}</p></div><p className="text-right text-sm font-bold text-violet-700">{errorEstados ? "Sin datos" : `${estadosConPresencia} de 32 estados`}</p></div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500" style={{ width: `${errorEstados ? 0 : cobertura}%` }} /></div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {cargandoEstados ? <span className="text-sm font-semibold text-slate-500">Calculando oportunidades...</span> : errorEstados ? <span className="text-sm font-semibold text-red-600">No se pudo calcular la cobertura.</span> : estadosSinPresencia.map((estado) => <span key={estado} className="rounded-full border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-800 shadow-sm">{estado}</span>)}
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-2">
          <article className="rounded-3xl border border-amber-200 bg-gradient-to-br from-white to-amber-50 p-6 shadow-lg">
            <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-black uppercase tracking-[0.16em] text-amber-700">Seguimiento</p><h2 className="mt-2 text-2xl font-black text-slate-950">Pendientes</h2></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md"><IconoReloj /></div></div>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-white p-4 shadow-sm"><div><p className="font-black text-slate-950">Bazares por revisar</p><p className="mt-1 text-sm font-medium text-slate-600">Registros pendientes de aprobación</p></div><span className="rounded-xl bg-amber-100 px-4 py-2 text-3xl font-black text-amber-800">{cargando ? "..." : bazaresPendientes}</span></div>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-blue-300 bg-white p-4 shadow-sm"><div><p className="font-black text-slate-950">Domicilios registrados</p><p className="mt-1 text-sm font-medium text-slate-600">Clientes con domicilio guardado en Remisiones</p></div><span className="rounded-xl bg-blue-100 px-4 py-2 text-3xl font-black text-blue-800">{cargandoEstados ? "..." : errorEstados ? "—" : totalDomicilios}</span></div>
              {!cargandoEstados && !errorEstados && <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-black text-slate-950">Calidad de los domicilios</p><div className="mt-3 grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-emerald-50 p-3"><p className="text-2xl font-black text-emerald-800">{totalClientesConEstado}</p><p className="text-xs font-bold text-emerald-700">Estado identificado</p></div><div className="rounded-xl bg-orange-50 p-3"><p className="text-2xl font-black text-orange-800">{domiciliosSinEstado}</p><p className="text-xs font-bold text-orange-700">Estado por revisar</p></div></div></div>}
            </div>
          </article>
          <article className="rounded-3xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow-lg">
            <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">Estrategia</p><h2 className="mt-2 text-2xl font-black text-slate-950">Lectura comercial</h2></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md"><IconoActividad /></div></div>
            <div className="mt-6 space-y-4">
              <Actividad titulo="Mercados fuertes" descripcion={errorEstados ? "No se pudo consultar la información de Remisiones." : estadosConteo.length > 0 ? `Los estados con más clientes registrados son ${estadosConteo.slice(0, 3).map((item) => item.estado).join(", ")}.` : "Se mostrarán cuando existan domicilios con estados identificados."} hora="Remisiones" clasePunto="bg-emerald-500" claseFondo="bg-emerald-50" />
              <Actividad titulo="Nuevos mercados" descripcion={errorEstados ? "Pendiente de consulta." : estadosSinPresencia.length > 0 ? `Hay ${estadosSinPresencia.length} estados sin domicilios registrados que pueden orientar campañas de captación.` : "Ya existen domicilios registrados en los 32 estados."} hora="Marketing" clasePunto="bg-violet-500" claseFondo="bg-violet-50" />
              <Actividad titulo="Fuente real" descripcion="La cobertura se calcula con el estado del domicilio guardado para cada cliente en Remisiones. No se leen guías PDF ni se contabilizan como envíos realizados." hora="Automático" clasePunto="bg-blue-500" claseFondo="bg-blue-50" />
            </div>
          </article>
        </section>

        <section className="mt-8 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-cyan-50 p-6 shadow-lg">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">Estado general</p><h2 className="mt-2 text-2xl font-black text-slate-950">Servicios conectados</h2><p className="mt-2 font-medium text-slate-700">El panel consulta los módulos internos y obtiene la cobertura desde los domicilios guardados en Remisiones.</p></div><div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-5 py-4 shadow-sm"><span className={`h-3 w-3 rounded-full ${errorEstados || errorPaquetesUSA ? "bg-amber-500" : "bg-emerald-500"}`} /><div><p className="font-black text-emerald-800">Panel VIPACK</p><p className="text-sm font-semibold text-emerald-600">{errorEstados || errorPaquetesUSA ? "Revisar consultas con error" : "Consultas iniciadas"}</p></div></div></div>
        </section>
        <footer className="mt-10 border-t border-slate-200 py-6 text-center text-sm font-medium text-slate-500">VIPACK Envíos · Sistema interno de administración y operaciones</footer>
      </div>
    </div>
  );
}

function TarjetaResumen({ titulo, cantidad, descripcion, icono, claseIcono, claseBorde, claseFondo }: {
  titulo: string; cantidad: string; descripcion: string; icono: ReactNode;
  claseIcono: string; claseBorde: string; claseFondo: string;
}) {
  return <article className={`rounded-3xl border ${claseBorde} ${claseFondo} p-5 shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl`}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-slate-600">{titulo}</p><p className="mt-3 text-4xl font-black text-slate-950">{cantidad}</p><p className="mt-1 text-sm font-medium text-slate-500">{descripcion}</p></div><div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${claseIcono} shadow-md`}>{icono}</div></div>
  </article>;
}
function Actividad({ titulo, descripcion, hora, clasePunto, claseFondo }: {
  titulo: string; descripcion: string; hora: string; clasePunto: string; claseFondo: string;
}) {
  return <div className={`flex items-start gap-4 rounded-2xl p-4 ${claseFondo}`}><span className={`mt-2 h-3 w-3 shrink-0 rounded-full ${clasePunto}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-slate-950">{titulo}</p><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">{hora}</span></div><p className="mt-1 text-sm font-medium text-slate-600">{descripcion}</p></div></div>;
}
function IconoEstado() { return <IconoBase><path d="m5 12 4 4L19 6" /></IconoBase>; }
function IconoUsuarios() { return <IconoBase><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5a3 3 0 0 1 0 6" /><path d="M18 14a5 5 0 0 1 3 6" /></IconoBase>; }
function IconoActivo() { return <IconoBase><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></IconoBase>; }
function IconoReloj() { return <IconoBase><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></IconoBase>; }
function IconoMapa() { return <IconoBase><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z" /><path d="M9 3v15" /><path d="M15 6v15" /></IconoBase>; }
function IconoObjetivo() { return <IconoBase><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></IconoBase>; }
function IconoActividad() { return <IconoBase><path d="M3 12h4l2-5 4 10 2-5h6" /></IconoBase>; }
function IconoBase({ children }: { children: ReactNode }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">{children}</svg>; }