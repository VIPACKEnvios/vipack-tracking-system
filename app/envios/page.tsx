"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function EnviosPage() {
  const [envios, setEnvios] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarEntregados, setMostrarEntregados] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormularioManual, setMostrarFormularioManual] = useState(false);

  const [guiaManual, setGuiaManual] = useState({
    cliente: "",
    telefono_whatsapp: "",
    pedido: "",
    guia: "",
    paqueteria: "DHL",
  });

  const textoNormalizado = (estado: string) => {
    const texto = String(estado || "").toLowerCase();

    if (texto.includes("entregado")) return "Entregado";
    if (texto.includes("reparto") || texto.includes("domicilio")) return "En reparto";
    if (texto.includes("tránsito") || texto.includes("transito")) return "En tránsito";
    if (texto.includes("recolectado")) return "Recolectado";
    if (texto.includes("espera") || texto.includes("registrado")) return "En espera";
    if (texto.includes("reporte")) return "Reporte";

    return estado || "Sin estado";
  };

  const esHoy = (fecha: string) => {
    if (!fecha) return false;
    const f = new Date(fecha);
    const h = new Date();

    return (
      f.getFullYear() === h.getFullYear() &&
      f.getMonth() === h.getMonth() &&
      f.getDate() === h.getDate()
    );
  };

  const entregadoMasDe2Dias = (envio: any) => {
    const estado = textoNormalizado(envio.estatus_actual);

    if (estado !== "Entregado") return false;
    if (!envio.fecha_ultima_revision) return false;

    const fecha = new Date(envio.fecha_ultima_revision);
    const ahora = new Date();
    const diferenciaDias =
      (ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24);

    return diferenciaDias > 2;
  };

  const cargarEnvios = async () => {
    setCargando(true);

    const { data, error } = await supabase
      .from("envios")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      alert("Error cargando envíos: " + error.message);
    } else {
      setEnvios(data || []);
    }

    setCargando(false);
  };

  useEffect(() => {
    cargarEnvios();
  }, []);

  const enviosFiltrados = envios.filter((envio) => {
    const estado = textoNormalizado(envio.estatus_actual);

    if (!mostrarEntregados && estado === "Entregado") return false;
    if (entregadoMasDe2Dias(envio)) return false;

    const textoBusqueda = busqueda.toLowerCase().trim();

    if (!textoBusqueda) return true;

    const contenido = `
      ${envio.id}
      ${envio.cliente}
      ${envio.telefono_whatsapp}
      ${envio.pedido}
      ${envio.guia}
      ${envio.paqueteria}
      ${envio.estatus_actual}
    `.toLowerCase();

    return contenido.includes(textoBusqueda);
  });

  const colorEstado = (estado: string) => {
    const normal = textoNormalizado(estado);

    if (normal === "Entregado") return "#15803d";
    if (normal === "En reparto") return "#ea580c";
    if (normal === "En tránsito") return "#ca8a04";
    if (normal === "Recolectado") return "#2563eb";
    if (normal === "En espera") return "#4b5563";
    if (normal === "Reporte") return "#dc2626";

    return "#6b7280";
  };

  const resumen = enviosFiltrados.reduce(
    (acc, envio) => {
      const estado = textoNormalizado(envio.estatus_actual);

      acc.total += 1;

      if (estado === "Recolectado") acc.recolectado += 1;
      else if (estado === "En tránsito") acc.transito += 1;
      else if (estado === "En reparto") acc.reparto += 1;
      else if (estado === "En espera") acc.espera += 1;
      else if (estado === "Entregado") acc.entregado += 1;
      else if (estado === "Reporte") acc.reporte += 1;
      else acc.otro += 1;

      return acc;
    },
    {
      total: 0,
      recolectado: 0,
      transito: 0,
      reparto: 0,
      espera: 0,
      entregado: 0,
      reporte: 0,
      otro: 0,
    }
  );

  const dashboard = envios.reduce(
    (acc, envio) => {
      const estado = textoNormalizado(envio.estatus_actual);
      const actualizadoHoy = esHoy(envio.fecha_ultima_revision);

      if (actualizadoHoy) acc.actualizadosHoy += 1;
      if (actualizadoHoy && envio.ultimo_whatsapp) acc.whatsappsHoy += 1;
      if (estado === "Entregado" && actualizadoHoy) acc.entregadosHoy += 1;
      if (estado !== "Entregado") acc.pendientes += 1;

      return acc;
    },
    {
      whatsappsHoy: 0,
      actualizadosHoy: 0,
      entregadosHoy: 0,
      pendientes: 0,
    }
  );

  const formatearFecha = (fecha: string) => {
    if (!fecha) return "Sin actualizar";

    const fechaObj = new Date(fecha);

    if (isNaN(fechaObj.getTime())) return "Sin actualizar";

    const ahora = new Date();
    const diferenciaMs = ahora.getTime() - fechaObj.getTime();
    const minutos = Math.floor(diferenciaMs / 60000);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);

    if (minutos < 1) return "Hace unos segundos";
    if (minutos < 60) return `Hace ${minutos} min`;
    if (horas < 24) return `Hace ${horas} h`;
    if (dias === 1) return "Ayer";
    if (dias < 7) return `Hace ${dias} días`;

    return fechaObj.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const actualizarYEnviarWhatsApp = async (id: number, estado: string) => {
    const confirmar = confirm(
      `¿Actualizar a "${estado}" y enviar WhatsApp al cliente?`
    );

    if (!confirmar) return;

    setProcesandoId(id);

    const { error } = await supabase
      .from("envios")
      .update({
        estatus_actual: estado,
        ultimo_estado_enviado: estado,
        fecha_ultima_revision: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert("Error actualizando estado: " + error.message);
      setProcesandoId(null);
      return;
    }

    const response = await fetch("/api/enviar-actualizacion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    const data = await response.json();

    if (data.success) {
      alert(`Estado actualizado y WhatsApp enviado: ${estado}`);
    } else {
      alert(
        "El estado sí se actualizó, pero falló WhatsApp: " +
          (data.error || "Error desconocido")
      );
    }

    setProcesandoId(null);
    cargarEnvios();
  };

  const enviarWhatsAppSinCambiarEstado = async (id: number) => {
    const confirmar = confirm("¿Enviar WhatsApp con el estado actual?");
    if (!confirmar) return;

    setProcesandoId(id);

    const response = await fetch("/api/enviar-actualizacion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    const data = await response.json();

    if (data.success) {
      await supabase
        .from("envios")
        .update({
          fecha_ultima_revision: new Date().toISOString(),
        })
        .eq("id", id);

      alert("WhatsApp enviado correctamente");
    } else {
      alert("Error enviando WhatsApp: " + (data.error || "Error desconocido"));
    }

    setProcesandoId(null);
    cargarEnvios();
  };

  const guardarGuiaManual = async () => {
  if (!guiaManual.cliente || !guiaManual.telefono_whatsapp || !guiaManual.guia) {
    alert("Falta cliente, teléfono o guía");
    return;
  }

  const telefonoLimpio = guiaManual.telefono_whatsapp
    .replace(/\D/g, "")
    .trim();

  const { data: existente } = await supabase
    .from("envios")
    .select("id")
    .eq("guia", guiaManual.guia.trim())
    .limit(1);

  if (existente && existente.length > 0) {
    alert("Esta guía ya existe");
    return;
  }

  const { error } = await supabase.from("envios").insert([
    {
      cliente: guiaManual.cliente,
      telefono_whatsapp: telefonoLimpio,
      pedido: guiaManual.pedido || "MANUAL",
      guia: guiaManual.guia.trim(),
      paqueteria: guiaManual.paqueteria,
      pdf: "",
      estatus_actual: "En espera",
      ultimo_whatsapp: "",
      ultimo_estado_enviado: "",
      entregado: false,
      fecha_envio: new Date().toISOString(),
      fecha_ultima_revision: new Date().toISOString(),
    },
  ]);

  if (error) {
    alert("Error guardando guía: " + error.message);
    return;
  }

  alert("✅ Guía guardada. Ahora puedes mandar WhatsApp cuando cambies el estado.");

  setGuiaManual({
    cliente: "",
    telefono_whatsapp: "",
    pedido: "",
    guia: "",
    paqueteria: "DHL",
  });

  setMostrarFormularioManual(false);
  cargarEnvios();
};

  const estadosDisponibles = [
    { nombre: "Recolectado", color: "#2563eb" },
    { nombre: "En tránsito", color: "#ca8a04" },
    { nombre: "En reparto", color: "#ea580c" },
    { nombre: "En espera", color: "#4b5563" },
    { nombre: "Entregado", color: "#15803d" },
  ];

  const botonBase = {
    color: "white",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "none",
    fontWeight: "bold" as const,
    cursor: "pointer",
    fontSize: "12px",
  };

  const th = {
    padding: "10px",
    textAlign: "left" as const,
    borderBottom: "1px solid #ddd",
    whiteSpace: "nowrap" as const,
  };

  const td = {
    padding: "8px",
    borderBottom: "1px solid #ddd",
    verticalAlign: "top" as const,
    whiteSpace: "nowrap" as const,
    color: "#111827",
    background: "white",
    fontWeight: "600",
  };

  const tarjetaResumen = (titulo: string, valor: number, color: string) => (
    <div
      style={{
        background: color,
        color: "white",
        padding: "12px 16px",
        borderRadius: "12px",
        minWidth: "130px",
        fontWeight: "bold",
        boxShadow: "0 2px 8px rgba(0,0,0,.12)",
      }}
    >
      <div style={{ fontSize: "13px" }}>{titulo}</div>
      <div style={{ fontSize: "24px" }}>{valor}</div>
    </div>
  );

  return (
    <div
      style={{
        padding: "20px",
        background: "#f3f4f6",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0 0 10px rgba(0,0,0,.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, color: "#072c74" }}>
              Tabla de envíos VIPACK
            </h1>
            <p style={{ marginTop: "5px", color: "#555" }}>
              Buscador, productividad y seguimiento manual con WhatsApp.
            </p>
          </div>

          <button
            onClick={() => (window.location.href = "/")}
            style={{
              background: "#072c74",
              color: "white",
              border: "none",
              padding: "12px 20px",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: "bold",
              height: "45px",
            }}
          >
            Regresar
          </button>
        </div>

        <h3 style={{ marginBottom: "10px", color: "#072c74" }}>
          Dashboard de productividad
        </h3>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          {tarjetaResumen("WhatsApps hoy", dashboard.whatsappsHoy, "#047857")}
          {tarjetaResumen("Actualizados hoy", dashboard.actualizadosHoy, "#2563eb")}
          {tarjetaResumen("Entregados hoy", dashboard.entregadosHoy, "#15803d")}
          {tarjetaResumen("Pendientes", dashboard.pendientes, "#ca8a04")}
        </div>

        <h3 style={{ marginBottom: "10px", color: "#072c74" }}>
          Resumen de estados
        </h3>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          {tarjetaResumen("Total", resumen.total, "#072c74")}
          {tarjetaResumen("Recolectado", resumen.recolectado, "#2563eb")}
          {tarjetaResumen("En tránsito", resumen.transito, "#ca8a04")}
          {tarjetaResumen("En reparto", resumen.reparto, "#ea580c")}
          {tarjetaResumen("En espera", resumen.espera, "#4b5563")}
          {tarjetaResumen("Entregado", resumen.entregado, "#15803d")}
          {tarjetaResumen("Reporte", resumen.reporte, "#dc2626")}
        </div>

        <div
          style={{
            marginBottom: "15px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Buscar cliente, guía, teléfono, pedido o paquetería..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              padding: "10px 12px",
              border: "1px solid #ccc",
              borderRadius: "8px",
              minWidth: "360px",
              fontWeight: "bold",
              color: "#111827",
              background: "white",
            }}
          />

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: "bold",
            }}
          >
            <input
              type="checkbox"
              checked={mostrarEntregados}
              onChange={(e) => setMostrarEntregados(e.target.checked)}
            />
            Mostrar entregados recientes
          </label>

          <button
            onClick={cargarEnvios}
            style={{
              background: "#374151",
              color: "white",
              border: "none",
              padding: "8px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Actualizar tabla
          </button>

          <button
            onClick={() => setMostrarFormularioManual(!mostrarFormularioManual)}
            style={{
              background: "#ea580c",
              color: "white",
              border: "none",
              padding: "8px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            + Agregar guía manual
          </button>
        </div>

        {mostrarFormularioManual && (
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #ddd",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "18px",
            }}
          >
            <h3 style={{ color: "#072c74", marginTop: 0 }}>
              Agregar guía manual sin PDF
            </h3>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <input
                placeholder="Cliente"
                value={guiaManual.cliente}
                onChange={(e) =>
                  setGuiaManual({
                    ...guiaManual,
                    cliente: e.target.value,
                  })
                }
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                }}
              />

              <input
                placeholder="Teléfono"
                value={guiaManual.telefono_whatsapp}
                onChange={(e) =>
                  setGuiaManual({
                    ...guiaManual,
                    telefono_whatsapp: e.target.value,
                  })
                }
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                }}
              />

              <input
                placeholder="Pedido/Folio"
                value={guiaManual.pedido}
                onChange={(e) =>
                  setGuiaManual({
                    ...guiaManual,
                    pedido: e.target.value,
                  })
                }
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                }}
              />

              <input
                placeholder="Guía"
                value={guiaManual.guia}
                onChange={(e) =>
                  setGuiaManual({
                    ...guiaManual,
                    guia: e.target.value,
                  })
                }
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                }}
              />

              <select
                value={guiaManual.paqueteria}
                onChange={(e) =>
                  setGuiaManual({
                    ...guiaManual,
                    paqueteria: e.target.value,
                  })
                }
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                }}
              >
                <option value="DHL">DHL</option>
                <option value="ESTAFETA">ESTAFETA</option>
                <option value="FEDEX">FEDEX</option>
                <option value="PAQUETEXPRESS">PAQUETEXPRESS</option>
              </select>

              <button
                onClick={guardarGuiaManual}
                style={{
                  background: "#047857",
                  color: "white",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Guardar Guía
              </button>
            </div>
          </div>
        )}

        <p style={{ color: "#555", fontWeight: "bold" }}>
          Nota: los entregados con más de 2 días se ocultan automáticamente.
        </p>

        {cargando ? (
          <h3>Cargando envíos...</h3>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ background: "#072c74", color: "white" }}>
                  <th style={th}>ID</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Teléfono</th>
                  <th style={th}>Pedido</th>
                  <th style={th}>Guía</th>
                  <th style={th}>Paquetería</th>
                  <th style={th}>Estado</th>
                  <th style={th}>Último WhatsApp</th>
                  <th style={th}>Última actualización</th>
                  <th style={th}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {enviosFiltrados.map((envio) => {
                  const estadoActual = textoNormalizado(envio.estatus_actual);
                  const deshabilitado = procesandoId === envio.id;

                  return (
                    <tr key={envio.id}>
                      <td style={td}>{envio.id}</td>
                      <td style={td}>{envio.cliente}</td>
                      <td style={td}>{envio.telefono_whatsapp}</td>
                      <td style={td}>{envio.pedido}</td>
                      <td style={td}>{envio.guia}</td>
                      <td style={td}>{envio.paqueteria}</td>

                      <td style={td}>
                        <span
                          style={{
                            background: colorEstado(envio.estatus_actual),
                            color: "white",
                            padding: "6px 10px",
                            borderRadius: "999px",
                            fontWeight: "bold",
                            display: "inline-block",
                          }}
                        >
                          {estadoActual}
                        </span>
                      </td>

                      <td style={td}>{envio.ultimo_whatsapp}</td>

                      <td style={td}>
                        {formatearFecha(envio.fecha_ultima_revision)}
                      </td>

                      <td style={td}>
                        <div
                          style={{
                            display: "flex",
                            gap: "5px",
                            flexWrap: "wrap",
                            minWidth: "520px",
                          }}
                        >
                          {estadosDisponibles
                            .filter((estado) => estado.nombre !== estadoActual)
                            .map((estado) => (
                              <button
                                key={estado.nombre}
                                disabled={deshabilitado}
                                style={{
                                  ...botonBase,
                                  background: estado.color,
                                  opacity: deshabilitado ? 0.6 : 1,
                                }}
                                onClick={() =>
                                  actualizarYEnviarWhatsApp(
                                    envio.id,
                                    estado.nombre
                                  )
                                }
                              >
                                {estado.nombre} + WhatsApp
                              </button>
                            ))}

                          <button
                            disabled={deshabilitado}
                            style={{
                              ...botonBase,
                              background: "#047857",
                              opacity: deshabilitado ? 0.6 : 1,
                            }}
                            onClick={() =>
                              enviarWhatsAppSinCambiarEstado(envio.id)
                            }
                          >
                            Solo WhatsApp
                          </button>
                        </div>

                        {deshabilitado && (
                          <p style={{ margin: "6px 0 0", color: "#555" }}>
                            Procesando...
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {enviosFiltrados.length === 0 && (
              <h3 style={{ color: "#555" }}>
                No hay envíos que coincidan con el filtro.
              </h3>
            )}
          </div>
        )}
      </div>
    </div>
  );
}