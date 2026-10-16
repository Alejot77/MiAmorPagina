"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEFAULT_GROUP_NAME, PEOPLE, defaultThemeFor } from "@/config";
import { usePushNotifications } from "@/lib/usePushNotifications";
import { applyTheme, rememberTheme } from "@/lib/useThemePerson";
import type { Account, HistoryEntry, Place, Plan, PointsData, RecapList, VotesByPlan } from "./types";
import { PhotosSection } from "./Photos";
import { RecapStories, monthLabel } from "./Recap";
import { api } from "./api";
import { Avatar, Button, ConfirmDialog, Icon, Modal, SheetHeader, type IconName } from "./ui";
import { OTHER_PERSON, generatedStep, longDate, stepResult } from "./planUtils";
import { EmptyHome, Home, type HomeActions } from "./Home";
import { FoodRestaurantSetup, ResultSheet, VoteSheet } from "./VoteSheets";
import CreateFlow from "./CreateFlow";
import CalendarScreen from "./CalendarScreen";
import { PlaceDetail, PlaceForm, Places } from "./Places";
import { History, MemoryDetail } from "./History";
import { AccountPage } from "./Settings";
import Roulette from "./Roulette";
import PushPrompt, { useAutoPushPrompt, type Push } from "./PushPrompt";

type Tab = "home" | "places" | "history" | "account";
type Overlay =
  | { type: "none" }
  | { type: "flower" }
  | { type: "roulette"; options?: string[] }
  | { type: "vote"; planId: string; stepId: string }
  | { type: "result"; planId: string; stepId: string }
  | { type: "restaurants"; planId: string; stepId: string }
  | { type: "planActions"; planId: string }
  | { type: "place"; placeId: string }
  | { type: "placeForm"; placeId?: string }
  | { type: "memory"; planId: string }
  | { type: "photos"; planId: string }
  | { type: "recap"; month: string };
type Flow = { mode: "create" | "edit" | "add"; planId?: string; repeatFrom?: Plan; presetDate?: string };
type Toast = { labels: string[]; earned: number; reachedGoal: boolean };

const FLOWER_PERSON = "Stefanny";
const FLOWER_SEEN_KEY = "miamor_flowers_seen";

