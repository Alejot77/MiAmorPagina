"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PEOPLE, categoryInfo } from "@/config";
import { usePushNotifications } from "@/lib/usePushNotifications";
import type { HistoryEntry, Place, Plan, PointsData, VotesByPlan } from "./types";
import { api } from "./api";
import { Avatar, Button, ConfirmDialog, Icon, Modal, SheetHeader, type IconName } from "./ui";
import { OTHER_PERSON, generatedStep, longDate, stepResult } from "./planUtils";
import { EmptyHome, Home, type HomeActions } from "./Home";
import { FoodRestaurantSetup, ResultSheet, VoteSheet } from "./VoteSheets";
import CreateFlow from "./CreateFlow";
import CalendarScreen from "./CalendarScreen";
import { PlaceDetail, PlaceForm, Places } from "./Places";
import { History, MemoryDetail } from "./History";
import { ProfileMenu, SettingsScreen } from "./Settings";
import Roulette from "./Roulette";
import PushPrompt, { useAutoPushPrompt, type Push } from "./PushPrompt";

type Tab = "home" | "calendar" | "places" | "history";
type Overlay =
  | { type: "none" }
  | { type: "menu" }
  | { type: "settings" }
  | { type: "flower" }
  | { type: "roulette"; options?: string[] }
  | { type: "vote"; planId: string; stepId: string }
  | { type: "result"; planId: string; stepId: string }
  | { type: "restaurants"; planId: string; stepId: string }
  | { type: "planActions"; planId: string }
  | { type: "place"; placeId: string }
  | { type: "placeForm"; placeId?: string }
  | { type: "memory"; planId: string };
type Flow = { mode: "create" | "edit" | "add"; planId?: string; repeatFrom?: Plan; presetDate?: string };
type Toast = { categories: string[]; earned: number; reachedGoal: boolean };

const FLOWER_PERSON = "Stefanny";
const FLOWER_SEEN_KEY = "miamor_flowers_seen";

