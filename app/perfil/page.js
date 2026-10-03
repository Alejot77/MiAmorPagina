"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PEOPLE, PERSON_COLORS } from "@/config";

const STORAGE_KEY = "miamor_person";

function colorFor(name) {
  const idx = PEOPLE.indexOf(name);
  return PERSON_COLORS[idx] || "#b98b6f";
}

export default function Perfil() {
  const [person, setPerson] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPerson(saved);
    } catch (e) {
      // se ignora
    }
    load();
  }, []);

  function load() {
    fetch("/api/points")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("No se pudo cargar el perfil."));
  }

  async function claimDessert(who) {
    setError("");
    setClaiming(who);
    try {
      const res = await fetch("/api/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: who }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al reclamar el postre");
        return;
      }
      load();
    } catch (e) {
      setError("Error al reclamar el postre");
    } finally {
      setClaiming(null);
    }
  }

  const threshold = data?.threshold || 100;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/">← Volver</Link>
        </div>
      </header>
      <main className="wrap">
        <h1>Perfil y puntos 🏆</h1>
        <p className="subtitle">
          Cada categoría que armas en un plan te da puntos. Al llegar a {threshold} puntos, el
          otro te debe un postre 🍰
        </p>

        {error && <p className="error">{error}</p>}

        {!data ? (
          <p>Cargando...</p>
        ) : (
          <div className="profile-grid">
            {PEOPLE.map((p) => {
              const points = data.points[p] || 0;
              const desserts = data.desserts[p] || 0;
              const pct = Math.min(100, Math.round((points / threshold) * 100));
              const owesReady = points >= threshold;
              return (
                <section key={p} className="poll profile-card">
                  <div className="profile-head">
                    <span className="avatar" style={{ background: colorFor(p) }}>
                      {p[0]}
                    </span>
                    <div>
                      <p className="profile-name">
                        {p} {person === p && <span className="profile-you">(tú)</span>}
                      </p>
                      <p className="profile-points">{points} pts</p>
                    </div>
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%`, background: colorFor(p) }}
                    />
                  </div>
                  <p className="progress-label">
                    {owesReady
                      ? "¡Llegó al puntaje del postre! 🍰"
                      : `Faltan ${threshold - points} pts para el postre`}
                  </p>

                  {desserts > 0 && (
                    <p className="profile-desserts">🍰 Postres ganados: {desserts}</p>
                  )}

                  {owesReady && (
                    <button
                      className="big-btn"
                      onClick={() => claimDessert(p)}
                      disabled={claiming === p}
                    >
                      {claiming === p ? "Reclamando..." : `Reclamar postre de ${p}`}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
