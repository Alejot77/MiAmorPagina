"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/api";

// Destino del enlace del correo de verificacion. El token se manda por POST
// desde aqui (no al abrir el enlace) para que los antivirus de correo que
// "visitan" los links no lo gasten.
export default function Verificar() {
  const [state, setState] = useState<{ status: "loading" | "ok" | "error"; text: string }>({ status: "loading", text: "" });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    api<{ name: string; email: string }>("/api/auth/verify", "POST", { token })
      .then((res) => setState({ status: "ok", text: `Listo, ${res.name}: ${res.email} quedó como tu correo para recuperar la clave.` }))
      .catch((err) => setState({ status: "error", text: err.message }));
  }, []);

  return (
    <main className="login-screen">
      <div className="login-card login-notice">
        <span className="login-notice-emoji">{state.status === "ok" ? "💜" : state.status === "error" ? "⏳" : "✉️"}</span>
        <h1>{state.status === "ok" ? "Correo confirmado" : state.status === "error" ? "Enlace no válido" : "Confirmando..."}</h1>
        {state.text && <p>{state.text}</p>}
        {state.status !== "loading" && <a className="btn btn-primary login-link" href="/">Ir a la app</a>}
      </div>
    </main>
  );
}
