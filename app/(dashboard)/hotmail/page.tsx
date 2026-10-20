
"use client";

import { useState } from "react";

type RespuestaConexion = {
  success?: boolean;
  authorizationUrl?: string;
  error?: string;
};

export default function HotmailPage() {
  const [conectando, setConectando] = useState(false);
  const [error, setError] = useState("");

  async function conectarHotmail() {
    if (conectando) return;

    setConectando(true);
    setError("");

    try {
      const response = await fetch("/api/hotmail/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data: RespuestaConexion =
        await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.authorizationUrl
      ) {
        throw new Error(
          data.error || "No se pudo iniciar la conexión."
        );
      }

      const destino = new URL(data.authorizationUrl);

      if (
        destino.protocol !== "https:" ||
        destino.hostname !== "login.microsoftonline.com"
      ) {
        throw new Error(
          "Microsoft devolvió una dirección no válida."
        );
      }

      window.location.assign(destino.toString());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado."
      );
      setConectando(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "40px auto",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Conexiones Hotmail</h1>

      <p>
        Conecta las cuentas Hotmail que reciben
        notificaciones de Paquetexpress.
      </p>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 24,
          marginTop: 24,
        }}
      >
        <h2>Microsoft Outlook / Hotmail</h2>

        <p>
          Puedes conectar tus dos cuentas, una por una.
          Microsoft solicitará autorización para leer
          los correos necesarios.
        </p>

        <button
          type="button"
          onClick={conectarHotmail}
          disabled={conectando}
          style={{
            background: "#124c87",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            padding: "12px 20px",
            cursor: conectando
              ? "wait"
              : "pointer",
          }}
        >
          {conectando
            ? "Conectando..."
            : "Conectar Hotmail"}
        </button>

        {error && (
          <p role="alert" style={{ color: "#b42318" }}>
            {error}
          </p>
        )}
      </div>

      <p style={{ marginTop: 24, color: "#666" }}>
        Las cuentas se almacenarán con sus tokens
        cifrados. Esta pantalla todavía no consulta
        el estado de las conexiones.
      </p>
    </main>
  );
}
