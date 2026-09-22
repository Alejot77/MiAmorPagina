"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PEOPLE, PERSON_COLORS } from "@/config";

function colorFor(name) {
  const idx = PEOPLE.indexOf(name);
  return PERSON_COLORS[idx] || "#b98b6f";
}

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
        <div className="empty-card">Todavía no hay findes registrados.</div>
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
      <p className="weekend-date">📅 {formatDate(poll.weekend)}</p>
      <ul className="history-options">
        {poll.options.map((opt) => {
          const voters = Object.entries(votes).filter(([, v]) => v === opt.id);
          const isWinner = winners.some((w) => w.id === opt.id);
          return (
            <li key={opt.id} className={isWinner ? "winner" : ""}>
              <span className="history-option-name">
                {isWinner ? "🏆 " : ""}
                {opt.name}
              </span>
              <span className="history-option-right">
                {voters.map(([p]) => (
                  <span
                    key={p}
                    className="avatar sm"
                    style={{ background: colorFor(p) }}
                    title={p}
                  >
                    {p[0]}
                  </span>
                ))}
                <span className="vote-tally">{counts[opt.id] || 0}</span>
              </span>
            </li>
          );
        })}
      </ul>
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
