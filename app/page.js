"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PEOPLE, PERSON_COLORS } from "@/config";

const STORAGE_KEY = "miamor_person";

function colorFor(name, people) {
  const idx = (people || PEOPLE).indexOf(name);
  return PERSON_COLORS[idx] || "#b98b6f";
}

export default function Home() {
  const [person, setPerson] = useState(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weekend, setWeekend] = useState(nextSaturday());
  const [options, setOptions] = useState(["", ""]);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPerson(saved);
    } catch (e) {
      // localStorage no disponible, se ignora
    }
    setCheckedStorage(true);
    fetchPoll();
  }, []);

  useEffect(() => {
    if (data && !data.poll) setShowCreate(true);
  }, [data]);

  async function fetchPoll() {
    setLoading(true);
    try {
      const res = await fetch("/api/poll");
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError("No se pudo cargar la encuesta.");
    } finally {
      setLoading(false);
    }
  }

  function choosePerson(name) {
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch (e) {
      // se ignora
    }
    setPerson(name);
  }

  function changePerson() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // se ignora
    }
    setPerson(null);
  }

  async function vote(optionId) {
    setError("");
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: data.poll.id, person, optionId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al votar");
        return;
      }
      setData((d) => ({ ...d, votes: json.votes }));
    } catch (e) {
      setError("Error al votar");
    }
  }

  function updateOption(i, value) {
    setOptions((opts) => opts.map((o, idx) => (idx === i ? value : o)));
  }

  function addOption() {
    setOptions((opts) => [...opts, ""]);
  }

  function removeOption(i) {
    setOptions((opts) => opts.filter((_, idx) => idx !== i));
  }

  async function createPoll(e) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekend, options, person }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al crear la encuesta");
        return;
      }
      setData((d) => ({ poll: json.poll, votes: json.votes, people: d?.people }));
      setOptions(["", ""]);
      setWeekend(nextSaturday());
      setShowCreate(false);
    } catch (e) {
      setError("Error al crear la encuesta");
    } finally {
      setCreating(false);
    }
  }

  if (!checkedStorage) {
    return null;
  }

  const people = data?.people || PEOPLE;

  if (!person) {
    return (
      <main className="wrap center">
        <div className="landing-card">
          <div className="landing-emoji">🍽️</div>
          <h1>¿Qué comemos?</h1>
          <p className="subtitle">¿Quién eres?</p>
          <div className="people-buttons">
            {people.map((p) => (
              <button
                key={p}
                className="person-btn"
                style={{ background: colorFor(p, people) }}
                onClick={() => choosePerson(p)}
              >
                <span className="avatar" style={{ background: "rgba(255,255,255,0.35)" }}>
                  {p[0]}
                </span>
                Soy {p}
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <header className="topbar">
        <span className="topbar-greeting">
          <span className="avatar" style={{ background: colorFor(person, people) }}>
            {person[0]}
          </span>
          Hola, {person}
        </span>
        <div className="topbar-links">
          <Link href="/history">Historial</Link>
          <button className="link-btn" onClick={changePerson}>
            Cambiar
          </button>
        </div>
      </header>

      <h1>¿Qué comemos este finde? 🍽️</h1>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : data?.poll ? (
        <PollView
          poll={data.poll}
          votes={data.votes}
          person={person}
          people={people}
          onVote={vote}
        />
      ) : (
        <div className="empty-card">
          Todavía no hay encuesta para este finde.
          <br />
          ¡Crea una abajo! 👇
        </div>
      )}

      {!showCreate && data?.poll && (
        <button className="create-toggle" onClick={() => setShowCreate(true)}>
          + Proponer opciones para otro finde
        </button>
      )}

      {showCreate && (
        <section className="create-section">
          <h2>{data?.poll ? "Encuesta para otro finde" : "Crear encuesta"}</h2>
          <form onSubmit={createPoll}>
            <label>
              Fecha del finde
              <input
                type="date"
                value={weekend}
                onChange={(e) => setWeekend(e.target.value)}
                required
              />
            </label>
            {options.map((opt, i) => (
              <div key={i} className="option-row">
                <input
                  type="text"
                  placeholder={`Opción ${i + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeOption(i)}
                    aria-label="Quitar opción"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="link-btn" onClick={addOption}>
              + Agregar opción
            </button>
            <button type="submit" className="big-btn" disabled={creating}>
              {creating ? "Creando..." : "Crear encuesta"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

function PollView({ poll, votes, person, people, onVote }) {
  const myVote = votes[person];
  const counts = {};
  Object.values(votes).forEach((optId) => {
    counts[optId] = (counts[optId] || 0) + 1;
  });
  const maxVotes = Math.max(0, ...Object.values(counts));

  return (
    <section className="poll">
      <p className="weekend-date">📅 Finde del {formatDate(poll.weekend)}</p>
      <ul className="options-list">
        {poll.options.map((opt) => {
          const selected = myVote === opt.id;
          const voteCount = counts[opt.id] || 0;
          const isWinning = maxVotes > 0 && voteCount === maxVotes;
          const voters = Object.entries(votes).filter(([, v]) => v === opt.id);
          return (
            <li key={opt.id}>
              <button
                className={`option-btn ${selected ? "selected" : ""} ${
                  isWinning ? "winning" : ""
                }`}
                onClick={() => onVote(opt.id)}
              >
                <span className="option-radio" />
                <span className="option-main">
                  <span className="option-name">{opt.name}</span>
                </span>
                <span className="option-voters">
                  {voters.map(([p]) => (
                    <span
                      key={p}
                      className="avatar sm"
                      style={{ background: colorFor(p, people) }}
                      title={p}
                    >
                      {p[0]}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="votes-info">
        {myVote
          ? "Ya votaste. Puedes cambiar tu voto cuando quieras."
          : "Todavía no has votado."}
      </p>
    </section>
  );
}

function nextSaturday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatDate(str) {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
