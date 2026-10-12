"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DEFAULT_GROUP_NAME, PEOPLE } from "@/config";
import { api } from "./api";
import { Avatar, Button } from "./ui";

// Cada boton anticipa el tema de esa persona (Alejandro: negro/rojo,
// Stefanny: blanco/lila).
function themeClass(name: string) {
  return name === "Alejandro" ? "theme-dark" : "theme-light";
}

type Mode = "checking" | "login" | "setup" | "link-email" | "notice";
type Notice = { emoji: string; title: string; text: string; warning?: string; enter: boolean };

// Los correos salen de una cuenta de Gmail nueva y a veces caen en spam.
const SPAM_HINT = "📥 Si no te llega en unos minutos, revisa la carpeta de Spam o Correo no deseado y márcalo como «No es spam».";

export default function Login({ onLogin }: { onLogin: (person: string) => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [groupName, setGroupName] = useState(DEFAULT_GROUP_NAME);

  useEffect(() => {
    api<{ name: string }>("/api/group").then((j) => setGroupName(j.name)).catch(() => {});
  }, []);

  async function choose(name: string) {
    setPending(name);
    setMode("checking");
    setEmail("");
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

  function showEmailSent(res: { emailSent?: boolean; emailError?: string }, address: string) {
    setNotice({
      emoji: "💌",
      title: "Revisa tu correo",
      text: `Te enviamos un enlace a ${address} para confirmarlo. Ese será tu correo para recuperar la clave.`,
      warning: res.emailSent === false ? res.emailError : undefined,
      enter: true,
    });
    setMode("notice");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "setup") {
      if (!email.includes("@")) return setError("Escribe un correo válido");
      if (password.length < 4) return setError("La clave debe tener al menos 4 caracteres");
      if (password !== confirm) return setError("Las claves no coinciden");
    }
    setBusy(true);
    try {
      if (mode === "setup") {
        const res = await api("/api/auth", "PUT", { person: pending, email, newPassword: password, newPasswordConfirm: confirm });
        showEmailSent(res, email.trim());
      } else if (mode === "link-email") {
        const res = await api("/api/auth/email", "PATCH", { person: pending, password, email });
        showEmailSent(res, email.trim());
      } else {
        const res = await api<{ needsEmail: boolean }>("/api/auth", "POST", { person: pending, password });
        if (res.needsEmail) setMode("link-email");
        else onLogin(pending!);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    setError("");
    setBusy(true);
    try {
      const res = await api<{ email: string; again?: boolean }>("/api/auth/forgot", "POST", { person: pending });
      setNotice({
        emoji: "🔑",
        title: res.again ? "Ya te lo enviamos" : "Revisa tu correo",
        text: `${res.again ? "Hace un momento enviamos" : "Te enviamos"} un enlace a ${res.email} para crear una clave nueva. Vence en 1 hora.`,
        enter: false,
      });
      setMode("notice");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function back() {
    setPending(null);
    setNotice(null);
  }

  const subtitle =
    mode === "setup" ? `Crea tu cuenta, ${pending}` : mode === "link-email" ? "Vincula tu correo" : `Clave de ${pending}`;

  return (
    <main className="login-screen">
      <div className="login-card">
        <div className="avatar-pair">{PEOPLE.map((p) => <Avatar key={p} person={p} />)}</div>
        <span className="eyebrow">{PEOPLE.join(" + ").toUpperCase()}</span>
        <h1>{groupName}</h1>

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
        ) : mode === "notice" && notice ? (
          <div className="login-form login-notice">
            <span className="login-notice-emoji">{notice.emoji}</span>
            <p className="login-subtitle">{notice.title}</p>
            <p className="login-hint">{notice.text}</p>
            {!notice.warning && <p className="login-spam">{SPAM_HINT}</p>}
            {notice.warning && <p className="login-error">{notice.warning}</p>}
            {notice.enter ? (
              <Button className={themeClass(pending)} onClick={() => onLogin(pending)}>Entrar</Button>
            ) : (
              <Button className={themeClass(pending)} onClick={() => { setNotice(null); setMode("login"); }}>Volver a la clave</Button>
            )}
          </div>
        ) : (
          <form className="login-form" onSubmit={submit}>
            <p className="login-subtitle" style={{ textAlign: "center" }}>{subtitle}</p>
            {mode === "setup" && (
              <p className="login-hint">Es la primera vez que entras. Tu correo sirve para recuperar la clave si algún día la olvidas.</p>
            )}
            {mode === "link-email" && (
              <p className="login-hint">Ahora las cuentas tienen correo: es el que usamos si olvidas tu clave. Te enviaremos un enlace para confirmarlo.</p>
            )}
            {(mode === "setup" || mode === "link-email") && (
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" autoFocus required />
            )}
            {mode !== "link-email" && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "setup" ? "Crea una clave" : "••••"}
                autoComplete={mode === "setup" ? "new-password" : "current-password"}
                autoFocus={mode === "login"}
              />
            )}
            {mode === "setup" && (
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la clave" autoComplete="new-password" />
            )}
            {error && <p className="login-error">{error}</p>}
            <Button type="submit" className={themeClass(pending)} disabled={busy}>
              {busy ? "Un momento..." : mode === "setup" ? "Crear cuenta" : mode === "link-email" ? "Enviar enlace" : "Entrar"}
            </Button>
            {mode === "login" && (
              <button type="button" className="text-button" onClick={forgot} disabled={busy}>¿Olvidaste tu clave?</button>
            )}
            {mode !== "link-email" && <button type="button" className="text-button" onClick={back}>← Volver</button>}
          </form>
        )}
      </div>
    </main>
  );
}
