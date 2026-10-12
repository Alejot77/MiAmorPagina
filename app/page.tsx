"use client";

import { useEffect, useState } from "react";
import { PEOPLE } from "@/config";
import { useThemePerson } from "@/lib/useThemePerson";
import Login from "@/components/Login";
import AppShell, { type Boot } from "@/components/AppShell";
import { SESSION_ENDED, api } from "@/components/api";

// Solo es una pista para pintar el tema de una vez al abrir; quien entra lo
// decide la sesion del servidor (cookie).
const HINT_KEY = "miamor_person";

function readHint() {
  try {
    const saved = localStorage.getItem(HINT_KEY);
    return saved && PEOPLE.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

function writeHint(person: string | null) {
  try {
    if (person) localStorage.setItem(HINT_KEY, person);
    else localStorage.removeItem(HINT_KEY);
  } catch {
    // se ignora
  }
}

type State = { status: "checking" | "out" | "offline" } | { status: "in"; boot: Boot };

export default function Page() {
  const [state, setState] = useState<State>({ status: "checking" });
  const [hint, setHint] = useState<string | null>(null);
  useThemePerson(state.status === "in" ? state.boot.person : state.status === "checking" ? hint : null);

  async function loadSession() {
    try {
      const boot = await api<Boot & { person: string | null }>("/api/session");
      if (boot.person) {
        writeHint(boot.person);
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
      setState({ status: "out" });
    };
    window.addEventListener(SESSION_ENDED, ended);
    return () => window.removeEventListener(SESSION_ENDED, ended);
  }, []);

  async function logout() {
    await api("/api/session", "DELETE").catch(() => {});
    writeHint(null);
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
  return <AppShell key={state.boot.person} person={state.boot.person} boot={state.boot} onLogout={logout} />;
}
