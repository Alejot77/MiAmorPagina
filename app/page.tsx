"use client";

import { useEffect, useState } from "react";
import { useThemePerson } from "@/lib/useThemePerson";
import Login from "@/components/Login";
import AppShell, { type Boot } from "@/components/AppShell";
import { SESSION_ENDED, api, setApiGroup } from "@/components/api";

// Solo es una pista para pintar el tema de una vez al abrir; quien entra lo
// decide la sesion del servidor (cookie).
const HINT_KEY = "pd_user";

function readHint() {
  try {
    return localStorage.getItem(HINT_KEY);
  } catch {
    return null;
  }
}

function writeHint(uid: string | null) {
  try {
    if (uid) localStorage.setItem(HINT_KEY, uid);
    else localStorage.removeItem(HINT_KEY);
  } catch {
    // se ignora
  }
}

type State = { status: "checking" | "out" | "offline" } | { status: "in"; boot: Boot };

export default function Page() {
  const [state, setState] = useState<State>({ status: "checking" });
  const [hint, setHint] = useState<string | null>(null);
  // Con sesion se pinta el tema guardado de esa cuenta (AppShell lo mantiene al dia).
  useThemePerson(state.status === "in" ? state.boot.user.id : state.status === "checking" ? hint : null);

  async function loadSession() {
    try {
      const boot = await api<Boot & { user: Boot["user"] | null }>("/api/session");
      if (boot.user) {
        writeHint(boot.user.id);
        setState({ status: "in", boot: boot as Boot });
      } else {
        setState({ status: "out" });
      }
    } catch {
      setState({ status: "offline" });
    }
  }

  useEffect(() => {
    setHint(readHint());
    loadSession();
    const ended = () => {
      writeHint(null);
      setApiGroup(null);
      setState({ status: "out" });
    };
    window.addEventListener(SESSION_ENDED, ended);
    return () => window.removeEventListener(SESSION_ENDED, ended);
  }, []);

  async function logout() {
    await api("/api/session", "DELETE").catch(() => {});
    writeHint(null);
    setApiGroup(null);
    setState({ status: "out" });
  }

  if (state.status === "checking") {
    return <div className="app-shell"><div className="mobile-app"><p className="loading-state">Cargando...</p></div></div>;
  }
  if (state.status === "offline") {
    return (
      <div className="app-shell"><div className="mobile-app"><div className="loading-state">
        <p>No se pudo conectar. Revisa tu internet.</p>
        <button className="btn btn-secondary" onClick={() => { setState({ status: "checking" }); loadSession(); }}>Reintentar</button>
      </div></div></div>
    );
  }
  if (state.status === "out") return <Login onLogin={() => { setState({ status: "checking" }); loadSession(); }} />;
  if (state.status !== "in") return null;
  return <AppShell key={state.boot.user.id} boot={state.boot} onLogout={logout} />;
}
