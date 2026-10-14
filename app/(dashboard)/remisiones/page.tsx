"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

type ClienteExcel = {
  id_cliente: string;
  nombre: string;
  telefono?: string;
  carpeta_cliente?: string;
};

type CampoDireccion =
  | "calle"
  | "numero_exterior"
  | "numero_interior"
  | "colonia"
  | "delegacion"
  | "codigo_postal"
  | "ciudad"
  | "estado";

type Direccion = Record<CampoDireccion, string>;

type DireccionGuardada = Partial<Record<CampoDireccion, string | null>>;

const campos: { key: CampoDireccion; label: string }[] = [
  { key: "calle", label: "Calle" },
  { key: "numero_exterior", label: "Número exterior" },
  { key: "numero_interior", label: "Número interior" },
  { key: "colonia", label: "Colonia" },
  { key: "delegacion", label: "Delegación / Municipio" },
  { key: "codigo_postal", label: "Código postal" },
  { key: "ciudad", label: "Ciudad" },
  { key: "estado", label: "Estado" },
];

const direccionVacia: Direccion = {
  calle: "",
  numero_exterior: "",
  numero_interior: "",
  colonia: "",
  delegacion: "",
  codigo_postal: "",
  ciudad: "",
  estado: "",
};

function leerDireccion(cliente?: DireccionGuardada | null): Direccion {
  return {
    calle: cliente?.calle ?? "",
    numero_exterior: cliente?.numero_exterior ?? "",
    numero_interior: cliente?.numero_interior ?? "",
    colonia: cliente?.colonia ?? "",
    delegacion: cliente?.delegacion ?? "",
    codigo_postal: cliente?.codigo_postal ?? "",
    ciudad: cliente?.ciudad ?? "",
    estado: cliente?.estado ?? "",
  };
}

