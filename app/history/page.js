"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PEOPLE, PERSON_COLORS } from "@/config";

const STORAGE_KEY = "miamor_person";

function colorFor(name) {
  const idx = PEOPLE.indexOf(name);
  return PERSON_COLORS[idx] || "#b98b6f";
}

export default function History() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");
  const [person, setPerson] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPerson(saved);
    } catch (e) {
      // se ignora
    }
    loadHistory();
  }, []);

  function loadHistory() {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.history))
      .catch(() => setError("No se pudo cargar el historial."));
  }

  async function deletePoll(pollId) {
    if (!person) return;
    if (!window.confirm("¿Eliminar este finde del historial? No se puede deshacer.")) {
      return;
    }
    setError("");
    setDeletingId(pollId);
    try {
      const res = await fetch("/api/poll", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, person }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al eliminar");
        return;
      }
      loadHistory();
    } catch (e) {
      setError("Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

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
            <HistoryItem
              key={poll.id}
              poll={poll}
              votes={votes}
              onDelete={person ? () => deletePoll(poll.id) : null}
              deleting={deletingId === poll.id}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function HistoryItem({ poll, votes, onDelete, deleting }) {
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
      <div className="poll-header">
        <p className="weekend-date">📅 {formatDate(poll.weekend)}</p>
        {onDelete && (
          <button
            type="button"
            className="icon-btn"
            onClick={onDelete}
            disabled={deleting}
            aria-label="Eliminar este finde"
          >
            🗑️
          </button>
        )}
      </div>
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
