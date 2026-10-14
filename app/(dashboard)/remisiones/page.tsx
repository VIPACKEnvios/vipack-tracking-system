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
  | "calle" | "numero_exterior" | "numero_interior" | "colonia"
  | "delegacion" | "codigo_postal" | "ciudad" | "estado";
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
  calle: "", numero_exterior: "", numero_interior: "", colonia: "",
  delegacion: "", codigo_postal: "", ciudad: "", estado: "",
};

function leerDireccion(valor?: DireccionGuardada | null): Direccion {
  return {
    calle: valor?.calle ?? "",
    numero_exterior: valor?.numero_exterior ?? "",
    numero_interior: valor?.numero_interior ?? "",
    colonia: valor?.colonia ?? "",
    delegacion: valor?.delegacion ?? "",
    codigo_postal: valor?.codigo_postal ?? "",
    ciudad: valor?.ciudad ?? "",
    estado: valor?.estado ?? "",
  };
}

const remitente = { nombre: "Viridiana Malaga", telefono: "6442350116", rfc: "" };

// Coordenadas calibradas sobre la plantilla A4 REMISIÓN - MATRIZ.
// Valores proporcionales desde la esquina superior izquierda.
const posiciones = {
  remitenteNombre: { x: 0.209, y: 0.128, ancho: 0.745 },
  remitenteTelefono: { x: 0.225, y: 0.180, ancho: 0.730 },
  destinatarioNombre: { x: 0.210, y: 0.240, ancho: 0.745 },
  destinatarioTelefono: { x: 0.226, y: 0.265, ancho: 0.728 },
  calle: { x: 0.085, y: 0.291, ancho: 0.560 },
  numeroExterior: { x: 0.749, y: 0.291, ancho: 0.074 },
  numeroInterior: { x: 0.914, y: 0.291, ancho: 0.052 },
  colonia: { x: 0.095, y: 0.315, ancho: 0.484 },
  delegacion: { x: 0.699, y: 0.315, ancho: 0.131 },
  codigoPostal: { x: 0.882, y: 0.315, ancho: 0.082 },
  ciudad: { x: 0.105, y: 0.341, ancho: 0.557 },
  estado: { x: 0.757, y: 0.341, ancho: 0.205 },
};

