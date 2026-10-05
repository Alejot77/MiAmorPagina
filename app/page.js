"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PEOPLE,
  PERSON_COLORS,
  CATEGORIES,
  categoryInfo,
  FOOD_TYPES,
  foodTypeInfo,
} from "@/config";
import { useThemePerson } from "@/lib/useThemePerson";
import { usePushNotifications } from "@/lib/usePushNotifications";
import PushPrompt, { useAutoPushPrompt } from "./PushPrompt";

const STORAGE_KEY = "miamor_person";
const FLOWER_SEEN_KEY = "miamor_flowers_seen";
const FLOWER_PERSON = "Stefanny";

function colorFor(name, people) {
  const idx = (people || PEOPLE).indexOf(name);
  return PERSON_COLORS[idx] || "#b98b6f";
}

// En la pantalla de inicio cada boton anticipa el tema de esa persona
// (Alejandro: negro/rojo, Stefanny: blanco/lila).
function personThemeClass(name) {
  if (name === "Alejandro") return "theme-dark";
  if (name === "Stefanny") return "theme-light";
  return "";
}

// yyyy-mm-dd en hora LOCAL, no UTC (toISOString() convierte a UTC y puede
// saltar al dia siguiente/anterior segun la hora y el huso horario).
function formatLocalDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isFlowerDay(d = new Date()) {
  return d.getMonth() === 8 && d.getDate() === 21; // 21 de septiembre
}

function todayKey(d = new Date()) {
  return formatLocalDate(d);
}

function blankStep(category = "comida") {
  return {
    category,
    question: categoryInfo(category).question,
    twoPhase: category === "comida",
    selectedTypes: [],
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
    selectedTypes: step.kind === "comida-tipo" ? step.options.map((o) => o.id) : [],
    options: step.options.map((o) => ({ name: o.name, link: o.link || "" })),
  };
}

