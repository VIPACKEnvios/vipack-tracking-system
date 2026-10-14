
"use client";

import { useEffect, useMemo, useState } from "react";

type Cliente = {
  id: number;
  cliente: string;
  telefono_whatsapp: string;
  alias: string;
  activo: boolean;
  calle: string | null;
  numero_exterior: string | null;
  numero_interior: string | null;
  colonia: string | null;
  delegacion: string | null;
  codigo_postal: string | null;
  ciudad: string | null;
  estado: string | null;
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

const direccionVacia = {
  calle: "",
  numero_exterior: "",
  numero_interior: "",
  colonia: "",
  delegacion: "",
  codigo_postal: "",
  ciudad: "",
  estado: "",
};

export default function RemisionesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [idSeleccionado, setIdSeleccionado] = useState("");
  const [direccion, setDireccion] = useState(direccionVacia);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargarClientes() {
      try {
        const response = await fetch(
          "/api/remisiones/clientes",
          { cache: "no-store" }
        );

        const resultado = await response.json();

        if (!response.ok || !resultado.success) {
          throw new Error(
            resultado.error || "No se pudieron cargar las clientas."
          );
        }

        setClientes(resultado.clientes ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error desconocido."
        );
      } finally {
        setCargando(false);
      }
    }

    cargarClientes();
  }, []);

  const clientesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) return clientes;

    return clientes.filter(
      (c) =>
        c.cliente.toLowerCase().includes(texto) ||
        String(c.id).includes(texto) ||
        c.alias.toLowerCase().includes(texto)
    );
  }, [clientes, busqueda]);

  const seleccionada = clientes.find(
    (c) => String(c.id) === idSeleccionado
  );

  function seleccionarCliente(id: string) {
    setIdSeleccionado(id);
    setMensaje("");
    setError("");

    const cliente = clientes.find((c) => String(c.id) === id);

    if (!cliente) {
      setDireccion({ ...direccionVacia });
      return;
    }

    setDireccion({
      calle: cliente.calle ?? "",
      numero_exterior: cliente.numero_exterior ?? "",
      numero_interior: cliente.numero_interior ?? "",
      colonia: cliente.colonia ?? "",
      delegacion: cliente.delegacion ?? "",
      codigo_postal: cliente.codigo_postal ?? "",
      ciudad: cliente.ciudad ?? "",
      estado: cliente.estado ?? "",
    });
  }

  async function guardarDireccion() {
    if (!seleccionada) return;

    setGuardando(true);
    setMensaje("");
    setError("");

    try {
      const response = await fetch(
        "/api/remisiones/clientes",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: seleccionada.id,
            ...direccion,
          }),
        }
      );

      const resultado = await response.json();

      if (!response.ok || !resultado.success) {
        throw new Error(
          resultado.error || "No se pudo guardar la dirección."
        );
      }

      setClientes((actuales) =>
        actuales.map((c) =>
          c.id === seleccionada.id ? resultado.cliente : c
        )
      );

      setMensaje("Dirección guardada correctamente.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error desconocido."
      );
    } finally {
      setGuardando(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#0f172a",
  };

  return (
    <main style={{ maxWidth: 1050, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>
        Remisiones VIPACK
      </h1>

      <p style={{ color: "#64748b", marginTop: 8 }}>
        Selecciona una clienta y completa los datos del destinatario.
      </p>

      <section
        style={{
          background: "#f1f5f9",
          padding: 20,
          borderRadius: 12,
          marginTop: 24,
          color: "#0f172a",
        }}
      >
        <h2 style={{ fontWeight: 700, marginBottom: 12 }}>
          Remitente fijo
        </h2>

        <p><strong>Nombre:</strong> Viridiana Malaga</p>
        <p><strong>RFC:</strong> </p>
        <p><strong>Teléfono:</strong> 6442350116</p>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>
          Datos del destinatario
        </h2>

        <div style={{ marginTop: 16 }}>
          <label>Buscar clienta por nombre, alias o ID</label>

          <input
            style={{ ...inputStyle, marginTop: 6 }}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar clienta..."
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <label>Seleccionar clienta</label>

          <select
            style={{ ...inputStyle, marginTop: 6 }}
            value={idSeleccionado}
            onChange={(e) => seleccionarCliente(e.target.value)}
            disabled={cargando}
          >
            <option value="">
              {cargando ? "Cargando clientas..." : "Selecciona una clienta"}
            </option>

            {clientesFiltrados.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} - {c.cliente}
              </option>
            ))}
          </select>
        </div>

        {seleccionada && (
          <div style={{ marginTop: 24 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
              }}
            >
              <div>
                <label>Nombre completo</label>
                <input
                  style={inputStyle}
                  value={seleccionada.cliente}
                  readOnly
                />
              </div>

              <div>
                <label>Teléfono</label>
                <input
                  style={inputStyle}
                  value={seleccionada.telefono_whatsapp}
                  readOnly
                />
              </div>

              {campos.map((campo) => (
                <div key={campo.key}>
                  <label>{campo.label}</label>
                  <input
                    style={inputStyle}
                    value={direccion[campo.key]}
                    onChange={(e) =>
                      setDireccion((actual) => ({
                        ...actual,
                        [campo.key]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={guardarDireccion}
              disabled={guardando}
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

        {mensaje && (
          <p role="status" style={{ color: "#15803d", marginTop: 16 }}>
            {mensaje}
          </p>
        )}

        {error && (
          <p role="alert" style={{ color: "#dc2626", marginTop: 16 }}>
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
