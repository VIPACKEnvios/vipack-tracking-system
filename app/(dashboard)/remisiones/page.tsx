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

// Solo para impresión: convierte prefijos móviles mexicanos a 10 dígitos.
// No modifica el teléfono registrado en Excel ni en Supabase.
function telefonoParaRemision(telefono: string): string {
  const original = telefono.trim();
  const digitos = original.replace(/\D/g, "");
  if (digitos.length === 13 && digitos.startsWith("521")) return digitos.slice(3);
  if (digitos.length === 12 && digitos.startsWith("52")) return digitos.slice(2);
  return original;
}

// Evita caracteres no compatibles con Helvetica/WinAnsi en pdf-lib.
// Solo modifica el texto impreso, nunca los datos guardados.
function textoSeguroPdf(valor: string): string {
  const equivalencias: Record<string, string> = {
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H",
    "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X",
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x",
    "Ё": "E", "ё": "e", "№": "No.", "–": "-", "—": "-",
    "‘": "'", "’": "'", "“": "\"", "”": "\"", "…": "...",
    "\u00a0": " ",
  };
  const convertido = Array.from(valor, (caracter) => equivalencias[caracter] ?? caracter).join("");
  return convertido
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Interpreta mensajes de WhatsApp por etiquetas. Los datos siempre se pueden corregir.
function extraerDatosWhatsApp(texto: string): { nombre: string; telefono: string; direccion: Direccion; referencia: string } {
  const resultado = { nombre: "", telefono: "", direccion: { ...direccionVacia }, referencia: "" };
  const lineas = texto.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 #/]/g, " ").replace(/\s+/g, " ").trim();
  for (const linea of lineas) {
    const separador = linea.indexOf(":");
    if (separador < 0) continue;
    const etiqueta = normalizar(linea.slice(0, separador));
    const valor = linea.slice(separador + 1).trim();
    if (!valor) continue;
    if (/^(nombre|nombre completo|destinatario)$/.test(etiqueta)) resultado.nombre = valor;
    else if (/^(telefono|tel|celular|numero de celular|numero de telefono|telefono celular)$/.test(etiqueta)) resultado.telefono = valor;
    else if (/^(calle|direccion|domicilio|calle y numero)$/.test(etiqueta)) {
      const match = valor.match(/^(.*?)\s+(?:#|no\.?\s*|num\.?\s*)([\w/-]+)\s*$/i);
      resultado.direccion.calle = match ? match[1].trim() : valor;
      if (match) resultado.direccion.numero_exterior = match[2];
    }
    else if (/^(numero exterior|num exterior|# casa|numero de casa|numero|casa)$/.test(etiqueta)) resultado.direccion.numero_exterior = valor;
    else if (/^(numero interior|num interior|interior)$/.test(etiqueta)) resultado.direccion.numero_interior = valor;
    else if (/^(colonia|col)$/.test(etiqueta)) resultado.direccion.colonia = valor;
    else if (/^(c p|cp|codigo postal|codigo p)$/.test(etiqueta)) resultado.direccion.codigo_postal = valor;
    else if (/^(ciudad|localidad)$/.test(etiqueta)) resultado.direccion.ciudad = valor;
    else if (/^(municipio|delegacion|delegacion municipio)$/.test(etiqueta)) resultado.direccion.delegacion = valor;
    else if (/^(estado)$/.test(etiqueta)) resultado.direccion.estado = valor;
    else if (/^(referencia|referencias|referencia domicilio)$/.test(etiqueta)) resultado.referencia = valor;
  }
  // No inferimos municipio, estado ni datos faltantes.
  return resultado;
}

const remitente = { nombre: "Viridiana Malaga", telefono: "6442350116", rfc: "" };

// Coordenadas calibradas sobre la plantilla A4 REMISIÓN - MATRIZ.
// Valores proporcionales desde la esquina superior izquierda.
const posiciones = {
  remitenteNombre: { x: 0.209, y: 0.128, ancho: 0.745 },
  remitenteTelefono: { x: 0.225, y: 0.180, ancho: 0.730 },
  destinatarioNombre: { x: 0.210, y: 0.240, ancho: 0.745 },
  destinatarioTelefono: { x: 0.226, y: 0.265, ancho: 0.728 },
  calle: { x: 0.105, y: 0.291, ancho: 0.540 },
  numeroExterior: { x: 0.749, y: 0.291, ancho: 0.074 },
  numeroInterior: { x: 0.914, y: 0.291, ancho: 0.052 },
  colonia: { x: 0.118, y: 0.315, ancho: 0.461 },
  delegacion: { x: 0.728, y: 0.315, ancho: 0.102 },
  codigoPostal: { x: 0.882, y: 0.315, ancho: 0.082 },
  ciudad: { x: 0.105, y: 0.341, ancho: 0.557 },
  estado: { x: 0.757, y: 0.341, ancho: 0.205 },
};

export default function RemisionesPage() {
  const [modoCaptura, setModoCaptura] = useState<"registrado" | "manual">("registrado");
  const [nombreManual, setNombreManual] = useState("");
  const [telefonoManual, setTelefonoManual] = useState("");
  const [mensajeWhatsApp, setMensajeWhatsApp] = useState("");
  const [referenciaManual, setReferenciaManual] = useState("");
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

  function cambiarModo(modo: "registrado" | "manual") {
    seleccionActual.current += 1;
    setModoCaptura(modo);
    setIdSeleccionado("");
    setDireccion({ ...direccionVacia });
    setCargandoDireccion(false);
    setError("");
    setMensaje("");
  }

  function interpretarWhatsApp() {
    const datos = extraerDatosWhatsApp(mensajeWhatsApp);
    setNombreManual(datos.nombre);
    setTelefonoManual(datos.telefono);
    setDireccion(datos.direccion);
    setReferenciaManual(datos.referencia);
    setError("");
    setMensaje("Datos identificados. Revisa y completa los campos antes de generar la remisión.");
  }

  async function descargarRemision(modo: "descargar" | "imprimir" = "descargar") {
    const esManual = modoCaptura === "manual";
    if ((!esManual && !seleccionado) || cargandoDireccion || guardando || generandoPdf) return;
    const nombreDestinatario = esManual ? nombreManual.trim() : (seleccionado?.nombre ?? "");
    const telefonoDestinatario = esManual ? telefonoManual.trim() : (seleccionado?.telefono ?? "");
    if (!nombreDestinatario || !telefonoDestinatario || !direccion.calle.trim() || !direccion.colonia.trim() || !direccion.codigo_postal.trim() || !direccion.ciudad.trim() || !direccion.estado.trim()) {
      setError("Completa nombre, teléfono, calle, colonia, código postal, ciudad y estado antes de generar la remisión.");
      return;
    }
    setMensaje("");
    setError("");
    // Abrir la ventana desde el clic para que el navegador no bloquee la impresión.
    const ventanaImpresion = modo === "imprimir" ? window.open("", "_blank") : null;
    if (modo === "imprimir" && !ventanaImpresion) {
      setError("El navegador bloqueó la ventana. Permite ventanas emergentes para imprimir.");
      return;
    }
    if (ventanaImpresion) {
      ventanaImpresion.document.title = "Preparando remisión VIPACK";
      ventanaImpresion.document.body.textContent = "Preparando la remisión para imprimir...";
    }
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
        const limpio = textoSeguroPdf(valor);
        if (!limpio) return;
        const anchoDisponible = width * p.ancho;
        let tamano = 11;
        while (tamano > 6 && fuente.widthOfTextAtSize(limpio, tamano) > anchoDisponible) {
          tamano -= 0.25;
        }
        // Nunca invadir el siguiente campo; acortar si el texto no cabe.
        let texto = limpio;
        while (texto && fuente.widthOfTextAtSize(texto, tamano) > anchoDisponible) {
          texto = texto.slice(0, -1);
        }
        pagina.drawText(texto, {
          x: width * p.x,
          // Ajuste fino: baja el texto ~2.4 mm para centrarlo sobre las líneas.
          y: height * (1 - p.y - 0.008),
          size: tamano,
          font: fuente,
          color: rgb(0.05, 0.20, 0.48),
        });
      };
      dibujar(remitente.nombre, posiciones.remitenteNombre);
      dibujar(remitente.telefono, posiciones.remitenteTelefono);
      dibujar(nombreDestinatario, posiciones.destinatarioNombre);
      dibujar(telefonoParaRemision(telefonoDestinatario), posiciones.destinatarioTelefono);
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
      if (modo === "imprimir" && ventanaImpresion) {
        // Abrir el PDF en un marco e intentar mostrar directamente el diálogo
        // de impresión. Algunos navegadores bloquean la impresión automática
        // de PDF: se conserva un botón alternativo dentro de la ventana.
        const documento = ventanaImpresion.document;
        documento.body.replaceChildren();
        documento.title = "Imprimir remisión VIPACK";
        documento.body.style.cssText = "margin:0;font-family:Arial,sans-serif;background:#f1f5f9";
        const barra = documento.createElement("div");
        barra.style.cssText = "padding:12px;display:flex;gap:12px;align-items:center;background:white";
        const boton = documento.createElement("button");
        boton.textContent = "🖨️ Imprimir remisión";
        boton.style.cssText = "padding:10px 16px;background:#0755aa;color:white;border:0;border-radius:7px;cursor:pointer";
        const marco = documento.createElement("iframe");
        marco.title = "Remisión VIPACK";
        marco.style.cssText = "width:100%;height:calc(100vh - 62px);border:0";
        marco.src = url;
        const imprimir = () => {
          try {
            marco.contentWindow?.focus();
            marco.contentWindow?.print();
          } catch {
            // Si el visor PDF no permite imprimir desde el iframe,
            // el usuario puede usar el botón de impresión del visor.
            ventanaImpresion.focus();
            ventanaImpresion.print();
          }
        };
        boton.onclick = imprimir;
        barra.appendChild(boton);
        documento.body.append(barra, marco);
        marco.onload = () => {
          ventanaImpresion.focus();
          ventanaImpresion.setTimeout(imprimir, 700);
        };
        setMensaje("Se solicitó la impresión de la remisión. Si no aparece el cuadro de impresión, usa el botón de la nueva ventana.");
        // Mantener el PDF disponible mientras se utiliza la ventana.
        window.setTimeout(() => URL.revokeObjectURL(url), 300000);
      } else {
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `remision-vipack-${esManual ? "manual" : `cliente-${seleccionado?.id_cliente}`}.pdf`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        setMensaje("Remisión descargada. Revisa los datos antes de imprimir.");
      }
    } catch (err) {
      if (ventanaImpresion && !ventanaImpresion.closed) ventanaImpresion.close();
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 18 }}>
          <label><input type="radio" name="modo-remision" checked={modoCaptura === "registrado"} onChange={() => cambiarModo("registrado")} /> Seleccionar cliente registrado</label>
          <label><input type="radio" name="modo-remision" checked={modoCaptura === "manual"} onChange={() => cambiarModo("manual")} /> Capturar destinatario manualmente</label>
        </div>
        {modoCaptura === "registrado" && <>
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
        </>}
        {(modoCaptura === "manual" || seleccionado) && (
          <div style={{ marginTop: 24 }}>
            {modoCaptura === "manual" && <div style={{ marginBottom: 20, padding: 16, background: "#eef2ff", borderRadius: 10 }}>
              <label htmlFor="whatsapp-datos" style={{ fontWeight: 700 }}>Pegar mensaje de WhatsApp (opcional)</label>
              <textarea id="whatsapp-datos" value={mensajeWhatsApp} onChange={(e) => setMensajeWhatsApp(e.target.value)} rows={7}
                placeholder={"Nombre: ...\nCalle y número: ...\nColonia: ...\nC.P.: ...\nCiudad: ...\nEstado: ...\nTeléfono: ..."}
                style={{ ...inputStyle, marginTop: 8, resize: "vertical" }} />
              <button type="button" onClick={interpretarWhatsApp}
                style={{ marginTop: 10, padding: "10px 16px", background: "#4338ca", color: "white", border: "none", borderRadius: 8, fontWeight: 700 }}>
                Llenar campos desde WhatsApp
              </button>
              <p style={{ fontSize: 12, marginTop: 8, color: "#475569" }}>Revisa todos los datos: las etiquetas no reconocidas no se completan automáticamente.</p>
            </div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div><label>Nombre completo</label><input style={inputStyle} value={modoCaptura === "manual" ? nombreManual : (seleccionado?.nombre ?? "")} readOnly={modoCaptura === "registrado"} onChange={(e) => setNombreManual(e.target.value)} /></div>
              <div><label>Teléfono</label><input style={inputStyle} value={modoCaptura === "manual" ? telefonoManual : (seleccionado?.telefono ?? "")} readOnly={modoCaptura === "registrado"} onChange={(e) => setTelefonoManual(e.target.value)} /></div>
              {campos.map((campo) => (
                <div key={campo.key}>
                  <label htmlFor={`direccion-${campo.key}`}>{campo.label}</label>
                  <input id={`direccion-${campo.key}`} style={inputStyle} value={direccion[campo.key]}
                    onChange={(e) => setDireccion((actual) => ({ ...actual, [campo.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            {modoCaptura === "manual" && <div style={{ marginTop: 16 }}>
              <label htmlFor="referencia-manual">Referencia (solo consulta; la plantilla actual no tiene campo de referencia)</label>
              <input id="referencia-manual" style={{ ...inputStyle, marginTop: 6 }} value={referenciaManual} onChange={(e) => setReferenciaManual(e.target.value)} />
            </div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
              {modoCaptura === "registrado" && <button type="button" onClick={() => void guardarDireccion()} disabled={guardando || cargandoDireccion || generandoPdf}
                style={{ padding: "12px 22px", background: "#0f766e", color: "white", border: "none", borderRadius: 8, fontWeight: 700 }}>
                {guardando ? "Guardando..." : "Guardar dirección"}
              </button>}
              <button type="button" onClick={() => void descargarRemision("descargar")}
                disabled={generandoPdf || cargandoDireccion || guardando}
                style={{ padding: "12px 22px", background: "#0755aa", color: "white", border: "none", borderRadius: 8, fontWeight: 700 }}>
                {generandoPdf ? "Generando PDF..." : "Descargar remisión PDF"}
              </button>
              <button type="button" onClick={() => void descargarRemision("imprimir")}
                disabled={generandoPdf || cargandoDireccion || guardando}
                style={{ padding: "12px 22px", background: "#374151", color: "white", border: "none", borderRadius: 8, fontWeight: 700 }}>
                {generandoPdf ? "Preparando PDF..." : "🖨️ Imprimir remisión"}
              </button>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 12 }}>
              Se utiliza la plantilla original; no se rellenan mercancía, costos ni otros apartados.
              {modoCaptura === "manual" ? " Esta captura no crea clientes ni guarda destinatarios en Supabase." : ""}
            </p>
          </div>
        )}
        {mensaje && <p role="status" style={{ color: "#15803d", marginTop: 16 }}>{mensaje}</p>}
        {error && <p role="alert" style={{ color: "#dc2626", marginTop: 16 }}>{error}</p>}
      </section>
    </main>
  );
}