function draftToPayload(draft) {
  return {
    ...(draft.id ? { id: draft.id } : {}),
    category: draft.category,
    question: draft.question,
    twoPhase: Boolean(draft.twoPhase),
    selectedTypes: draft.selectedTypes || [],
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
  useThemePerson(person);
  const push = usePushNotifications(person);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFlowerModal, setShowFlowerModal] = useState(false);
  // "¿Activar los avisos?" al entrar (nunca encima del modal de las flores).
  const [pushPromptOpen, setPushPromptOpen] = useAutoPushPrompt(push, Boolean(person) && !showFlowerModal);
  const [deletingId, setDeletingId] = useState(null);

  const [formMode, setFormMode] = useState(null); // null | "create" | "edit" | "addCategory"
  const [editingPlan, setEditingPlan] = useState(null); // plan que esta editando/ampliando (null si es nuevo)
  const [weekendInput, setWeekendInput] = useState(nextSaturday());
  const [draftSteps, setDraftSteps] = useState([]);
  const [hiddenSteps, setHiddenSteps] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pointsToast, setPointsToast] = useState(null);
  const [pendingPerson, setPendingPerson] = useState(null);
  const [authMode, setAuthMode] = useState(null); // null | "checking" | "login" | "setup"
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSaving, setAuthSaving] = useState(false);

  useEffect(() => {
    if (!pointsToast) return;
    const id = setTimeout(() => setPointsToast(null), 3500);
    return () => clearTimeout(id);
  }, [pointsToast]);

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
    fetchPlans();
  }, []);

  useEffect(() => {
    if (data && data.plans && data.plans.length === 0 && !formMode) openCreate();
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

  async function fetchPlans() {
    setLoading(true);
    try {
      const res = await fetch("/api/plan");
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError("No se pudo cargar los planes.");
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

  async function attemptChoose(name) {
    setPendingPerson(name);
    setAuthMode("checking");
    setPasswordInput("");
    setPasswordConfirm("");
    setAuthError("");
    try {
      const res = await fetch(`/api/auth?person=${encodeURIComponent(name)}`);
      const json = await res.json();
      setAuthMode(json.hasPassword ? "login" : "setup");
    } catch (e) {
      setAuthError("No se pudo conectar. Intenta de nuevo.");
      setAuthMode("login");
    }
  }

  async function submitAuth(e) {
    e.preventDefault();
    setAuthError("");

    if (authMode === "setup") {
      if (passwordInput.length < 4) {
        setAuthError("La clave debe tener al menos 4 caracteres");
        return;
      }
      if (passwordInput !== passwordConfirm) {
        setAuthError("Las claves no coinciden");
        return;
      }
    }

    setAuthSaving(true);
    try {
      const res = await fetch("/api/auth", {
        method: authMode === "setup" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          authMode === "setup"
            ? {
                person: pendingPerson,
                newPassword: passwordInput,
                newPasswordConfirm: passwordConfirm,
              }
            : { person: pendingPerson, password: passwordInput }
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        setAuthError(json.error || "Clave incorrecta");
        return;
      }
      choosePerson(pendingPerson);
      cancelAuth();
    } catch (e) {
      setAuthError("Error de conexión. Intenta de nuevo.");
    } finally {
      setAuthSaving(false);
    }
  }

  function cancelAuth() {
    setPendingPerson(null);
    setAuthMode(null);
    setPasswordInput("");
    setPasswordConfirm("");
    setAuthError("");
  }

  async function forgotPassword() {
    if (
      !window.confirm(
        `¿Olvidaste tu clave? Esto borra la clave actual de ${pendingPerson} y vas a tener que crear una nueva.`
      )
    ) {
      return;
    }
    setAuthError("");
    setAuthSaving(true);
    try {
      const res = await fetch("/api/auth", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: pendingPerson }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAuthError(json.error || "No se pudo reiniciar la clave");
        return;
      }
      setPasswordInput("");
      setPasswordConfirm("");
      setAuthMode("setup");
    } catch (e) {
      setAuthError("Error de conexión. Intenta de nuevo.");
    } finally {
      setAuthSaving(false);
    }
  }

  function changePerson() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // se ignora
    }
    setPerson(null);
  }

  async function vote(planId, stepId, optionId) {
    setError("");
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, stepId, person, optionId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al votar");
        return;
      }
      setData((d) => ({ ...d, plans: json.plans, votes: json.votes }));
    } catch (e) {
      setError("Error al votar");
    }
  }

  function openCreate() {
    setError("");
    setEditingPlan(null);
    setWeekendInput(nextSaturday());
    setHiddenSteps([]);
    setDraftSteps([blankStep("comida")]);
    setFormMode("create");
  }

  function openEdit(plan) {
    setError("");
    setEditingPlan(plan);
    setWeekendInput(plan.weekend);
    setHiddenSteps([]);
    setDraftSteps(plan.steps.map(stepToDraft));
    setFormMode("edit");
  }

  function openAddCategory(plan) {
    setError("");
    setEditingPlan(plan);
    setWeekendInput(plan.weekend);
    setHiddenSteps(plan.steps.map(stepToDraft));
    const used = plan.steps.map((s) => s.category);
    setDraftSteps([blankStep(nextCategory(used))]);
    setFormMode("addCategory");
  }

  function closeForm() {
    setFormMode(null);
    setEditingPlan(null);
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
            ? { planId: editingPlan.id, weekend: weekendInput, person, steps }
            : { weekend: weekendInput, person, steps }
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al guardar el plan");
        return;
      }
      setData((d) => ({ plans: json.plans, votes: json.votes, people: d?.people }));
      closeForm();
      if (json.pointsEarned > 0) {
        setPointsToast(json.pointsEarned);
      }
    } catch (e) {
      setError("Error al guardar el plan");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(plan) {
    if (!window.confirm("¿Eliminar este plan y todos sus votos? No se puede deshacer.")) {
      return;
    }
    setError("");
    setDeletingId(plan.id);
    try {
      const res = await fetch("/api/plan", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, person }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al eliminar el plan");
        return;
      }
      if (editingPlan?.id === plan.id) closeForm();
      setData((d) => ({ plans: json.plans, votes: json.votes, people: d?.people }));
    } catch (e) {
      setError("Error al eliminar el plan");
    } finally {
      setDeletingId(null);
    }
  }

  if (!checkedStorage) {
    return null;
  }

  const people = data?.people || PEOPLE;
  const plans = data?.plans || [];

  if (!person) {
    return (
      <main className="wrap center">
        <div className="landing-card">
          <div className="landing-emoji">🤍</div>
          <h1>Nuestros planes</h1>

          {!pendingPerson ? (
            <>
              <p className="subtitle">¿Quién eres?</p>
              <div className="people-buttons">
                {people.map((p) => (
                  <button
                    key={p}
                    className={`person-btn ${personThemeClass(p)}`}
                    onClick={() => attemptChoose(p)}
                  >
                    <span className="avatar">{p[0]}</span>
                    Soy {p}
                  </button>
                ))}
              </div>
            </>
          ) : authMode === "checking" ? (
            <p className="subtitle">Un momento...</p>
          ) : (
            <form className="password-form" onSubmit={submitAuth}>
              <p className="subtitle">
                {authMode === "setup" ? `Crea tu clave, ${pendingPerson}` : `Clave de ${pendingPerson}`}
              </p>
              {authMode === "setup" && (
                <p className="password-hint">
                  Es la primera vez que entras: elige una clave de al menos 4 caracteres. La vas a
                  necesitar la próxima vez.
                </p>
              )}
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••"
                autoFocus
              />
              {authMode === "setup" && (
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Repite la clave"
                />
              )}
              {authError && <p className="error">{authError}</p>}
              <button
                type="submit"
                className={`big-btn ${personThemeClass(pendingPerson)}`}
                disabled={authSaving}
              >
                {authSaving
                  ? "Un momento..."
                  : authMode === "setup"
                  ? "Crear clave y entrar"
                  : "Entrar"}
              </button>
              {authMode === "login" && (
                <button type="button" className="link-btn" onClick={forgotPassword} disabled={authSaving}>
                  ¿Olvidaste tu clave?
                </button>
              )}
              <button type="button" className="link-btn" onClick={cancelAuth}>
                ← Volver
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/perfil" className="topbar-greeting" title="Ver mi perfil">
            <span className="avatar" style={{ background: colorFor(person, people) }}>
              {person[0]}
            </span>
            Hola, {person}
          </Link>
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
      <PushPrompt push={push} open={pushPromptOpen} onClose={() => setPushPromptOpen(false)} />
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

      {pointsToast && (
        <p className="points-toast">
          🏆 +{pointsToast} puntos — <Link href="/perfil">ver perfil</Link>
        </p>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : plans.length > 0 ? (
        plans.map((plan) => (
          <PlanSection
            key={plan.id}
            plan={plan}
            votes={data.votes[plan.id] || {}}
            person={person}
            people={people}
            onVote={(stepId, optionId) => vote(plan.id, stepId, optionId)}
            onEdit={() => openEdit(plan)}
            onAddCategory={() => openAddCategory(plan)}
            onDelete={() => deletePlan(plan)}
            deleting={deletingId === plan.id}
            hideAddButton={Boolean(formMode)}
          />
        ))
      ) : (
        <div className="empty-card">
          Todavía no hay planes para este finde.
          <br />
          ¡Crea uno abajo! 👇
        </div>
      )}

      {!formMode && !loading && (
        <button className="create-toggle" onClick={openCreate}>
          {plans.length > 0 ? "+ Planear otro día (ej. domingo o festivo)" : "+ Crear plan"}
        </button>
      )}

      {formMode && (
        <section className="create-section">
          <h2>
            {formMode === "create" && "Crear plan"}
            {formMode === "edit" && `Editar plan del ${formatDate(editingPlan.weekend)}`}
            {formMode === "addCategory" && `Agregar categoría al plan del ${formatDate(editingPlan.weekend)}`}
          </h2>
          <form onSubmit={submitSteps}>
            {formMode !== "addCategory" && (
              <label>
                Fecha
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

function PlanSection({
  plan,
  votes,
  person,
  people,
  onVote,
  onEdit,
  onAddCategory,
  onDelete,
  deleting,
  hideAddButton,
}) {
  const activeSteps = plan.steps.filter((s) => !isStepSuperseded(s, plan.steps));
  const planComplete =
    activeSteps.length > 0 &&
    activeSteps.every((s) => people.every((p) => Boolean((votes[s.id] || {})[p])));
  const decidedCount = activeSteps.filter((s) =>
    people.every((p) => Boolean((votes[s.id] || {})[p]))
  ).length;
  const pendingCount = activeSteps.length - decidedCount;

  return (
    <section className="plan-section">
      <div className="poll-header plan-header">
        <div>
          <p className="weekend-date">📅 Finde del {formatDate(plan.weekend)}</p>
          <div className="plan-stats">
            <span className="stat-pill">
              {activeSteps.length} categoría{activeSteps.length === 1 ? "" : "s"}
            </span>
            <span className="stat-pill done">
              {decidedCount} decidida{decidedCount === 1 ? "" : "s"}
            </span>
            {pendingCount > 0 && (
              <span className="stat-pill pending">
                {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        <div className="poll-actions">
          <button type="button" className="icon-btn" onClick={onEdit} aria-label="Editar plan">
            ✏️
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onDelete}
            disabled={deleting}
            aria-label="Eliminar plan"
          >
            🗑️
          </button>
        </div>
      </div>

      {planComplete && <Summary votes={votes} activeSteps={activeSteps} />}

      <div className="steps-grid">
        {plan.steps.map((step) =>
          isStepSuperseded(step, plan.steps) ? (
            <ResolvedBanner key={step.id} step={step} votes={votes[step.id] || {}} />
          ) : (
            <StepCard
              key={step.id}
              step={step}
              votes={votes[step.id] || {}}
              person={person}
              people={people}
              onVote={(optionId) => onVote(step.id, optionId)}
            />
          )
        )}
      </div>

      {!hideAddButton && (
        <button type="button" className="create-toggle plan-add-category" onClick={onAddCategory}>
          + Agregar otra categoría a este plan
        </button>
      )}
    </section>
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
      selectedTypes: step.selectedTypes || [],
    });
  }

  function setTwoPhase(twoPhase) {
    onChange({ ...step, twoPhase, kind: undefined, generatedStepId: undefined });
  }

  function toggleType(key) {
    const current = step.selectedTypes || [];
    const selectedTypes = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    onChange({ ...step, selectedTypes, kind: undefined, generatedStepId: undefined });
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
        <label className="toggle-row">
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={step.twoPhase}
              onChange={(e) => setTwoPhase(e.target.checked)}
            />
            <span className="toggle-slider" />
          </span>
          <span className="toggle-text">
            <span className="toggle-title">Comida en 2 pasos</span>
            <span className="toggle-desc">
              Primero el tipo, luego el sitio según tu{" "}
              <Link href="/lugares" target="_blank">
                catálogo de Sitios
              </Link>
              .
            </span>
          </span>
        </label>
      )}

      {isComida && step.twoPhase ? (
        <div className="food-type-preview-wrap">
          <p className="food-type-preview-label">
            Elige qué tipos entran a la votación (mínimo 2):
          </p>
          <div className="food-type-preview">
            {FOOD_TYPES.map((f) => {
              const selected = (step.selectedTypes || []).includes(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  className={`food-type-chip ${selected ? "selected" : ""}`}
                  onClick={() => toggleType(f.key)}
                  aria-pressed={selected}
                >
                  {f.emoji} {f.label}
                </button>
              );
            })}
          </div>
          {(step.selectedTypes || []).length < 2 && (
            <p className="food-type-preview-warning">Selecciona al menos 2 tipos.</p>
          )}
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

function Summary({ votes, activeSteps }) {
  return (
    <section className="poll summary-card">
      <p className="step-question">🎉 ¡Este plan está listo!</p>
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
  return formatLocalDate(d);
}

function formatDate(str) {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