export default function RemisionesPage() {
  const [clientes, setClientes] = useState<ClienteExcel[]>([]);
  const seleccionActual = useRef(0);
  const [cargandoDireccion, setCargandoDireccion] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [idSeleccionado, setIdSeleccionado] = useState("");
  const [direccion, setDireccion] = useState<Direccion>({ ...direccionVacia });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function cargarClientes() {
      try {
        const respuestaExcel = await fetch("/api/clientes", { cache: "no-store" });
        const datosExcel = await respuestaExcel.json();
        if (!respuestaExcel.ok || !datosExcel.success || !Array.isArray(datosExcel.clientes)) {
          throw new Error(datosExcel.error || "No se pudo cargar el listado de clientes de VIPACK.");
        }

        // La lista oficial proviene del Excel de OneDrive.
        const lista: ClienteExcel[] = datosExcel.clientes
          .filter((c: ClienteExcel) => c.id_cliente && c.nombre)
          .map((c: ClienteExcel) => ({
            id_cliente: String(c.id_cliente),
            nombre: String(c.nombre),
            telefono: String(c.telefono ?? ""),
            carpeta_cliente: String(c.carpeta_cliente ?? ""),
          }));

        if (!cancelado) setClientes(lista);
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : "Error al cargar los clientes.");
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    void cargarClientes();
    return () => { cancelado = true; };
  }, []);

  const clientesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase("es-MX");
    if (!texto) return clientes;
    return clientes.filter((c) =>
      c.nombre.toLocaleLowerCase("es-MX").includes(texto) ||
      c.id_cliente.includes(texto) ||
      (c.carpeta_cliente ?? "").toLocaleLowerCase("es-MX").includes(texto)
    );
  }, [clientes, busqueda]);

  const seleccionado = clientes.find((c) => c.id_cliente === idSeleccionado);

  async function seleccionarCliente(id: string) {
    const solicitud = ++seleccionActual.current;
    setIdSeleccionado(id);
    setMensaje("");
    setError("");
    setDireccion({ ...direccionVacia });
    if (!id) {
      setCargandoDireccion(false);
      return;
    }
    setCargandoDireccion(true);
    try {
      const respuesta = await fetch(`/api/remisiones/clientes?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.success) {
        throw new Error(resultado.error || "No se pudo consultar el domicilio.");
      }
      if (solicitud === seleccionActual.current) {
        setDireccion(leerDireccion(resultado.direccion));
      }
    } catch (err) {
      if (solicitud === seleccionActual.current) {
        setError(err instanceof Error ? err.message : "Error al consultar el domicilio.");
      }
    } finally {
      if (solicitud === seleccionActual.current) setCargandoDireccion(false);
    }
  }

  async function guardarDireccion() {
    if (!seleccionado || cargandoDireccion) return;
    setGuardando(true);
    setMensaje("");
    setError("");

    try {
      const respuesta = await fetch("/api/remisiones/clientes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: Number(seleccionado.id_cliente),
          ...direccion,
        }),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.success || !resultado.direccion) {
        throw new Error(resultado.error || "No se pudo guardar la dirección.");
      }
      setDireccion(leerDireccion(resultado.direccion));
      setMensaje("Dirección guardada correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la dirección.");
    } finally {
      setGuardando(false);
    }
  }

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#0f172a",
  };

  return (
    <main style={{ maxWidth: 1050, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Remisiones VIPACK</h1>
      <p style={{ color: "#64748b", marginTop: 8 }}>
        Selecciona un cliente de VIPACK y completa los datos del destinatario.
      </p>

      <section style={{ background: "#f1f5f9", padding: 20, borderRadius: 12, marginTop: 24, color: "#0f172a" }}>
        <h2 style={{ fontWeight: 700, marginBottom: 12 }}>Remitente fijo</h2>
        <p><strong>Nombre:</strong> Viridiana Malaga</p>
        <p><strong>RFC:</strong> </p>
        <p><strong>Teléfono:</strong> 6442350116</p>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Datos del destinatario</h2>
        <div style={{ marginTop: 16 }}>
          <label htmlFor="buscar-cliente">Buscar cliente por nombre o ID</label>
          <input
            id="buscar-cliente"
            style={{ ...inputStyle, marginTop: 6 }}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ejemplo: MARCO o 20"
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <label htmlFor="seleccionar-cliente">Seleccionar cliente</label>
          <select
            id="seleccionar-cliente"
            style={{ ...inputStyle, marginTop: 6 }}
            value={idSeleccionado}
            onChange={(e) => seleccionarCliente(e.target.value)}
            disabled={cargando}
          >
            <option value="">{cargando ? "Cargando clientes..." : "Selecciona un cliente"}</option>
            {clientesFiltrados.map((c) => (
              <option key={c.id_cliente} value={c.id_cliente}>
                {c.id_cliente} - {c.nombre}
              </option>
            ))}
          </select>
          {!cargando && (
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>
              {clientesFiltrados.length} de {clientes.length} clientes encontrados.
            </p>
          )}
        </div>

        {seleccionado && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div>
                <label>Nombre completo</label>
                <input style={inputStyle} value={seleccionado.nombre} readOnly />
              </div>
              <div>
                <label>Teléfono</label>
                <input style={inputStyle} value={seleccionado.telefono ?? ""} readOnly />
              </div>
              {campos.map((campo) => (
                <div key={campo.key}>
                  <label htmlFor={`direccion-${campo.key}`}>{campo.label}</label>
                  <input
                    id={`direccion-${campo.key}`}
                    style={inputStyle}
                    value={direccion[campo.key]}
                    onChange={(e) => setDireccion((actual) => ({ ...actual, [campo.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={guardarDireccion}
              disabled={guardando || cargandoDireccion}
              style={{
                marginTop: 24,
                padding: "12px 22px",
                background: "#0f766e",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: guardando ? "wait" : "pointer",
                fontWeight: 700,
              }}
            >
              {guardando ? "Guardando..." : "Guardar dirección"}
            </button>
          </div>
        )}
        {mensaje && <p role="status" style={{ color: "#15803d", marginTop: 16 }}>{mensaje}</p>}
        {error && <p role="alert" style={{ color: "#dc2626", marginTop: 16 }}>{error}</p>}
      </section>
    </main>
  );
}