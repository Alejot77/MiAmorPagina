"use client";

import { useState, type FormEvent } from "react";
import { PEOPLE } from "@/config";
import { api } from "./api";
import { Avatar, Button } from "./ui";

// Cada boton anticipa el tema de esa persona (Alejandro: negro/rojo,
// Stefanny: blanco/lila).
function themeClass(name: string) {
  return name === "Alejandro" ? "theme-dark" : "theme-light";
}

export default function Login({ onLogin }: { onLogin: (person: string) => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const [mode, setMode] = useState<"checking" | "login" | "setup">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function choose(name: string) {
    setPending(name);
    setMode("checking");
    setPassword("");
    setConfirm("");
    setError("");
    try {
      const json = await api<{ hasPassword: boolean }>(`/api/auth?person=${encodeURIComponent(name)}`);
      setMode(json.hasPassword ? "login" : "setup");
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
      setMode("login");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "setup") {
      if (password.length < 4) return setError("La clave debe tener al menos 4 caracteres");
      if (password !== confirm) return setError("Las claves no coinciden");
    }
    setBusy(true);
    try {
      if (mode === "setup") {
        await api("/api/auth", "PUT", { person: pending, newPassword: password, newPasswordConfirm: confirm });
      } else {
        await api("/api/auth", "POST", { person: pending, password });
      }
      onLogin(pending!);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!window.confirm(`¿Olvidaste tu clave? Esto borra la clave actual de ${pending} y vas a tener que crear una nueva.`)) return;
    setError("");
    setBusy(true);
    try {
      await api("/api/auth", "DELETE", { person: pending });
      setPassword("");
      setConfirm("");
      setMode("setup");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-card">
        <div className="avatar-pair">{PEOPLE.map((p) => <Avatar key={p} person={p} />)}</div>
        <span className="eyebrow">{PEOPLE.join(" + ").toUpperCase()}</span>
        <h1>Plan de dos</h1>

        {!pending ? (
          <>
            <p>¿Quién eres?</p>
            <div className="login-people">
              {PEOPLE.map((p) => (
                <button key={p} className={`person-choice ${themeClass(p)}`} onClick={() => choose(p)}>
                  <span className="avatar">{p[0]}</span>
                  Soy {p}
                </button>
              ))}
            </div>
          </>
        ) : mode === "checking" ? (
          <p className="login-subtitle">Un momento...</p>
        ) : (
          <form className="login-form" onSubmit={submit}>
            <p className="login-subtitle" style={{ textAlign: "center" }}>
              {mode === "setup" ? `Crea tu clave, ${pending}` : `Clave de ${pending}`}
            </p>
            {mode === "setup" && (
              <p className="login-hint">Es la primera vez que entras: elige una clave de al menos 4 caracteres. La vas a necesitar la próxima vez.</p>
            )}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••" autoFocus />
            {mode === "setup" && (
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la clave" />
            )}
            {error && <p className="login-error">{error}</p>}
            <Button type="submit" className={themeClass(pending)} disabled={busy}>
              {busy ? "Un momento..." : mode === "setup" ? "Crear clave y entrar" : "Entrar"}
            </Button>
            {mode === "login" && (
              <button type="button" className="text-button" onClick={forgot} disabled={busy}>¿Olvidaste tu clave?</button>
            )}
            <button type="button" className="text-button" onClick={() => setPending(null)}>← Volver</button>
          </form>
        )}
      </div>
    </main>
  );
}