function isFlowerDay(d = new Date()) {
  return d.getMonth() === 8 && d.getDate() === 21; // 21 de septiembre
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function AppShell({ person, onLogout }: { person: string; onLogout: () => void }) {
  const push = usePushNotifications(person) as Push;
  const [tab, setTab] = useState<Tab>("home");
  const [overlay, setOverlay] = useState<Overlay>({ type: "none" });
  const [flow, setFlow] = useState<Flow | null>(null);
  const [active, setActive] = useState<{ plans: Plan[]; votes: VotesByPlan } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [points, setPoints] = useState<PointsData | null>(null);
  const [settings, setSettings] = useState<{ pointsPerCategory: number; dessertThreshold: number } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [error, setError] = useState("");
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // "¿Activar los avisos?" al entrar (nunca encima del modal de las flores).
  const [pushPromptOpen, setPushPromptOpen] = useAutoPushPrompt(push, overlay.type !== "flower");

  const close = () => setOverlay({ type: "none" });
  const fail = (err: any) => setError(err?.message || "Algo salió mal.");

  const loadPlans = () => api("/api/plan").then((j) => setActive({ plans: j.plans, votes: j.votes })).catch(fail);
  const loadHistory = () => api("/api/history").then((j) => setHistory(j.history)).catch(fail);
  const loadPlaces = () => api("/api/places").then((j) => setPlaces(j.places)).catch(fail);
  const loadPoints = () =>
    Promise.all([api("/api/points"), api("/api/settings")])
      .then(([p, s]) => {
        setPoints(p);
        setSettings(s);
      })
      .catch(fail);

  useEffect(() => {
    loadPlans();
    loadHistory();
    loadPlaces();
    loadPoints();
    if (person === FLOWER_PERSON && isFlowerDay()) {
      try {
        if (localStorage.getItem(FLOWER_SEEN_KEY) !== todayKey()) setOverlay({ type: "flower" });
      } catch {
        setOverlay({ type: "flower" });
      }
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const plans = active?.plans || [];
  const votes = active?.votes || {};
  const findPlan = (id?: string) => plans.find((p) => p.id === id);

  const actions: HomeActions = {
    vote: (plan, step) => setOverlay({ type: "vote", planId: plan.id, stepId: step.id }),
    chooseRestaurants: (plan, step) => setOverlay({ type: "restaurants", planId: plan.id, stepId: step.id }),
    planActions: (plan) => setOverlay({ type: "planActions", planId: plan.id }),
    addCategory: (plan) => setFlow({ mode: "add", planId: plan.id }),
    openPlace: (placeId) => setOverlay({ type: "place", placeId }),
    roulette: (options) => setOverlay({ type: "roulette", options }),
  };

  async function submitVote(planId: string, stepId: string, optionId: string) {
    const j = await api("/api/vote", "POST", { planId, stepId, person, optionId });
    setActive({ plans: j.plans, votes: j.votes });
    const plan = (j.plans as Plan[]).find((p) => p.id === planId);
    const step = plan?.steps.find((s) => s.id === stepId);
    const stepVotes = j.votes[planId]?.[stepId] || {};
    if (step && stepResult(step, stepVotes).allVoted) setOverlay({ type: "result", planId, stepId });
    else close();
  }

  async function submitRestaurants(planId: string, stepId: string, restaurants: any[]) {
    const j = await api("/api/plan/restaurants", "POST", { planId, stepId, person, restaurants });
    setActive({ plans: j.plans, votes: j.votes });
    close();
    loadPlaces();
  }

  async function saveFlow({ targetPlan, weekend, steps, categories }: { targetPlan?: Plan; weekend: string; steps: any[]; categories: string[] }) {
    const before = points?.points[person] || 0;
    const j = targetPlan
      ? await api("/api/plan", "PATCH", { planId: targetPlan.id, weekend, person, steps })
      : await api("/api/plan", "POST", { weekend, person, steps });
    setActive({ plans: j.plans, votes: j.votes });
    setFlow(null);
    setTab("home");
    loadPlaces();
    loadHistory();
    if (j.pointsEarned > 0) {
      const p = await api<PointsData>("/api/points");
      setPoints(p);
      const now = p.points[person] || 0;
      setToast({ categories, earned: j.pointsEarned, reachedGoal: before < p.threshold && now >= p.threshold });
    }
  }

  async function deletePlan() {
    setDeleting(true);
    try {
      const j = await api("/api/plan", "DELETE", { planId: deletePlanId, person });
      setActive({ plans: j.plans, votes: j.votes });
      setDeletePlanId(null);
      close();
    } catch (err) {
      fail(err);
    } finally {
      setDeleting(false);
    }
  }

  function dismissFlower() {
    try {
      localStorage.setItem(FLOWER_SEEN_KEY, todayKey());
    } catch {
      // se ignora
    }
    close();
  }

  function changeTab(next: Tab) {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const latestFavorite = [...history].filter((e) => e.plan.favorite).sort((a, b) => (a.plan.weekend < b.plan.weekend ? 1 : -1))[0];
  const navItems: { id: Tab; icon: IconName; label: string }[] = [
    { id: "home", icon: "home", label: "Finde" },
    { id: "calendar", icon: "calendar", label: "Calendario" },
    { id: "places", icon: "pin", label: "Sitios" },
    { id: "history", icon: "clock", label: "Historial" },
  ];
  const navButton = (item: (typeof navItems)[number]) => (
    <button key={item.id} className={tab === item.id ? "nav-item active" : "nav-item"} onClick={() => changeTab(item.id)}>
      <Icon name={item.icon} /><span>{item.label}</span>
    </button>
  );

  // ---------- Hojas que dependen de datos actuales ----------
  let sheet = null;
  if (overlay.type === "vote" || overlay.type === "result" || overlay.type === "restaurants") {
    const plan = findPlan(overlay.planId);
    const step = plan?.steps.find((s) => s.id === overlay.stepId);
    if (plan && step) {
      const planVotes = votes[plan.id] || {};
      if (overlay.type === "vote") {
        sheet = (
          <VoteSheet
            plan={plan} step={step} votes={planVotes[step.id] || {}} person={person} close={close}
            submit={(optionId) => submitVote(plan.id, step.id, optionId)}
            roulette={(options) => setOverlay({ type: "roulette", options })}
          />
        );
      } else if (overlay.type === "result") {
        sheet = (
          <ResultSheet
            plan={plan} step={step} votes={planVotes[step.id] || {}} places={places} close={close}
            chooseRestaurants={() => setOverlay({ type: "restaurants", planId: plan.id, stepId: step.id })}
            changeVote={() => setOverlay({ type: "vote", planId: plan.id, stepId: step.id })}
            roulette={(options) => setOverlay({ type: "roulette", options })}
          />
        );
      } else {
        const typeResult = stepResult(step, planVotes[step.id]);
        const gen = generatedStep(plan, step);
        sheet = (
          <FoodRestaurantSetup
            plan={plan} typeStep={step} decidedTypes={typeResult.winners.map((o) => o.id)} places={places}
            existing={gen ? gen.options.map((o) => ({ name: o.name, link: o.link, placeId: o.placeId })) : []}
            close={close}
            submit={(restaurants) => submitRestaurants(plan.id, step.id, restaurants)}
          />
        );
      }
    }
  } else if (overlay.type === "planActions") {
    const plan = findPlan(overlay.planId);
    if (plan) {
      sheet = (
        <Modal close={close}>
          <SheetHeader eyebrow="ESTE DÍA" title={longDate(plan.weekend)} close={close} />
          <div className="menu-list">
            <button onClick={() => { close(); setFlow({ mode: "add", planId: plan.id }); }}>
              <span className="menu-icon purple"><Icon name="plus" /></span>
              <span><strong>Agregar una categoría</strong><small>Sumar otra decisión a este día</small></span>
              <Icon name="chevron" />
            </button>
            <button onClick={() => { close(); setFlow({ mode: "edit", planId: plan.id }); }}>
              <span className="menu-icon purple"><Icon name="edit" /></span>
              <span><strong>Editar el plan</strong><small>Cambiar fecha, categorías u opciones</small></span>
              <Icon name="chevron" />
            </button>
            <button onClick={() => setDeletePlanId(plan.id)}>
              <span className="menu-icon pink"><Icon name="trash" /></span>
              <span><strong>Eliminar el plan</strong><small>Se borran sus votos</small></span>
              <Icon name="chevron" />
            </button>
          </div>
        </Modal>
      );
    }
  } else if (overlay.type === "place") {
    const place = places.find((p) => p.id === overlay.placeId);
    if (place) {
      sheet = (
        <PlaceDetail
          place={place} person={person} close={close}
          onEdit={() => setOverlay({ type: "placeForm", placeId: place.id })}
          onChanged={loadPlaces}
          onDeleted={() => { loadPlaces(); close(); }}
        />
      );
    }
  } else if (overlay.type === "placeForm") {
    const place = overlay.placeId ? places.find((p) => p.id === overlay.placeId) : undefined;
    sheet = (
      <PlaceForm
        place={place} person={person}
        close={() => (place ? setOverlay({ type: "place", placeId: place.id }) : close())}
        onSaved={() => { loadPlaces(); place ? setOverlay({ type: "place", placeId: place.id }) : close(); }}
      />
    );
  } else if (overlay.type === "memory") {
    const entry = history.find((e) => e.plan.id === overlay.planId);
    if (entry) {
      sheet = (
        <MemoryDetail
          entry={entry} person={person} close={close}
          onRepeat={(plan) => { close(); setFlow({ mode: "create", repeatFrom: plan }); }}
          onChanged={loadHistory}
          onDeleted={() => { loadHistory(); close(); }}
        />
      );
    }
  }

  const flowPlan = flow?.planId ? findPlan(flow.planId) : undefined;
  const other = OTHER_PERSON(person);

  return (
    <div className="app-shell">
      <div className="mobile-app">
        <header className="app-header">
          <div className="couple-mark">
            <div className="avatar-pair">{PEOPLE.map((p) => <Avatar key={p} person={p} />)}</div>
            <div><span className="eyebrow">{PEOPLE.join(" + ").toUpperCase()}</span><strong>Plan de dos</strong></div>
          </div>
          <button className="icon-button" onClick={() => setOverlay({ type: "menu" })} aria-label="Abrir menú"><Icon name="dots" /></button>
        </header>

        {error && (
          <div style={{ padding: "14px 20px 0" }}>
            <div className="error-banner"><span>{error}</span><button onClick={() => setError("")}>Cerrar</button></div>
          </div>
        )}

        {tab === "home" && (
          !active ? <p className="loading-state">Cargando su finde...</p>
            : plans.length > 0
              ? <Home plans={plans} votes={votes} person={person} places={places} actions={actions} />
              : <EmptyHome onCreate={() => setFlow({ mode: "create" })} canRepeat={Boolean(latestFavorite)} onRepeat={() => latestFavorite && setFlow({ mode: "create", repeatFrom: latestFavorite.plan })} />
        )}
        {tab === "calendar" && (
          <CalendarScreen
            entries={[...plans.map((p) => ({ plan: p, votes: votes[p.id] || {}, active: true })), ...history.map((e) => ({ ...e, active: false }))]}
            onCreateForDate={(date) => setFlow({ mode: "create", presetDate: date })}
            onOpenActive={() => changeTab("home")}
            onOpenMemory={(planId) => setOverlay({ type: "memory", planId })}
          />
        )}
        {tab === "places" && <Places places={places} onOpen={(id) => setOverlay({ type: "place", placeId: id })} onAdd={() => setOverlay({ type: "placeForm" })} />}
        {tab === "history" && <History entries={history} onOpen={(planId) => setOverlay({ type: "memory", planId })} />}

        <nav className="bottom-nav" aria-label="Navegación principal">
          {navItems.slice(0, 2).map(navButton)}
          <button className="create-button" onClick={() => setFlow({ mode: "create" })} aria-label="Crear plan"><Icon name="plus" size={27} /></button>
          {navItems.slice(2).map(navButton)}
        </nav>

        {flow && (
          <CreateFlow
            mode={flow.mode}
            person={person}
            plan={flowPlan}
            repeatFrom={flow.repeatFrom}
            presetDate={flow.presetDate}
            activePlans={plans}
            places={places}
            close={() => setFlow(null)}
            save={saveFlow}
          />
        )}

        {overlay.type === "menu" && (
          <ProfileMenu
            person={person} points={points} close={close}
            openRoulette={() => setOverlay({ type: "roulette" })}
            openSettings={() => setOverlay({ type: "settings" })}
            logout={onLogout}
          />
        )}
        {overlay.type === "settings" && (
          <SettingsScreen person={person} points={points} settings={settings} push={push} close={close} onChanged={loadPoints} />
        )}
        {overlay.type === "roulette" && <Roulette places={places} initialOptions={overlay.options} close={close} />}
        {overlay.type === "flower" && (
          <Modal close={dismissFlower}>
            <div className="flower-sheet">
              <span className="result-emoji">🌼</span>
              <h2>Hoy es 21 de septiembre</h2>
              <p>Y aquí están tus flores amarillas.</p>
              <Link href="/flores" className="btn btn-primary" onClick={dismissFlower}>Ver mi universo de flores</Link>
              <Button variant="ghost" onClick={dismissFlower}>Ahora no</Button>
            </div>
          </Modal>
        )}
        {sheet}

        {deletePlanId && (
          <ConfirmDialog
            title="¿Eliminar este plan?"
            message="Se borran el plan y todos sus votos. No se puede deshacer."
            confirmLabel="Eliminar plan"
            busy={deleting}
            onConfirm={deletePlan}
            onCancel={() => setDeletePlanId(null)}
          />
        )}

        <PushPrompt push={push} open={pushPromptOpen} onClose={() => setPushPromptOpen(false)} />

        {toast && (
          <div className="points-toast">
            <button onClick={() => setToast(null)} aria-label="Cerrar"><Icon name="close" size={16} /></button>
            <div>
              <span>{toast.reachedGoal ? `¡Llegaste a ${points?.threshold}! 🍰` : "Plan guardado 💜"}</span>
              <strong>{toast.categories.map((c) => `${categoryInfo(c).emoji} ${categoryInfo(c).label}`).join(" · ")}</strong>
              <small>+{toast.earned} pts para {person} 🏆{toast.reachedGoal ? ` · ${other} te debe un postre.` : ""}</small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
