"use client";

import { useEffect, useState } from "react";

type Consentimiento = {
  telefono_whatsapp: string | null;
  whatsapp_autorizado: boolean;
  fecha_autorizacion: string | null;
  origen_autorizacion: string | null;
  evidencia_autorizacion: string | null;
};

export default function ConsentimientoWhatsApp({
  guia,
}: {
  guia: string;
}) {
  const [datos, setDatos] = useState<Consentimiento | null>(null);
  const [origen, setOrigen] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function consultar() {
    setCargando(true);
    setError("");

    try {
      const respuesta = await fetch(
        `/api/guias-paquexpress/consentimiento?guia=${encodeURIComponent(guia)}`,
        { cache: "no-store" }
      );

      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.success) {
        throw new Error(resultado.error || "Error consultando autorización");
      }

      setDatos(resultado.consentimiento);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void consultar();
  }, [guia]);

  async function guardar() {
    if (!confirmado || !origen.trim() || !evidencia.trim()) {
      setError("Confirma la autorización e indica origen y evidencia.");
      return;
    }

    if (!window.confirm("¿Verificaste que el destinatario autorizó recibir notificaciones por WhatsApp en este número?")) {
      return;
    }

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const respuesta = await fetch("/api/guias-paquexpress/consentimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guia,
          origen: origen.trim(),
          evidencia: evidencia.trim(),
        }),
      });

      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.success) {
        throw new Error(resultado.error || "No se pudo registrar autorización");
      }

      setMensaje("Autorización registrada correctamente.");
      setConfirmado(false);
      await consultar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return <p className="mt-3 text-sm text-gray-600">Consultando autorización...</p>;
  }

  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-white p-4">
      <h4 className="font-semibold text-violet-950">
        Autorización de WhatsApp
      </h4>

      {datos?.whatsapp_autorizado ? (
        <div className="mt-3 space-y-1 text-sm text-emerald-800">
          <p className="font-semibold">Autorización registrada</p>
          <p>Origen: {datos.origen_autorizacion}</p>
          <p>Fecha: {datos.fecha_autorizacion ? new Date(datos.fecha_autorizacion).toLocaleString("es-MX") : "Sin fecha"}</p>
        </div>
      ) : !datos?.telefono_whatsapp ? (
        <p className="mt-3 text-sm text-amber-800">
          Primero confirma y guarda el teléfono del destinatario.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-amber-800">
            Sin autorización registrada. No enviar mensajes todavía.
          </p>

          <label className="block text-sm text-gray-800">
            Origen de la autorización
            <select
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              className="mt-1 w-full rounded-lg border p-2"
            >
              <option value="">Seleccionar</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Formulario">Formulario</option>
              <option value="Contrato">Contrato</option>
              <option value="Otro medio verificable">Otro medio verificable</option>
            </select>
          </label>

          <label className="block text-sm text-gray-800">
            Referencia de evidencia
            <input
              type="text"
              maxLength={500}
              value={evidencia}
              onChange={(e) => setEvidencia(e.target.value)}
              placeholder="Folio, enlace o referencia de autorización"
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>

          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />
            Confirmo que el destinatario autorizó recibir notificaciones de VIPACK por WhatsApp.
          </label>

          <button
            type="button"
            onClick={() => void guardar()}
            disabled={guardando || !confirmado || !origen || !evidencia.trim()}
            className="w-full rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Registrar autorización"}
          </button>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {mensaje && <p role="status" className="mt-3 text-sm text-emerald-700">{mensaje}</p>}
    </div>
  );
}
