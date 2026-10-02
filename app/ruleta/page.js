"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FOOD_TYPES } from "@/config";

export default function Ruleta() {
  const [places, setPlaces] = useState(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("todas");
  const [spinning, setSpinning] = useState(false);
  const [shown, setShown] = useState(null);
  const [winner, setWinner] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetch("/api/places")
      .then((r) => r.json())
      .then((d) => setPlaces(d.places))
      .catch(() => setError("No se pudieron cargar los sitios."));
    return () => clearInterval(intervalRef.current);
  }, []);

  const pool = (places || []).filter((p) => category === "todas" || p.category === category);

  function spin() {
    if (pool.length === 0) return;
    setWinner(null);
    setSpinning(true);
    let ticks = 0;
    const maxTicks = 18;
    intervalRef.current = setInterval(() => {
      const random = pool[Math.floor(Math.random() * pool.length)];
      setShown(random);
      ticks += 1;
      if (ticks >= maxTicks) {
        clearInterval(intervalRef.current);
        const final = pool[Math.floor(Math.random() * pool.length)];
        setShown(final);
        setWinner(final);
        setSpinning(false);
      }
    }, 90);
  }

  return (
    <main className="wrap">
      <header className="topbar">
        <Link href="/">← Volver</Link>
      </header>
      <h1>Ruleta de sitios 🎡</h1>
      <p className="subtitle">¿No saben qué comer? Dejen que decida la ruleta.</p>

      {error && <p className="error">{error}</p>}

      <label className="ruleta-filter">
        Tipo de comida
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="todas">Todas</option>
          {FOOD_TYPES.map((f) => (
            <option key={f.key} value={f.key}>
              {f.emoji} {f.label}
            </option>
          ))}
        </select>
      </label>

      {!places ? (
        <p>Cargando...</p>
      ) : pool.length === 0 ? (
        <div className="empty-card" style={{ marginTop: 16 }}>
          No hay sitios guardados {category !== "todas" ? "de ese tipo" : ""} todavía.
          <br />
          Agrega algunos en <Link href="/lugares">Sitios</Link>.
        </div>
      ) : (
        <section className="poll ruleta-card">
          <div className={`ruleta-display ${spinning ? "spinning" : ""} ${winner ? "winner" : ""}`}>
            {shown ? shown.name : "🎲"}
          </div>
          {winner && (
            <p className="ruleta-result">
              ¡Vamos a {winner.name}! 🎉
              {winner.link && (
                <>
                  {" "}
                  <a href={winner.link} target="_blank" rel="noopener noreferrer" className="option-link">
                    🔗 Ver
                  </a>
                </>
              )}
            </p>
          )}
          <button className="big-btn" onClick={spin} disabled={spinning}>
            {spinning ? "Girando..." : winner ? "Girar de nuevo" : "Girar la ruleta"}
          </button>
        </section>
      )}
    </main>
  );
}
