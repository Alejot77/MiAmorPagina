"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function History() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.history))
      .catch(() => setError("No se pudo cargar el historial."));
  }, []);

  return (
    <main className="wrap">
      <header className="topbar">
        <Link href="/">← Volver</Link>
      </header>
      <h1>Historial de findes 📖</h1>
      {error && <p className="error">{error}</p>}
      {!history ? (
        <p>Cargando...</p>
      ) : history.length === 0 ? (
        <p>Todavía no hay findes registrados.</p>
      ) : (
        <ul className="history-list">
          {history.map(({ poll, votes }) => (
            <HistoryItem key={poll.id} poll={poll} votes={votes} />
          ))}
        </ul>
      )}
    </main>
  );
}

function HistoryItem({ poll, votes }) {
  const counts = {};
  Object.values(votes).forEach((optId) => {
    counts[optId] = (counts[optId] || 0) + 1;
  });
  const maxVotes = Math.max(0, ...Object.values(counts));
  const winners = poll.options.filter(
    (o) => maxVotes > 0 && (counts[o.id] || 0) === maxVotes
  );

  return (
    <li className="history-item">
      <p className="weekend-date">{formatDate(poll.weekend)}</p>
      <ul>
        {poll.options.map((opt) => {
          const voters = Object.entries(votes)
            .filter(([, v]) => v === opt.id)
            .map(([p]) => p);
          return (
            <li
              key={opt.id}
              className={winners.some((w) => w.id === opt.id) ? "winner" : ""}
            >
              {opt.name} — {counts[opt.id] || 0} voto(s)
              {voters.length > 0 ? ` (${voters.join(", ")})` : ""}
            </li>
          );
        })}
      </ul>
      {winners.length > 0 && (
        <p className="winner-label">
          🏆 Ganó: {winners.map((w) => w.name).join(" y ")}
        </p>
      )}
    </li>
  );
}

function formatDate(str) {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
