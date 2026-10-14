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
  const [cajas, setCajas] = useState("1");
  const [contenido, setContenido] = useState("");
  const [peso, setPeso] = useState("");
  const [servicio, setServicio] = useState("Terrestre");
  const [costo, setCosto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [generandoPdf, setGenerandoPdf] = useState(false);



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



  async function generarRemisionPdf() {
    if (!seleccionado || cargandoDireccion || guardando || generandoPdf) return;
    setError("");
    setMensaje("");
    const totalCajas = Number(cajas);
    if (!Number.isInteger(totalCajas) || totalCajas < 1 || totalCajas > 999) {
      setError("Ingresa una cantidad de cajas válida (1 a 999).");
      return;
    }
    if (!contenido.trim()) {
      setError("Indica el contenido de la mercancía.");
      return;
    }
    if (!direccion.calle.trim() || !direccion.numero_exterior.trim() || !direccion.colonia.trim()
      || !/^\d{5}$/.test(direccion.codigo_postal.trim()) || !direccion.ciudad.trim() || !direccion.estado.trim()) {
      setError("Completa calle, número exterior, colonia, código postal, ciudad y estado antes de generar la remisión.");
      return;
    }
    const pesoNum = peso.trim() ? Number(peso) : null;
    const costoNum = costo.trim() ? Number(costo) : null;
    if (pesoNum !== null && (!Number.isFinite(pesoNum) || pesoNum < 0)) {
      setError("El peso no es válido."); return;
    }
    if (costoNum !== null && (!Number.isFinite(costoNum) || costoNum < 0)) {
      setError("El costo no es válido."); return;
    }

    setGenerandoPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" });
      const ancho = pdf.internal.pageSize.getWidth();
      const margen = 18;
      const contenidoAncho = ancho - margen * 2;
      const fecha = new Date();
      // Folio temporal para documentos descargables. No se registra en Supabase.
      const folio = `REM-${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, "0")}${String(fecha.getDate()).padStart(2, "0")}-${fecha.getTime().toString(36).toUpperCase()}`;
      const fechaTexto = fecha.toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" });
      let y = 22;
      const linea = (etiqueta: string, valor: string, minAlto = 7) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(`${etiqueta}:`, margen, y);
        pdf.setFont("helvetica", "normal");
        const offset = Math.min(55, Math.max(35, etiqueta.length * 2.2 + 7));
        const renglones = pdf.splitTextToSize(valor || "—", contenidoAncho - offset);
        pdf.text(renglones, margen + offset, y);
        y += Math.max(minAlto, renglones.length * 5 + 2);
      };
      const titulo = (texto: string) => {
        y += 5;
        pdf.setFillColor(232, 242, 250);
        pdf.rect(margen, y - 6, contenidoAncho, 10, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(12, 39, 77);
        pdf.text(texto, margen + 3, y);
        pdf.setTextColor(0, 0, 0);
        y += 11;
      };
      pdf.setFillColor(7, 32, 73);
      pdf.rect(0, 0, ancho, 33, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.text("VIPACK ENVIOS", margen, 17);
      pdf.setFontSize(11);
      pdf.text("REMISION DE MERCANCIA", margen, 25);
      pdf.setTextColor(0, 0, 0);
      y = 43;
      linea("Folio", folio);
      linea("Fecha", fechaTexto);
      titulo("REMITENTE");
      linea("Nombre", "Viridiana Malaga");
      linea("Telefono", "6442350116");
      titulo("DESTINATARIO");
      linea("Cliente", `${seleccionado.nombre} (ID ${seleccionado.id_cliente})`);
      linea("Telefono", seleccionado.telefono || "No registrado");
      const calle = [direccion.calle, `No. ${direccion.numero_exterior}`, direccion.numero_interior ? `Int. ${direccion.numero_interior}` : ""].filter(Boolean).join(" ");
      linea("Domicilio", calle);
      linea("Colonia", direccion.colonia);
      linea("Municipio", direccion.delegacion || "—");
      linea("Ubicacion", [direccion.ciudad, direccion.estado, `C.P. ${direccion.codigo_postal}`].filter(Boolean).join(", "));
      titulo("DATOS DEL ENVIO");
      linea("Cajas", String(totalCajas));
      linea("Servicio", servicio);
      linea("Peso", pesoNum === null ? "No indicado" : `${pesoNum.toLocaleString("es-MX")} kg`);
      linea("Costo", costoNum === null ? "No indicado" : costoNum.toLocaleString("es-MX", { style: "currency", currency: "MXN" }));
      linea("Contenido", contenido.trim());
      if (observaciones.trim()) linea("Notas", observaciones.trim());
      if (y > 243) pdf.addPage();
      const firmasY = Math.max(y + 20, 246);
      const posY = firmasY > 258 ? 253 : firmasY;
      pdf.setDrawColor(130, 145, 160);
      pdf.line(margen, posY, margen + 75, posY);
      pdf.line(ancho - margen - 75, posY, ancho - margen, posY);
      pdf.setFontSize(9);
      pdf.text("Entrega / responsable", margen + 15, posY + 5);
      pdf.text("Recibe / firma", ancho - margen - 55, posY + 5);
      pdf.setFontSize(8);
      pdf.setTextColor(90, 100, 110);
      pdf.text("Documento generado por VIPACK. No sustituye la guia de paqueteria ni el comprobante fiscal.", margen, 274);
      pdf.save(`${folio}-cliente-${seleccionado.id_cliente}.pdf`);
      setMensaje("Remisión PDF generada. Puedes abrirla e imprimirla desde tus descargas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    } finally {
      setGenerandoPdf(false);
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
            <section style={{ marginTop: 32, padding: 20, background: "#f1f5f9", borderRadius: 12, color: "#0f172a" }}>
              <h3 style={{ fontSize: 19, fontWeight: 700 }}>Generar remisión PDF</h3>
              <p style={{ marginTop: 8, color: "#475569", fontSize: 14 }}>
                Completa los datos del envío. El PDF se descargará sin modificar la dirección ni crear registros en Supabase.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
                <div><label htmlFor="rem-cajas">Número de cajas</label><input id="rem-cajas" type="number" min="1" max="999" style={inputStyle} value={cajas} onChange={(e) => setCajas(e.target.value)} /></div>
                <div><label htmlFor="rem-servicio">Servicio</label><select id="rem-servicio" style={inputStyle} value={servicio} onChange={(e) => setServicio(e.target.value)}><option>Terrestre</option><option>Aéreo</option><option>Otro</option></select></div>
                <div><label htmlFor="rem-peso">Peso total (kg, opcional)</label><input id="rem-peso" type="number" min="0" step="0.01" style={inputStyle} value={peso} onChange={(e) => setPeso(e.target.value)} /></div>
                <div><label htmlFor="rem-costo">Costo total (MXN, opcional)</label><input id="rem-costo" type="number" min="0" step="0.01" style={inputStyle} value={costo} onChange={(e) => setCosto(e.target.value)} /></div>
              </div>
              <div style={{ marginTop: 16 }}><label htmlFor="rem-contenido">Contenido de la mercancía</label><textarea id="rem-contenido" rows={3} maxLength={700} style={{ ...inputStyle, resize: "vertical" }} value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder="Ej. Ropa y accesorios" /></div>
              <div style={{ marginTop: 16 }}><label htmlFor="rem-observaciones">Observaciones (opcional)</label><textarea id="rem-observaciones" rows={2} maxLength={400} style={{ ...inputStyle, resize: "vertical" }} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></div>
              <button type="button" onClick={generarRemisionPdf} disabled={generandoPdf || cargandoDireccion || guardando} style={{ marginTop: 18, padding: "12px 22px", borderRadius: 8, background: "#0755aa", color: "white", border: "none", fontWeight: 700, cursor: "pointer" }}>{generandoPdf ? "Generando PDF..." : "Descargar remisión PDF"}</button>
            </section>
          </div>
        )}

        {mensaje && <p role="status" style={{ color: "#15803d", marginTop: 16 }}>{mensaje}</p>}

        {error && <p role="alert" style={{ color: "#dc2626", marginTop: 16 }}>{error}</p>}

      </section>

    </main>

  );

}