export default function RemisionesPage() {
  const [clientes, setClientes] = useState<ClienteExcel[]>([]);
  const seleccionActual = useRef(0);
  const [cargandoDireccion, setCargandoDireccion] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [idSeleccionado, setIdSeleccionado] = useState("");
  const [direccion, setDireccion] = useState<Direccion>({ ...direccionVacia });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;
    async function cargarClientes() {
      try {
        const respuesta = await fetch("/api/clientes", { cache: "no-store" });
        const datos = await respuesta.json();
        if (!respuesta.ok || !datos.success || !Array.isArray(datos.clientes)) {
          throw new Error(datos.error || "No se pudo cargar el listado de clientes.");
        }
        const lista: ClienteExcel[] = datos.clientes
          .filter((c: ClienteExcel) => c.id_cliente && c.nombre)
          .map((c: ClienteExcel) => ({
            id_cliente: String(c.id_cliente),
            nombre: String(c.nombre),
            telefono: String(c.telefono ?? ""),
            carpeta_cliente: String(c.carpeta_cliente ?? ""),
          }));
        if (!cancelado) setClientes(lista);
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : "Error al cargar clientes.");
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
    if (!id) { setCargandoDireccion(false); return; }
    setCargandoDireccion(true);
    try {
      const respuesta = await fetch(`/api/remisiones/clientes?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.success) {
        throw new Error(resultado.error || "No se pudo consultar el domicilio.");
      }
      if (solicitud === seleccionActual.current) setDireccion(leerDireccion(resultado.direccion));
    } catch (err) {
      if (solicitud === seleccionActual.current) {
        setError(err instanceof Error ? err.message : "Error al consultar domicilio.");
      }
    } finally {
      if (solicitud === seleccionActual.current) setCargandoDireccion(false);
    }
  }

  async function guardarDireccion() {
    if (!seleccionado || cargandoDireccion || guardando) return;
    const idAlGuardar = seleccionado.id_cliente;
    setGuardando(true);
    setMensaje("");
    setError("");
    try {
      const respuesta = await fetch("/api/remisiones/clientes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(idAlGuardar), ...direccion }),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.success || !resultado.direccion) {
        throw new Error(resultado.error || "No se pudo guardar la dirección.");
      }
      if (seleccionActual.current && idAlGuardar === idSeleccionado) {
        setDireccion(leerDireccion(resultado.direccion));
        setMensaje("Dirección guardada correctamente.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la dirección.");
    } finally {
      setGuardando(false);
    }
  }

  async function descargarRemision() {
    if (!seleccionado || cargandoDireccion || guardando || generandoPdf) return;
    setMensaje("");
    setError("");
    setGenerandoPdf(true);
    try {
      const respuesta = await fetch("/remision-plantilla.pdf", { cache: "no-store" });
      if (!respuesta.ok || !(respuesta.headers.get("content-type") ?? "").includes("pdf")) {
        throw new Error("Falta la plantilla original. Coloca tu PDF en public/remision-plantilla.pdf antes de descargar.");
      }
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const pdf = await PDFDocument.load(await respuesta.arrayBuffer());
      const pagina = pdf.getPages()[0];
      if (!pagina) throw new Error("La plantilla PDF no contiene páginas.");
      const fuente = await pdf.embedFont(StandardFonts.Helvetica);
      const { width, height } = pagina.getSize();
      const dibujar = (valor: string, p: { x: number; y: number; ancho: number }) => {
        const limpio = valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (!limpio) return;
        const anchoDisponible = width * p.ancho;
        let tamano = 9;
        while (tamano > 5 && fuente.widthOfTextAtSize(limpio, tamano) > anchoDisponible) {
          tamano -= 0.25;
        }
        // Nunca invadir el siguiente campo; acortar solo si ni 5pt alcanzan.
        let texto = limpio;
        while (texto && fuente.widthOfTextAtSize(texto, tamano) > anchoDisponible) {
          texto = texto.slice(0, -1);
        }
        pagina.drawText(texto, {
          x: width * p.x,
          y: height * (1 - p.y),
          size: tamano,
          font: fuente,
          color: rgb(0, 0, 0),
        });
      };
      dibujar(remitente.nombre, posiciones.remitenteNombre);
      dibujar(remitente.telefono, posiciones.remitenteTelefono);
      dibujar(seleccionado.nombre, posiciones.destinatarioNombre);
      dibujar(seleccionado.telefono ?? "", posiciones.destinatarioTelefono);
      dibujar(direccion.calle, posiciones.calle);
      dibujar(direccion.numero_exterior, posiciones.numeroExterior);
      dibujar(direccion.numero_interior, posiciones.numeroInterior);
      dibujar(direccion.colonia, posiciones.colonia);
      dibujar(direccion.delegacion, posiciones.delegacion);
      dibujar(direccion.codigo_postal, posiciones.codigoPostal);
      dibujar(direccion.ciudad, posiciones.ciudad);
      dibujar(direccion.estado, posiciones.estado);
      const bytes = await pdf.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `remision-vipack-cliente-${seleccionado.id_cliente}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
      setMensaje("Remisión descargada. Revisa los datos antes de imprimir.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    } finally {
      setGenerandoPdf(false);
    }
  }

  const inputStyle: CSSProperties = {
    width: "100%", padding: "11px 12px", border: "1px solid #cbd5e1",
    borderRadius: 8, background: "#ffffff", color: "#0f172a",
  };

  return (
    <main style={{ maxWidth: 1050, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Remisiones VIPACK</h1>
      <p style={{ color: "#64748b", marginTop: 8 }}>
        Selecciona un cliente y completa únicamente los datos del destinatario.
      </p>
      <section style={{ background: "#f1f5f9", padding: 20, borderRadius: 12, marginTop: 24, color: "#0f172a" }}>
        <h2 style={{ fontWeight: 700, marginBottom: 12 }}>Remitente fijo</h2>
        <p><strong>Nombre:</strong> {remitente.nombre}</p>
        <p><strong>RFC:</strong> {remitente.rfc}</p>
        <p><strong>Teléfono:</strong> {remitente.telefono}</p>
      </section>
      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Datos del destinatario</h2>
        <div style={{ marginTop: 16 }}>
          <label htmlFor="buscar-cliente">Buscar cliente por nombre o ID</label>
          <input id="buscar-cliente" style={{ ...inputStyle, marginTop: 6 }} value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)} placeholder="Ejemplo: MARCO o 20" />
        </div>
        <div style={{ marginTop: 16 }}>
          <label htmlFor="seleccionar-cliente">Seleccionar cliente</label>
          <select id="seleccionar-cliente" style={{ ...inputStyle, marginTop: 6 }}
            value={idSeleccionado} onChange={(e) => void seleccionarCliente(e.target.value)} disabled={cargando}>
            <option value="">{cargando ? "Cargando clientes..." : "Selecciona un cliente"}</option>
            {clientesFiltrados.map((c) => (
              <option key={c.id_cliente} value={c.id_cliente}>{c.id_cliente} - {c.nombre}</option>
            ))}
          </select>
          {!cargando && <p style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>
            {clientesFiltrados.length} de {clientes.length} clientes encontrados.
          </p>}
        </div>
        {seleccionado && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div><label>Nombre completo</label><input style={inputStyle} value={seleccionado.nombre} readOnly /></div>
              <div><label>Teléfono</label><input style={inputStyle} value={seleccionado.telefono ?? ""} readOnly /></div>
              {campos.map((campo) => (
                <div key={campo.key}>
                  <label htmlFor={`direccion-${campo.key}`}>{campo.label}</label>
                  <input id={`direccion-${campo.key}`} style={inputStyle} value={direccion[campo.key]}
                    onChange={(e) => setDireccion((actual) => ({ ...actual, [campo.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
              <button type="button" onClick={() => void guardarDireccion()} disabled={guardando || cargandoDireccion}
                style={{ padding: "12px 22px", background: "#0f766e", color: "white", border: "none", borderRadius: 8, fontWeight: 700 }}>
                {guardando ? "Guardando..." : "Guardar dirección"}
              </button>
              <button type="button" onClick={() => void descargarRemision()}
                disabled={generandoPdf || cargandoDireccion || guardando}
                style={{ padding: "12px 22px", background: "#0755aa", color: "white", border: "none", borderRadius: 8, fontWeight: 700 }}>
                {generandoPdf ? "Generando PDF..." : "Descargar remisión PDF"}
              </button>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 12 }}>
              Se utiliza la plantilla original; no se rellenan mercancía, costos ni otros apartados.
            </p>
          </div>
        )}
        {mensaje && <p role="status" style={{ color: "#15803d", marginTop: 16 }}>{mensaje}</p>}
        {error && <p role="alert" style={{ color: "#dc2626", marginTop: 16 }}>{error}</p>}
      </section>
    </main>
  );
}