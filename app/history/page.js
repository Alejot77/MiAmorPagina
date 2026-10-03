"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PEOPLE, PERSON_COLORS, categoryInfo } from "@/config";
import { useThemePerson } from "@/lib/useThemePerson";

const STORAGE_KEY = "miamor_person";

function colorFor(name) {
  const idx = PEOPLE.indexOf(name);
  return PERSON_COLORS[idx] || "#b98b6f";
}

export default function History() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");
  const [person, setPerson] = useState(null);
  useThemePerson(person);
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

  async function deletePlan(planId) {
    if (!person) return;
    if (!window.confirm("¿Eliminar este plan del historial? No se puede deshacer.")) {
      return;
    }
    setError("");
    setDeletingId(planId);
    try {
      const res = await fetch("/api/plan", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, person }),
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
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/">← Volver</Link>
        </div>
      </header>
      <main className="wrap">
        <h1>Historial de planes 📖</h1>
        {error && <p className="error">{error}</p>}
        {!history ? (
          <p>Cargando...</p>
        ) : history.length === 0 ? (
          <div className="empty-card">Todavía no hay planes registrados.</div>
        ) : (
          <ul className="history-list">
            {history.map(({ plan, votes }) => (
              <HistoryItem
                key={plan.id}
                plan={plan}
                votes={votes}
                onDelete={person ? () => deletePlan(plan.id) : null}
                deleting={deletingId === plan.id}
              />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function HistoryItem({ plan, votes, onDelete, deleting }) {
  return (
    <li className="history-item">
      <div className="poll-header">
        <p className="weekend-date">📅 {formatDate(plan.weekend)}</p>
        {onDelete && (
          <button
            type="button"
            className="icon-btn"
            onClick={onDelete}
            disabled={deleting}
            aria-label="Eliminar este plan"
          >
            🗑️
          </button>
        )}
      </div>
      {plan.steps.map((step) => (
        <HistoryStep key={step.id} step={step} votes={votes[step.id] || {}} />
      ))}
    </li>
  );
}

function HistoryStep({ step, votes }) {
  const info = categoryInfo(step.category);
  const counts = {};
  Object.values(votes).forEach((optId) => {
    counts[optId] = (counts[optId] || 0) + 1;
  });
  const maxVotes = Math.max(0, ...Object.values(counts));
  const winners = step.options.filter(
    (o) => maxVotes > 0 && (counts[o.id] || 0) === maxVotes
  );

  return (
    <div className="history-step">
      <p className="step-question">
        {info.emoji} {step.question}
      </p>
      <ul className="history-options">
        {step.options.map((opt) => {
          const voters = Object.entries(votes).filter(([, v]) => v === opt.id);
          const isWinner = winners.some((w) => w.id === opt.id);
          return (
            <li key={opt.id} className={isWinner ? "winner" : ""}>
              <span className="history-option-name">
                {isWinner ? "🏆 " : ""}
                {opt.name}
                {opt.link && (
                  <a
                    href={opt.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="option-link"
                  >
                    🔗 Ver
                  </a>
                )}
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
    </div>
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
