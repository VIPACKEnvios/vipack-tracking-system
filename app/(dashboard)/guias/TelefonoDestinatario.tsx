"use client";

import { useState } from "react";
import ConsentimientoWhatsApp from "./ConsentimientoWhatsApp";

type OpcionTelefono = {
  telefono: string;
  fuentes: string[];
};

type ResultadoBusqueda = {
  success: boolean;
  nombre?: string;
  telefono_guardado?: string | null;
  opciones?: OpcionTelefono[];
  error?: string;
};

type Props = {
  guia: string;
  destinatario: string;
};

function mostrarTelefono(valor: string) {
  const digitos = valor.replace(/\D/g, "");
  const nacional = digitos.startsWith("521")
    ? digitos.slice(3)
    : digitos.startsWith("52")
      ? digitos.slice(2)
      : digitos;

  if (nacional.length !== 10) return valor;

  return `+52 ${nacional.slice(0, 3)} ${nacional.slice(3, 6)} ${nacional.slice(6)}`;
}

export default function TelefonoDestinatario({
  guia,
  destinatario,
}: Props) {
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [consultado, setConsultado] = useState(false);
  const [opciones, setOpciones] = useState<OpcionTelefono[]>([]);
  const [telefonoGuardado, setTelefonoGuardado] = useState("");
  const [seleccion, setSeleccion] = useState("");
  const [manual, setManual] = useState(false);
  const [telefonoManual, setTelefonoManual] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function buscarTelefonos() {
    setBuscando(true);
    setError("");
    setMensaje("");
    setConsultado(false);

    try {
      const respuesta = await fetch(
        `/api/guias-paquexpress/telefonos?guia=${encodeURIComponent(guia)}`,
        { cache: "no-store" }
      );

      const datos: ResultadoBusqueda = await respuesta.json();

      if (!respuesta.ok || !datos.success) {
        throw new Error(datos.error || "No se pudieron buscar teléfonos");
      }

      const encontrados = datos.opciones || [];
      const guardado = datos.telefono_guardado || "";

      setOpciones(encontrados);
      setTelefonoGuardado(guardado);
      setSeleccion(guardado);
      setManual(false);
      setTelefonoManual("");
      setConsultado(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error desconocido"
      );
    } finally {
      setBuscando(false);
    }
  }

  async function guardarTelefono() {
    const telefono = manual ? telefonoManual : seleccion;

    if (!telefono.trim()) {
      setError("Selecciona o escribe un teléfono");
      return;
    }

    if (
      !/^(?:\d{10}|52\d{10}|521\d{10})$/.test(
        telefono.replace(/\D/g, "")
      )
    ) {
      setError("Escribe un número mexicano válido de 10 dígitos");
      return;
    }

    const confirmado = window.confirm(
      `¿Confirmas que el teléfono ${mostrarTelefono(telefono)} pertenece a ${destinatario}?`
    );

    if (!confirmado) return;

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const respuesta = await fetch(
        "/api/guias-paquexpress/telefonos",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guia, telefono }),
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok || !datos.success) {
        throw new Error(datos.error || "No se pudo guardar el teléfono");
      }

      setTelefonoGuardado(datos.telefono);
      setSeleccion(datos.telefono);
      setManual(false);
      setTelefonoManual("");
      setMensaje("Teléfono guardado correctamente");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error desconocido"
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-violet-950">
            WhatsApp del destinatario
          </p>
          <p className="text-xs text-violet-700">
            Buscar por nombre o agregar manualmente
          </p>
        </div>

        <button
          type="button"
          onClick={() => void buscarTelefonos()}
          disabled={buscando}
          className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {buscando ? "Buscando..." : "Buscar teléfono"}
        </button>
      </div>

      {consultado && (
        <div className="mt-4 space-y-3">
          {telefonoGuardado && (
            <p className="rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">
              Teléfono guardado: {mostrarTelefono(telefonoGuardado)}
            </p>
          )}

          {opciones.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-800">
                Teléfonos encontrados:
              </p>

              {opciones.map((opcion) => (
                <label
                  key={opcion.telefono}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-white p-3"
                >
                  <input
                    type="radio"
                    name={`telefono-${guia}`}
                    checked={!manual && seleccion === opcion.telefono}
                    onChange={() => {
                      setSeleccion(opcion.telefono);
                      setManual(false);
                    }}
                  />

                  <span className="text-sm text-gray-900">
                    {mostrarTelefono(opcion.telefono)}
                    <span className="block text-xs text-gray-500">
                      Encontrado en: {opcion.fuentes.join(", ")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-amber-800">
              No se encontraron teléfonos registrados con este nombre.
            </p>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              checked={manual}
              onChange={(e) => setManual(e.target.checked)}
            />
            Agregar otro teléfono manualmente
          </label>

          {manual && (
            <input
              type="tel"
              inputMode="numeric"
              value={telefonoManual}
              onChange={(e) => setTelefonoManual(e.target.value)}
              placeholder="Número de WhatsApp de 10 dígitos"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            />
          )}

          <button
            type="button"
            onClick={() => void guardarTelefono()}
            disabled={guardando || (!manual && !seleccion)}
            className="w-full rounded-lg bg-blue-900 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Confirmar y guardar teléfono"}
          </button>
        </div>
      )}

      {consultado && telefonoGuardado && (
        <ConsentimientoWhatsApp key={`${guia}-${telefonoGuardado}`} guia={guia} />
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {mensaje && (
        <p role="status" className="mt-3 text-sm font-medium text-emerald-800">
          {mensaje}
        </p>
      )}
    </div>
  );
}
