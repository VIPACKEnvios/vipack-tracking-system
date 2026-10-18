
"use client";

import { useState } from "react";

type Entrega = {
  id: string;
  suscripcion_id: number;
  estado: "pendiente" | "aceptado" | "confirmado" | "error";
  status_code: number | null;
  confirmado_at: string | null;
  error_detalle: string | null;
};

type Resultado = {
  success: boolean;
  diagnostico_id?: string | null;
  dispositivos?: number;
  aceptados?: number;
  errores?: number;
  mensaje?: string;
  error?: string;
};

type Consulta = {
  success: boolean;
  total?: number;
  confirmados?: number;
  aceptados_sin_confirmacion?: number;
  pendientes?: number;
  errores?: number;
  entregas?: Entrega[];
  error?: string;
};

export default function DiagnosticoPushCliente({
  clienteId,
  nombre,
  activo,
}: {
  clienteId: number;
  nombre: string;
  activo: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [diagnosticoId, setDiagnosticoId] = useState<string | null>(null);
  const [resumen, setResumen] = useState<Consulta | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function consultar(id: string) {
    setConsultando(true);
    setError("");

    try {
      const res = await fetch(
        `/api/push/diagnostico?diagnostico_id=${encodeURIComponent(id)}`,
        {
          cache: "no-store",
          credentials: "same-origin",
        }
      );

      const data: Consulta = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "No se pudo consultar el diagnóstico."
        );
      }

      setResumen(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error de consulta."
      );
    } finally {
      setConsultando(false);
    }
  }

  async function ejecutar() {
    if (!activo || enviando || consultando) return;

    const confirmado = window.confirm(
      `¿Enviar una notificación de prueba a los dispositivos registrados de ${nombre} (#${clienteId})?`
    );

    if (!confirmado) return;

    setEnviando(true);
    setError("");
    setMensaje("");
    setResumen(null);
    setDiagnosticoId(null);

    try {
      const res = await fetch("/api/push/diagnostico", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          cliente_id: clienteId,
        }),
      });

      const data: Resultado = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "No se pudo ejecutar el diagnóstico."
        );
      }

      setMensaje(data.mensaje || "Prueba procesada.");

      if (data.diagnostico_id) {
        setDiagnosticoId(data.diagnostico_id);
        await consultar(data.diagnostico_id);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Error al enviar la prueba."
      );
    } finally {
      setEnviando(false);
    }
  }

  const tarjetas = [
    ["Dispositivos probados", resumen?.total ?? "—"],
    ["Confirmados", resumen?.confirmados ?? "—"],
    [
      "Aceptados sin confirmar",
      resumen?.aceptados_sin_confirmacion ?? "—",
    ],
    ["Errores", resumen?.errores ?? "—"],
  ] as const;

  return (
    <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-black text-[#111c4b]">
            🔔 Diagnóstico de notificaciones
          </h3>

          <p className="mt-1 text-xs text-slate-600">
            Prueba manual para este cliente.
            No requiere abrir la notificación.
          </p>
        </div>

        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700">
          Solo este cliente
        </span>
      </div>

      <button
        type="button"
        onClick={() => void ejecutar()}
        disabled={!activo || enviando || consultando}
        className="mt-4 w-full rounded-xl bg-[#172d87] px-5 py-3 text-sm font-black text-white hover:bg-[#102164] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando
          ? "Enviando pruebas..."
          : "Ejecutar diagnóstico"}
      </button>

      {!activo && (
        <p className="mt-2 text-xs text-amber-800">
          El cliente está inactivo.
          No se pueden enviar pruebas.
        </p>
      )}

      {mensaje && (
        <p
          className="mt-3 text-sm text-emerald-800"
          role="status"
        >
          {mensaje}
        </p>
      )}

      {error && (
        <p
          className="mt-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}

      {diagnosticoId && (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => void consultar(diagnosticoId)}
            disabled={consultando || enviando}
            className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-bold text-indigo-800 disabled:opacity-50"
          >
            {consultando
              ? "Consultando..."
              : "↻ Actualizar resultados"}
          </button>

          <p className="text-xs text-slate-500">
            Las confirmaciones pueden tardar.
            Actualiza sin reenviar la prueba.
          </p>

          {resumen && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {tarjetas.map(([titulo, valor]) => (
                  <div
                    key={titulo}
                    className="rounded-xl bg-white p-3"
                  >
                    <p className="text-xl font-black text-[#172d87]">
                      {valor}
                    </p>

                    <p className="text-xs text-slate-600">
                      {titulo}
                    </p>
                  </div>
                ))}
              </div>

              {(resumen.pendientes ?? 0) > 0 && (
                <p className="text-xs text-amber-800">
                  Pendientes de envío o actualización:{" "}
                  {resumen.pendientes}
                </p>
              )}

              <div className="space-y-2">
                {(resumen.entregas ?? []).map((entrega) => (
                  <div
                    key={entrega.id}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-xs"
                  >
                    <p className="font-bold text-slate-800">
                      Dispositivo #{entrega.suscripcion_id}
                      {" · "}
                      {entrega.estado}
                    </p>

                    {entrega.status_code !== null && (
                      <p className="text-slate-600">
                        Respuesta Push: HTTP{" "}
                        {entrega.status_code}
                      </p>
                    )}

                    {entrega.confirmado_at && (
                      <p className="text-emerald-700">
                        Confirmado:{" "}
                        {new Date(
                          entrega.confirmado_at
                        ).toLocaleString("es-MX")}
                      </p>
                    )}

                    {entrega.error_detalle && (
                      <p className="break-words text-red-700">
                        {entrega.error_detalle}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
