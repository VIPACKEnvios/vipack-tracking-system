
"use client";

import { useState } from "react";

export default function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    if (cargando) return;

    if (!usuario.trim() || !password) {
      setError("Ingresa tu usuario y contraseña.");
      return;
    }

    try {
      setCargando(true);
      setError("");

      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          usuario: usuario.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // La cookie segura será creada por el servidor.
        window.location.href = "/";
      } else {
        setError("Usuario o contraseña incorrectos.");
      }
    } catch {
      setError(
        "No se pudo conectar con el servidor. Intenta nuevamente."
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f3f4f6",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "40px",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 0 20px rgba(0,0,0,0.1)",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            fontSize: "32px",
            fontWeight: "bold",
            marginBottom: "20px",
            color: "#0f4c81",
          }}
        >
          VIPACK Login
        </h1>

        <input
          type="text"
          placeholder="Usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          disabled={cargando}
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "15px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            boxSizing: "border-box",
          }}
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") login();
          }}
          autoComplete="current-password"
          disabled={cargando}
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "20px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            boxSizing: "border-box",
          }}
        />

        {error && (
          <p
            role="alert"
            style={{
              color: "#b91c1c",
              fontSize: "14px",
              textAlign: "center",
              marginBottom: "15px",
            }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={login}
          disabled={cargando}
          style={{
            width: "100%",
            padding: "14px",
            background: "#0f4c81",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: cargando ? "wait" : "pointer",
            fontSize: "18px",
            fontWeight: "bold",
            opacity: cargando ? 0.7 : 1,
          }}
        >
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </div>
    </div>
  );
}
