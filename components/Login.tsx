"use client";

import { useState, type FormEvent } from "react";
import { api } from "./api";
import { Button } from "./ui";

type Mode = "login" | "register" | "forgot" | "notice";
type Notice = { emoji: string; title: string; text: string; warning?: string; enter: boolean };

// Los correos salen de una cuenta de Gmail nueva y a veces caen en spam.
const SPAM_HINT = "📥 Si no te llega en unos minutos, revisa la carpeta de Spam o Correo no deseado y márcalo como «No es spam».";

// Entrar, crear cuenta u "olvide mi clave". `invite` muestra a que sala te
// invitaron (desde el enlace /unirme/<codigo>).
export default function Login({ onLogin, invite, startMode = "login" }: {
  onLogin: () => void;
  invite?: { name: string; count: number } | null;
  startMode?: "login" | "register";
}) {
  const [mode, setMode] = useState<Mode>(startMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function go(next: Mode) {
    setMode(next);
    setError("");
    setPassword("");
    setConfirm("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "register") {
      if (!name.trim()) return setError("Escribe tu nombre");
      if (password.length < 6) return setError("La clave debe tener al menos 6 caracteres");
      if (password !== confirm) return setError("Las claves no coinciden");
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await api("/api/auth", "POST", { email, password });
        onLogin();
      } else if (mode === "register") {
        const res = await api("/api/auth/register", "POST", { name, email, password, passwordConfirm: confirm });
        setNotice({
          emoji: "💌",
          title: "Revisa tu correo",
          text: `Te enviamos un enlace a ${email.trim()} para confirmarlo. Es el que usaremos si algún día olvidas tu clave.`,
          warning: res.emailSent === false ? res.emailError : undefined,
          enter: true,
        });
        setMode("notice");
      } else if (mode === "forgot") {
        const res = await api<{ email: string }>("/api/auth/forgot", "POST", { email });
        setNotice({
          emoji: "🔑",
          title: "Revisa tu correo",
          text: `Si ${res.email} es el correo verificado de una cuenta, te llegará un enlace para crear una clave nueva. Vence en 1 hora.`,
          enter: false,
        });
        setMode("notice");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const subtitle = mode === "register" ? "Crea tu cuenta" : mode === "forgot" ? "Recupera tu clave" : "Entra a tu cuenta";

  return (
    <main className="login-screen">
      <div className="login-card">
        <span className="login-logo">💜</span>
        <h1>Plan de dos</h1>
        {invite ? (
          <p className="login-invite">Te invitaron a <strong>{invite.name}</strong> · {invite.count} {invite.count === 1 ? "persona" : "personas"}</p>
        ) : (
          <p>Planes en pareja, con amigos o en familia.</p>
        )}

        {mode === "notice" && notice ? (
          <div className="login-form login-notice">
            <span className="login-notice-emoji">{notice.emoji}</span>
            <p className="login-subtitle">{notice.title}</p>
            <p className="login-hint">{notice.text}</p>
            {!notice.warning && <p className="login-spam">{SPAM_HINT}</p>}
            {notice.warning && <p className="login-error">{notice.warning}</p>}
            {notice.enter ? (
              <Button className="theme-light" onClick={onLogin}>Entrar</Button>
            ) : (
              <Button className="theme-light" onClick={() => { setNotice(null); go("login"); }}>Volver a entrar</Button>
            )}
          </div>
        ) : (
          <form className="login-form" onSubmit={submit}>
            <p className="login-subtitle" style={{ textAlign: "center" }}>{subtitle}</p>
            {mode === "register" && (
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" maxLength={30} autoFocus required />
            )}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" autoFocus={mode !== "register"} required />
            {mode !== "forgot" && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "Crea una clave (6 o más)" : "Tu clave"}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
              />
            )}
            {mode === "register" && (
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la clave" autoComplete="new-password" required />
            )}
            {mode === "forgot" && <p className="login-hint">Te mandamos un enlace a tu correo verificado para crear una clave nueva.</p>}
            {error && <p className="login-error">{error}</p>}
            <Button type="submit" className="theme-light" disabled={busy}>
              {busy ? "Un momento..." : mode === "register" ? "Crear cuenta" : mode === "forgot" ? "Enviar enlace" : "Entrar"}
            </Button>
            {mode === "login" && (
              <>
                <button type="button" className="text-button" onClick={() => go("forgot")}>¿Olvidaste tu clave?</button>
                <p className="login-switch">¿No tienes cuenta? <button type="button" onClick={() => go("register")}>Créala aquí</button></p>
              </>
            )}
            {mode === "register" && (
              <p className="login-switch">¿Ya tienes cuenta? <button type="button" onClick={() => go("login")}>Entra</button></p>
            )}
            {mode === "forgot" && <button type="button" className="text-button" onClick={() => go("login")}>← Volver</button>}
          </form>
        )}
      </div>
    </main>
  );
}
