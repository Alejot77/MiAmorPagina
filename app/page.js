"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PEOPLE, PERSON_COLORS, CATEGORIES, categoryInfo, FOOD_TYPES, foodTypeInfo } from "@/config";

const STORAGE_KEY = "miamor_person";
const FLOWER_SEEN_KEY = "miamor_flowers_seen";
const FLOWER_PERSON = "Stefanny";

function colorFor(name, people) {
  const idx = (people || PEOPLE).indexOf(name);
  return PERSON_COLORS[idx] || "#b98b6f";
}

function isFlowerDay(d = new Date()) {
  return d.getMonth() === 8 && d.getDate() === 21; // 21 de septiembre
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function blankStep(category = "comida") {
  return {
    category,
    question: categoryInfo(category).question,
    twoPhase: category === "comida",
    options: [
      { name: "", link: "" },
      { name: "", link: "" },
    ],
  };
}

function nextCategory(usedKeys) {
  const used = new Set(usedKeys);
  const found = CATEGORIES.find((c) => !used.has(c.key));
  return found ? found.key : "otro";
}

function stepToDraft(step) {
  return {
    id: step.id,
    category: step.category,
    question: step.question,
    twoPhase: Boolean(step.twoPhase),
    kind: step.kind,
    generatedStepId: step.generatedStepId,
    generatedFrom: step.generatedFrom,
    options: step.options.map((o) => ({ name: o.name, link: o.link || "" })),
  };
}

function draftToPayload(draft) {
  return {
    ...(draft.id ? { id: draft.id } : {}),
    category: draft.category,
    question: draft.question,
    twoPhase: Boolean(draft.twoPhase),
    ...(draft.kind ? { kind: draft.kind } : {}),
    ...(draft.generatedStepId ? { generatedStepId: draft.generatedStepId } : {}),
    ...(draft.generatedFrom ? { generatedFrom: draft.generatedFrom } : {}),
    options: draft.options,
  };
}

function isStepSuperseded(step, allSteps) {
  return Boolean(step.generatedStepId) && allSteps.some((s) => s.id === step.generatedStepId);
}

export default function Home() {
  const [person, setPerson] = useState(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFlowerModal, setShowFlowerModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formMode, setFormMode] = useState(null); // null | "create" | "edit" | "addCategory"
  const [weekendInput, setWeekendInput] = useState(nextSaturday());
  const [draftSteps, setDraftSteps] = useState([]);
  const [hiddenSteps, setHiddenSteps] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPerson(saved);
        maybeShowFlowerModal(saved);
      }
    } catch (e) {
      // localStorage no disponible, se ignora
    }
    setCheckedStorage(true);
    fetchPlan();
  }, []);

  useEffect(() => {
    if (data && !data.plan && !formMode) openCreate();
  }, [data]);

  function maybeShowFlowerModal(name) {
    if (name !== FLOWER_PERSON || !isFlowerDay()) return;
    try {
      const lastSeen = localStorage.getItem(FLOWER_SEEN_KEY);
      if (lastSeen !== todayKey()) {
        setShowFlowerModal(true);
      }
    } catch (e) {
      setShowFlowerModal(true);
    }
  }

  function dismissFlowerModal() {
    try {
      localStorage.setItem(FLOWER_SEEN_KEY, todayKey());
    } catch (e) {
      // se ignora
    }
    setShowFlowerModal(false);
  }

  async function fetchPlan() {
    setLoading(true);
    try {
      const res = await fetch("/api/plan");
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError("No se pudo cargar el plan.");
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
    maybeShowFlowerModal(name);
  }

  function changePerson() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // se ignora
    }
    setPerson(null);
  }

  async function vote(stepId, optionId) {
    setError("");
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: data.plan.id, stepId, person, optionId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al votar");
        return;
      }
      setData((d) => ({ ...d, plan: json.plan, votes: json.votes }));
    } catch (e) {
      setError("Error al votar");
    }
  }

  function openCreate() {
    setError("");
    setWeekendInput(nextSaturday());
    setHiddenSteps([]);
    setDraftSteps([blankStep("comida")]);
    setFormMode("create");
  }

  function openEdit() {
    if (!data?.plan) return;
    setError("");
    setWeekendInput(data.plan.weekend);
    setHiddenSteps([]);
    setDraftSteps(data.plan.steps.map(stepToDraft));
    setFormMode("edit");
  }

  function openAddCategory() {
    if (!data?.plan) return;
    setError("");
    setWeekendInput(data.plan.weekend);
    setHiddenSteps(data.plan.steps.map(stepToDraft));
    const used = data.plan.steps.map((s) => s.category);
    setDraftSteps([blankStep(nextCategory(used))]);
    setFormMode("addCategory");
  }

  function closeForm() {
    setFormMode(null);
    setDraftSteps([]);
    setHiddenSteps([]);
  }

  function addDraftStep() {
    const used = [...hiddenSteps, ...draftSteps].map((s) => s.category);
    setDraftSteps((ds) => [...ds, blankStep(nextCategory(used))]);
  }

  async function submitSteps(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const steps = [...hiddenSteps, ...draftSteps].map(draftToPayload);
      const isEdit = formMode === "edit" || formMode === "addCategory";
      const res = await fetch("/api/plan", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { planId: data.plan.id, weekend: weekendInput, person, steps }
            : { weekend: weekendInput, person, steps }
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al guardar el plan");
        return;
      }
      setData((d) => ({ plan: json.plan, votes: json.votes, people: d?.people }));
      closeForm();
    } catch (e) {
      setError("Error al guardar el plan");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan() {
    if (!data?.plan) return;
    if (!window.confirm("¿Eliminar este plan y todos sus votos? No se puede deshacer.")) {
      return;
    }
    setError("");
    setDeleting(true);
    try {
      const res = await fetch("/api/plan", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: data.plan.id, person }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al eliminar el plan");
        return;
      }
      closeForm();
      await fetchPlan();
    } catch (e) {
      setError("Error al eliminar el plan");
    } finally {
      setDeleting(false);
    }
  }

  if (!checkedStorage) {
    return null;
  }

  const people = data?.people || PEOPLE;
  const activeSteps = data?.plan
    ? data.plan.steps.filter((s) => !isStepSuperseded(s, data.plan.steps))
    : [];
  const planComplete =
    data?.plan &&
    activeSteps.length > 0 &&
    activeSteps.every((s) => people.every((p) => Boolean((data.votes[s.id] || {})[p])));
  const decidedCount = activeSteps.filter((s) =>
    people.every((p) => Boolean((data?.votes?.[s.id] || {})[p]))
  ).length;
  const pendingCount = activeSteps.length - decidedCount;

  if (!person) {
    return (
      <main className="wrap center">
        <div className="landing-card">
          <div className="landing-emoji">💜</div>
          <h1>Nuestros planes</h1>
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
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="topbar-greeting">
            <span className="avatar" style={{ background: colorFor(person, people) }}>
              {person[0]}
            </span>
            Hola, {person}
          </span>
          <div className="topbar-links">
            <Link href="/lugares">📍 Sitios</Link>
            <Link href="/ruleta">🎡 Ruleta</Link>
            <Link href="/flores">🌼 Flores</Link>
            <Link href="/history">Historial</Link>
            <button className="link-btn" onClick={changePerson}>
              Cambiar
            </button>
          </div>
        </div>
      </header>
      <main className="wrap">

      {showFlowerModal && (
        <div className="flower-modal-overlay">
          <div className="flower-modal-card">
            <div className="flower-modal-emoji">🌼</div>
            <h2>Hoy es 21 de septiembre</h2>
            <p>Y aquí están tus flores amarillas.</p>
            <div className="flower-modal-actions">
              <Link
                href="/flores"
                className="big-btn"
                onClick={dismissFlowerModal}
                style={{ display: "block", textDecoration: "none", textAlign: "center" }}
              >
                Ver mi universo de flores
              </Link>
              <button className="link-btn" onClick={dismissFlowerModal}>
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}

      <h1>¿Qué planeamos este finde? 💜</h1>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : data?.plan ? (
        <>
          <div className="poll-header plan-header">
            <div>
              <p className="weekend-date">📅 Finde del {formatDate(data.plan.weekend)}</p>
              <div className="plan-stats">
                <span className="stat-pill">{activeSteps.length} categoría{activeSteps.length === 1 ? "" : "s"}</span>
                <span className="stat-pill done">{decidedCount} decidida{decidedCount === 1 ? "" : "s"}</span>
                {pendingCount > 0 && (
                  <span className="stat-pill pending">
                    {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>
            <div className="poll-actions">
              <button type="button" className="icon-btn" onClick={openEdit} aria-label="Editar plan">
                ✏️
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={deletePlan}
                disabled={deleting}
                aria-label="Eliminar plan"
              >
                🗑️
              </button>
            </div>
          </div>
          {planComplete && (
            <Summary plan={data.plan} votes={data.votes} activeSteps={activeSteps} />
          )}
          <div className="steps-grid">
            {data.plan.steps.map((step) =>
              isStepSuperseded(step, data.plan.steps) ? (
                <ResolvedBanner key={step.id} step={step} votes={data.votes[step.id] || {}} />
              ) : (
                <StepCard
                  key={step.id}
                  step={step}
                  votes={data.votes[step.id] || {}}
                  person={person}
                  people={people}
                  onVote={(optionId) => vote(step.id, optionId)}
                />
              )
            )}
          </div>
        </>
      ) : (
        <div className="empty-card">
          Todavía no hay plan para este finde.
          <br />
          ¡Crea uno abajo! 👇
        </div>
      )}

      {!formMode && data?.plan && (
        <button className="create-toggle" onClick={openAddCategory}>
          + Agregar otra categoría a este plan
        </button>
      )}

      {formMode && (
        <section className="create-section">
          <h2>
            {formMode === "create" && "Crear plan"}
            {formMode === "edit" && "Editar plan"}
            {formMode === "addCategory" && "Agregar categoría"}
          </h2>
          <form onSubmit={submitSteps}>
            {formMode !== "addCategory" && (
              <label>
                Fecha del finde
                <input
                  type="date"
                  value={weekendInput}
                  onChange={(e) => setWeekendInput(e.target.value)}
                  required
                />
              </label>
            )}

            {draftSteps.map((step, i) => (
              <StepEditor
                key={i}
                step={step}
                onChange={(updated) =>
                  setDraftSteps((ds) => ds.map((s, idx) => (idx === i ? updated : s)))
                }
                onRemove={
                  hiddenSteps.length + draftSteps.length > 1
                    ? () => setDraftSteps((ds) => ds.filter((_, idx) => idx !== i))
                    : undefined
                }
              />
            ))}

            <button type="button" className="link-btn" onClick={addDraftStep}>
              + Agregar otra categoría
            </button>
            <button type="submit" className="big-btn" disabled={saving}>
              {saving ? "Guardando..." : formMode === "create" ? "Crear plan" : "Guardar"}
            </button>
            <button type="button" className="link-btn" onClick={closeForm}>
              Cancelar
            </button>
          </form>
        </section>
      )}
      </main>
    </>
  );
}

function StepEditor({ step, onChange, onRemove }) {
  const info = categoryInfo(step.category);
  const isComida = step.category === "comida";

  function setCategory(category) {
    onChange({
      ...step,
      category,
      question: categoryInfo(category).question,
      twoPhase: category === "comida",
      kind: undefined,
      generatedStepId: undefined,
    });
  }

  function setTwoPhase(twoPhase) {
    onChange({ ...step, twoPhase, kind: undefined, generatedStepId: undefined });
  }

  function setQuestion(question) {
    onChange({ ...step, question });
  }

  function setOption(i, field, value) {
    const options = step.options.map((o, idx) => (idx === i ? { ...o, [field]: value } : o));
    onChange({ ...step, options });
  }

  function addOption() {
    onChange({ ...step, options: [...step.options, { name: "", link: "" }] });
  }

  function removeOption(i) {
    onChange({ ...step, options: step.options.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="step-editor">
      <div className="step-editor-head">
        <select value={step.category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
        {onRemove && (
          <button
            type="button"
            className="remove-btn"
            onClick={onRemove}
            aria-label="Quitar categoría"
          >
            ✕
          </button>
        )}
      </div>
      <input
        type="text"
        className="step-question-input"
        value={step.question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={info.question}
      />

      {isComida && (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={step.twoPhase}
            onChange={(e) => setTwoPhase(e.target.checked)}
          />
          Votar primero el tipo de comida y luego el sitio (según tu catálogo de{" "}
          <Link href="/lugares" target="_blank">
            Sitios
          </Link>
          )
        </label>
      )}

      {isComida && step.twoPhase ? (
        <div className="food-type-preview">
          {FOOD_TYPES.map((f) => (
            <span key={f.key} className="food-type-chip">
              {f.emoji} {f.label}
            </span>
          ))}
        </div>
      ) : (
        <>
          {step.options.map((opt, i) => (
            <div key={i} className="option-row option-row-link">
              <input
                type="text"
                placeholder={`Opción ${i + 1}`}
                value={opt.name}
                onChange={(e) => setOption(i, "name", e.target.value)}
              />
              <input
                type="url"
                placeholder="Link (opcional)"
                value={opt.link}
                onChange={(e) => setOption(i, "link", e.target.value)}
              />
              {step.options.length > 2 && (
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
        </>
      )}
    </div>
  );
}

function StepCard({ step, votes, person, people, onVote }) {
  const myVote = votes[person];
  const allVoted = people.length > 0 && people.every((p) => Boolean(votes[p]));
  const info = categoryInfo(step.category);

  const counts = {};
  Object.values(votes).forEach((optId) => {
    counts[optId] = (counts[optId] || 0) + 1;
  });
  const maxVotes = Math.max(0, ...Object.values(counts));

  function handleKeyDown(e, optionId) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onVote(optionId);
    }
  }

  return (
    <section className="poll step-card">
      <p className="step-question">
        {info.emoji} {step.question}
      </p>
      <ul className="options-list">
        {step.options.map((opt) => {
          const selected = myVote === opt.id;
          const voteCount = counts[opt.id] || 0;
          const isWinning = allVoted && maxVotes > 0 && voteCount === maxVotes;
          const voters = allVoted ? Object.entries(votes).filter(([, v]) => v === opt.id) : [];
          return (
            <li key={opt.id}>
              <div
                className={`option-btn ${selected ? "selected" : ""} ${
                  isWinning ? "winning" : ""
                }`}
                role="button"
                tabIndex={0}
                onClick={() => onVote(opt.id)}
                onKeyDown={(e) => handleKeyDown(e, opt.id)}
              >
                <span className="option-radio" />
                <span className="option-main">
                  <span className="option-name">{opt.name}</span>
                  {opt.link && (
                    <a
                      href={opt.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="option-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      🔗 Ver
                    </a>
                  )}
                </span>
                {allVoted && (
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
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="vote-status">
        {people.map((p) => {
          const voted = Boolean(votes[p]);
          const isMe = p === person;
          return (
            <span key={p} className={`vote-status-pill ${voted ? "voted" : ""}`}>
              <span className="avatar sm" style={{ background: colorFor(p, people) }}>
                {p[0]}
              </span>
              {isMe ? "Tú" : p}:{" "}
              {isMe
                ? voted
                  ? "ya votaste"
                  : "aún no votas"
                : voted
                ? "ya votó"
                : "falta que vote"}
            </span>
          );
        })}
      </div>
      {step.kind === "comida-tipo" && allVoted && !step.generatedStepId && (
        <p className="hint-text">
          No tienes suficientes sitios guardados de ese tipo. Agrégalos en{" "}
          <Link href="/lugares">Sitios</Link> para elegir uno la próxima vez.
        </p>
      )}
    </section>
  );
}

function ResolvedBanner({ step, votes }) {
  const info = categoryInfo(step.category);
  const chosen = [...new Set(Object.values(votes))];
  const labels = chosen.map((key) => foodTypeInfo(key).label).join(" y ");
  return (
    <p className="resolved-banner">
      {info.emoji} {step.question}: <strong>{labels}</strong> → elige el sitio abajo 👇
    </p>
  );
}

function Summary({ plan, votes, activeSteps }) {
  return (
    <section className="poll summary-card">
      <p className="step-question">🎉 ¡Su plan está listo!</p>
      <ul className="summary-list">
        {activeSteps.map((step) => {
          const stepVotes = votes[step.id] || {};
          const counts = {};
          Object.values(stepVotes).forEach((id) => {
            counts[id] = (counts[id] || 0) + 1;
          });
          const maxVotes = Math.max(0, ...Object.values(counts));
          const winners = step.options.filter(
            (o) => maxVotes > 0 && (counts[o.id] || 0) === maxVotes
          );
          const info = categoryInfo(step.category);
          return (
            <li key={step.id}>
              <span className="summary-category">
                {info.emoji} {step.question}
              </span>
              <span className="summary-winner">
                {winners.map((w) => w.name).join(" y ")}
                {winners.length === 1 && winners[0].link && (
                  <a
                    href={winners[0].link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="option-link"
                  >
                    🔗 Ver
                  </a>
                )}
              </span>
            </li>
          );
        })}
      </ul>
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
