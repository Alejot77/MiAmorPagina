"use client";

import { useEffect, useState } from "react";
import { PEOPLE } from "@/config";
import { useThemePerson } from "@/lib/useThemePerson";
import Login from "@/components/Login";
import AppShell from "@/components/AppShell";

const STORAGE_KEY = "miamor_person";

export default function Page() {
  const [person, setPerson] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  useThemePerson(person);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && PEOPLE.includes(saved)) setPerson(saved);
    } catch {
      // localStorage no disponible, se ignora
    }
    setChecked(true);
  }, []);

  function login(name: string) {
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      // se ignora
    }
    setPerson(name);
  }

  function logout() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // se ignora
    }
    setPerson(null);
  }

  if (!checked) return <div className="app-shell"><div className="mobile-app"><p className="loading-state">Cargando...</p></div></div>;
  if (!person) return <Login onLogin={login} />;
  return <AppShell key={person} person={person} onLogout={logout} />;
}
