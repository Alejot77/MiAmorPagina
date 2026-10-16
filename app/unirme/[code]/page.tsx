"use client";

import { use, useEffect, useState } from "react";
import Login from "@/components/Login";
import { api } from "@/components/api";
import { Avatar, Button } from "@/components/ui";

type Preview = { name: string; count: number; members?: { id: string; name: string; color: string }[]; alreadyMember?: boolean };

// Enlace de invitacion: /unirme/<codigo>. Muestra la sala; si no tienes
// sesion, entras o creas tu cuenta ahi mismo y despues te unes.
export default function Unirme({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [p, session] = await Promise.all([
        api<Preview>(`/api/groups/invite?code=${encodeURIComponent(code)}`),
        api<{ user: unknown }>("/api/session"),
      ]);
      setPreview(p);
      setLoggedIn(Boolean(session.user));
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [code]);

  async function join() {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ group: { id: string } }>("/api/groups/join", "POST", { code });
      window.location.href = `/?g=${res.group.id}`;
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (error && !preview) {
    return (
      <main className="login-screen">
        <div className="login-card">
          <span className="login-logo">🔑</span>
          <h1>Invitación no válida</h1>
          <p>{error}</p>
          <a className="btn btn-primary login-link" href="/">Ir a la app</a>
        </div>
      </main>
    );
  }
  if (!preview || loggedIn === null) {
    return <main className="login-screen"><div className="login-card"><p>Un momento...</p></div></main>;
  }
  // Sin sesion: entrar o crear cuenta, y luego unirse.
  if (!loggedIn) return <Login invite={preview} startMode="register" onLogin={() => { setLoggedIn(null); load(); }} />;

  return (
    <main className="login-screen">
      <div className="login-card">
        <span className="login-logo">💌</span>
        <span className="eyebrow">TE INVITARON A</span>
        <h1>{preview.name}</h1>
        {preview.members && preview.members.length > 0 && (
          <div className="invite-members">
            <span className="avatar-pair">{preview.members.map((m) => <Avatar key={m.id} name={m.name} color={m.color} />)}</span>
            <p>{preview.count} {preview.count === 1 ? "persona" : "personas"} planeando juntos</p>
          </div>
        )}
        {error && <p className="login-error">{error}</p>}
        {preview.alreadyMember ? (
          <a className="btn btn-primary login-link" href="/">Ya estás en esta sala · Abrir</a>
        ) : (
          <div className="login-form">
            <Button className="theme-light" onClick={join} disabled={busy}>{busy ? "Entrando..." : "Unirme a la sala"}</Button>
            <a className="text-button" href="/">Ahora no</a>
          </div>
        )}
      </div>
    </main>
  );
}