function isFlowerDay(d = new Date()) {
  return d.getMonth() === 8 && d.getDate() === 21; // 21 de septiembre
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Lo que entrega GET /api/session al abrir la app.
export type Boot = { person: string; theme: string; groupName: string; account: Account };

export default function AppShell({ person, boot, onLogout }: { person: string; boot: Boot; onLogout: () => void }) {
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
  const [account, setAccount] = useState<Account | null>(boot.account);
  const [recapList, setRecapList] = useState<RecapList | null>(null);
  const [recapSeenTick, setRecapSeenTick] = useState(0);
  const [groupName, setGroupName] = useState(boot.groupName || DEFAULT_GROUP_NAME);
  const [accountFocus, setAccountFocus] = useState<{ group: string; at: number } | null>(null);
  const [theme, setTheme] = useState(boot.theme || defaultThemeFor(person));
  const [emailBannerMsg, setEmailBannerMsg] = useState("");
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
  const loadRecap = () => api<RecapList>("/api/recap").then(setRecapList).catch(() => {});

  // Tema guardado en la base (por si lo cambió en otro celular).
  const showTheme = (id: string) => {
    setTheme(id);
    applyTheme(id);
    rememberTheme(person, id);
  };
  function chooseTheme(id: string) {
    showTheme(id);
    api("/api/theme", "PUT", { person, theme: id }).catch(fail);
  }

  // El aviso "Su resumen de X está listo" sale en el inicio hasta que lo abren.
  const recapSeenKey = (month: string) => `miamor_recap_seen_${month}`;
  function openRecap(month: string) {
    try {
      localStorage.setItem(recapSeenKey(month), "1");
    } catch {
      // se ignora
    }
    setRecapSeenTick((t) => t + 1);
    setOverlay({ type: "recap", month });
  }

  async function resendVerification() {
    try {
      await api("/api/auth/email", "POST", { person });
      setEmailBannerMsg("Listo, lo reenviamos. Revisa tu correo (y la carpeta de spam).");
    } catch (err: any) {
      setEmailBannerMsg(err.message);
    }
  }

  useEffect(() => {
    loadPlans();
    loadRecap();
    showTheme(boot.theme || defaultThemeFor(person)); // el de la base (puede venir de otro celular)
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
    // El aviso del dia 1 abre la app en /?recap=2026-10.
    const recapMonth = new URLSearchParams(window.location.search).get("recap");
    if (recapMonth && /^\d{4}-\d{2}$/.test(recapMonth)) {
      openRecap(recapMonth);
      window.history.replaceState(null, "", "/");
    }
  }, []);

  useEffect(() => {
    document.title = groupName;
  }, [groupName]);

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
    photos: (plan) => setOverlay({ type: "photos", planId: plan.id }),
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

  async function saveFlow({ targetPlan, weekend, steps, labels }: { targetPlan?: Plan; weekend: string; steps: any[]; labels: string[] }) {
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
      setToast({ labels, earned: j.pointsEarned, reachedGoal: before < p.threshold && now >= p.threshold });
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
    { id: "places", icon: "pin", label: "Sitios" },
    { id: "history", icon: "clock", label: "Historial" },
    { id: "account", icon: "user", label: "Cuenta" },
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
            <button onClick={() => setOverlay({ type: "photos", planId: plan.id })}>
              <span className="menu-icon pink"><Icon name="camera" /></span>
              <span><strong>Fotos del día</strong><small>Para el resumen del mes</small></span>
              <Icon name="chevron" />
            </button>
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
              <span><strong>Eliminar el plan</strong><small>Se borran sus votos y fotos</small></span>
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
  } else if (overlay.type === "photos") {
    const plan = findPlan(overlay.planId) || history.find((e) => e.plan.id === overlay.planId)?.plan;
    if (plan) {
      sheet = (
        <Modal close={() => { close(); loadRecap(); }}>
          <SheetHeader eyebrow="FOTOS DEL DÍA" title={longDate(plan.weekend)} close={() => { close(); loadRecap(); }} />
          <PhotosSection planId={plan.id} person={person} hint="Suban las fotos de este día: aparecen en el resumen del mes." />
        </Modal>
      );
    }
  }

  // Resumen recien abierto (el mes pasado) que todavia no han visto.
  const newRecap = (() => {
    const latest = recapList?.months[0];
    if (!latest || recapSeenTick < 0) return null;
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    if (latest.month !== prevMonth) return null;
    try {
      if (localStorage.getItem(recapSeenKey(latest.month))) return null;
    } catch {
      return null;
    }
    return latest;
  })();

  const flowPlan = flow?.planId ? findPlan(flow.planId) : undefined;
  const other = OTHER_PERSON(person);

  return (
    <div className="app-shell">
      <div className="mobile-app">
        <header className="app-header">
          <div className="couple-mark">
            <div className="avatar-pair">{PEOPLE.map((p) => <Avatar key={p} person={p} />)}</div>
            <strong className="group-name">{groupName}</strong>
          </div>
        </header>

        {tab === "home" && newRecap && (
          <div style={{ padding: "14px 20px 0" }}>
            <button className="recap-banner" onClick={() => openRecap(newRecap.month)}>
              <span>🎁</span>
              <span><strong>Su resumen de {monthLabel(newRecap.month)} está listo</strong><small>Salidas, comidas, planes y fotos del mes</small></span>
              <Icon name="chevron" />
            </button>
          </div>
        )}

        {account && !account.emailVerified && (
          <div style={{ padding: "14px 20px 0" }}>
            <div className="email-banner">
              <span>✉️</span>
              {account.pendingEmail ? (
                <>
                  <p><strong>Confirma tu correo.</strong> {emailBannerMsg || `Te enviamos un enlace a ${account.pendingEmail}. Si no lo ves, revisa la carpeta de Spam.`}</p>
                  <button onClick={resendVerification}>Reenviar</button>
                </>
              ) : (
                <>
                  <p><strong>Vincula tu correo</strong> para poder recuperar tu clave si la olvidas.</p>
                  <button onClick={() => { changeTab("account"); setAccountFocus({ group: "correo", at: Date.now() }); }}>Vincular</button>
                </>
              )}
            </div>
          </div>
        )}

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
        {tab === "places" && <Places places={places} onOpen={(id) => setOverlay({ type: "place", placeId: id })} onAdd={() => setOverlay({ type: "placeForm" })} />}
        {tab === "account" && (
          <AccountPage
            person={person}
            points={points}
            settings={settings}
            push={push}
            account={account}
            theme={theme}
            groupName={groupName}
            focus={accountFocus}
            onTheme={chooseTheme}
            onGroupName={setGroupName}
            onChanged={loadPoints}
            onAccountChanged={(a) => { setAccount(a); setEmailBannerMsg(""); }}
            onLogout={onLogout}
          />
        )}
        {tab === "history" && (
          <History
            entries={history}
            onOpen={(planId) => setOverlay({ type: "memory", planId })}
            recap={recapList}
            onOpenRecap={openRecap}
            calendar={
              <CalendarScreen
                embedded
                entries={[...plans.map((p) => ({ plan: p, votes: votes[p.id] || {}, active: true })), ...history.map((e) => ({ ...e, active: false }))]}
                onCreateForDate={(date) => setFlow({ mode: "create", presetDate: date })}
                onOpenActive={() => changeTab("home")}
                onOpenMemory={(planId) => setOverlay({ type: "memory", planId })}
              />
            }
          />
        )}

        {tab !== "account" && !flow && (
          <button className="roulette-fab" onClick={() => setOverlay({ type: "roulette" })} aria-label="Abrir la ruleta">
            <Icon name="roulette" size={24} />
          </button>
        )}

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

        {overlay.type === "roulette" && <Roulette places={places} initialOptions={overlay.options} close={close} />}
        {overlay.type === "recap" && <RecapStories month={overlay.month} close={close} />}
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
            message="Se borran el plan, sus votos y sus fotos. No se puede deshacer."
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
              <strong>{toast.labels.join(" · ")}</strong>
              <small>+{toast.earned} pts para {person} 🏆{toast.reachedGoal ? ` · ${other} te debe un postre.` : ""}</small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
