"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Button } from "@/components/ui";

// Destino del enlace de "olvide mi clave": pide la clave nueva dos veces.
export default function Recuperar() {
  const [token, setToken] = useState("");
  const [person, setPerson] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "form" | "invalid" | "done">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
    api<{ valid: boolean; name?: string }>(`/api/auth/reset?token=${encodeURIComponent(t)}`)
      .then((res) => {
        setPerson(res.name || null);
        setStatus(res.valid ? "form" : "invalid");
      })
      .catch(() => setStatus("invalid"));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("La clave debe tener al menos 6 caracteres");
    if (password !== confirm) return setError("Las claves no coinciden");
    setBusy(true);
    try {
      await api("/api/auth/reset", "POST", { token, newPassword: password, newPasswordConfirm: confirm });
      setStatus("done");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-card">
        <span className="login-notice-emoji">{status === "done" ? "💜" : status === "invalid" ? "⏳" : "🔑"}</span>
        <h1>{status === "done" ? "Clave lista" : status === "invalid" ? "Enlace no válido" : "Clave nueva"}</h1>
        {status === "loading" && <p>Un momento...</p>}
        {status === "invalid" && (
          <>
            <p>El enlace venció o ya se usó. Pide uno nuevo con «¿Olvidaste tu clave?».</p>
            <a className="btn btn-primary login-link" href="/">Ir a la app</a>
          </>
        )}
        {status === "done" && (
          <>
            <p>Ya puedes entrar con tu clave nueva{person ? `, ${person}` : ""}.</p>
            <a className="btn btn-primary login-link" href="/">Entrar</a>
          </>
        )}
        {status === "form" && (
          <form className="login-form" onSubmit={submit}>
            <p className="login-subtitle" style={{ textAlign: "center" }}>Crea tu clave nueva{person ? `, ${person}` : ""}</p>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Clave nueva" autoComplete="new-password" autoFocus />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la clave" autoComplete="new-password" />
            {error && <p className="login-error">{error}</p>}
            <Button type="submit" disabled={busy}>{busy ? "Guardando..." : "Guardar clave"}</Button>
          </form>
        )}
      </div>
    </main>
  );
}
