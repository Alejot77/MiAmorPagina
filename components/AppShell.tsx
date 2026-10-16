"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEFAULT_THEME } from "@/config";
import { usePushNotifications } from "@/lib/usePushNotifications";
import { applyTheme, rememberTheme } from "@/lib/useThemePerson";
import type { GroupDetail, GroupSummary, HistoryEntry, Me, Place, Plan, PointsData, RecapList, VotesByPlan } from "./types";
import { PhotosSection } from "./Photos";
import { RecapStories, monthLabel } from "./Recap";
import { GROUP_GONE, api, setApiGroup } from "./api";
import { setMembers } from "./members";
import { AvatarStack, Button, ConfirmDialog, Icon, Modal, SheetHeader, type IconName } from "./ui";
import { generatedStep, longDate, stepResult } from "./planUtils";
import { CreateGroupSheet, GroupSwitcher, JoinGroupSheet, Onboarding } from "./Groups";
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

const FLOWER_SEEN_KEY = "miamor_flowers_seen";

function isFlowerDay(d = new Date()) {
  return d.getMonth() === 8 && d.getDate() === 21; // 21 de septiembre
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Lo que entrega GET /api/session al abrir la app.
export type Boot = { user: Me; groups: GroupSummary[]; currentGroup: string | null };

type GroupAppProps = {
  me: Me;
  group: GroupDetail;
  groups: GroupSummary[];
  push: Push;
  onOpenSwitcher: () => void;
  onSwitch: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onCreate: () => void;
  onJoin: () => void;
  onLeave: (newAdmin?: string) => Promise<void>;
  onGroupChanged: (g: GroupDetail) => void;
  onMeChanged: (me: Me) => void;
  onTheme: (id: string) => void;
  onLogout: () => void;
};

// Todo lo de la sala abierta. Se vuelve a montar al cambiar de sala.
function GroupApp({ me, group, groups, push, onOpenSwitcher, onSwitch, onPin, onCreate, onJoin, onLeave, onGroupChanged, onMeChanged, onTheme, onLogout }: GroupAppProps) {
  const person = me.id;
  const [tab, setTab] = useState<Tab>("home");
  const [overlay, setOverlay] = useState<Overlay>({ type: "none" });
  const [flow, setFlow] = useState<Flow | null>(null);
  const [active, setActive] = useState<{ plans: Plan[]; votes: VotesByPlan } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [points, setPoints] = useState<PointsData | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [recapList, setRecapList] = useState<RecapList | null>(null);
  const [recapSeenTick, setRecapSeenTick] = useState(0);
  const [accountFocus, setAccountFocus] = useState<{ group: string; at: number } | null>(null);
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
  const loadPoints = () => api<PointsData>("/api/points").then(setPoints).catch(fail);
  const loadRecap = () => api<RecapList>("/api/recap").then(setRecapList).catch(() => {});


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
      await api("/api/auth/email", "POST");
      setEmailBannerMsg("Listo, lo reenviamos. Revisa tu correo (y la carpeta de spam).");
    } catch (err: any) {
      setEmailBannerMsg(err.message);
    }
  }

  useEffect(() => {
    loadPlans();
    loadRecap();
    loadHistory();
    loadPlaces();
    loadPoints();
    if (me.flowers && isFlowerDay()) {
      try {
        if (localStorage.getItem(FLOWER_SEEN_KEY) !== todayKey()) setOverlay({ type: "flower" });
      } catch {
        setOverlay({ type: "flower" });
      }
    }
    // Los avisos abren la app en /?g=<sala> (y el del dia 1 con &recap=2026-10).
    const params = new URLSearchParams(window.location.search);
    const recapMonth = params.get("recap");
    if (recapMonth && /^\d{4}-\d{2}$/.test(recapMonth)) openRecap(recapMonth);
    if (params.has("g") || params.has("recap")) window.history.replaceState(null, "", "/");
  }, []);

  useEffect(() => {
    document.title = group.name;
  }, [group.name]);

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
    closeVote: async (plan, step) => {
      try {
        const j = await api("/api/vote/close", "POST", { planId: plan.id, stepId: step.id });
        setActive({ plans: j.plans, votes: j.votes });
        setOverlay({ type: "result", planId: plan.id, stepId: step.id });
      } catch (err) {
        fail(err);
      }
    },
    canClose: (plan) => plan.createdBy === person || group.admin,
  };

  async function submitVote(planId: string, stepId: string, optionId: string) {
    const j = await api("/api/vote", "POST", { planId, stepId, optionId });
    setActive({ plans: j.plans, votes: j.votes });
    const plan = (j.plans as Plan[]).find((p) => p.id === planId);
    const step = plan?.steps.find((s) => s.id === stepId);
    const stepVotes = j.votes[planId]?.[stepId] || {};
    if (step && stepResult(step, stepVotes).allVoted) setOverlay({ type: "result", planId, stepId });
    else close();
  }

  async function submitRestaurants(planId: string, stepId: string, restaurants: any[]) {
    const j = await api("/api/plan/restaurants", "POST", { planId, stepId, restaurants });
    setActive({ plans: j.plans, votes: j.votes });
    close();
    loadPlaces();
  }

  async function saveFlow({ targetPlan, weekend, steps, labels }: { targetPlan?: Plan; weekend: string; steps: any[]; labels: string[] }) {
    const before = points?.points[person] || 0;
    const j = targetPlan
      ? await api("/api/plan", "PATCH", { planId: targetPlan.id, weekend, steps })
      : await api("/api/plan", "POST", { weekend, steps });
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
      const j = await api("/api/plan", "DELETE", { planId: deletePlanId });
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
  const pinned = groups.filter((g) => g.pinned);
  const reward = points?.reward || group.settings.reward;
  const others = group.members.filter((m) => m.id !== person);

  return (
    <div className="app-shell">
      <div className="mobile-app">
        <header className="app-header">
          <button className="couple-mark group-switch" onClick={onOpenSwitcher} aria-label="Cambiar de sala">
            <AvatarStack ids={group.members.map((m) => m.id)} max={3} />
            <strong className="group-name">{group.name}</strong>
            <span className="switch-chevron"><Icon name="chevron" size={16} /></span>
          </button>
        </header>
        {pinned.length >= 2 && (
          <nav className="pinned-groups" aria-label="Salas fijadas">
            {pinned.map((g) => (
              <button key={g.id} className={g.id === group.id ? "active" : ""} onClick={() => onSwitch(g.id)}>
                📌 {g.name}
              </button>
            ))}
          </nav>
        )}

        {tab === "home" && newRecap && (
          <div style={{ padding: "14px 20px 0" }}>
            <button className="recap-banner" onClick={() => openRecap(newRecap.month)}>
              <span>🎁</span>
              <span><strong>El resumen de {monthLabel(newRecap.month)} está listo</strong><small>Salidas, comidas, planes y fotos del mes</small></span>
              <Icon name="chevron" />
            </button>
          </div>
        )}

        {!me.emailVerified && (
          <div style={{ padding: "14px 20px 0" }}>
            <div className="email-banner">
              <span>✉️</span>
              {me.pendingEmail ? (
                <>
                  <p><strong>Confirma tu correo.</strong> {emailBannerMsg || `Te enviamos un enlace a ${me.pendingEmail}. Si no lo ves, revisa la carpeta de Spam.`}</p>
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
            me={me}
            group={group}
            groups={groups}
            points={points}
            push={push}
            focus={accountFocus}
            onPointsChanged={loadPoints}
            onMeChanged={(m) => { onMeChanged(m); setEmailBannerMsg(""); }}
            onGroupChanged={onGroupChanged}
            onLeave={onLeave}
            onSwitch={onSwitch}
            onPin={onPin}
            onCreate={onCreate}
            onJoin={onJoin}
            onTheme={onTheme}
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
              <small>+{toast.earned} pts para ti 🏆{toast.reachedGoal ? ` · Ganaste «${reward}»: ${others.length === 1 ? `te lo debe ${others[0].name}` : "te lo debe el grupo"}.` : ""}</small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const byPinned = (a: GroupSummary, b: GroupSummary) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name);

// La cuenta: elige la sala abierta, cambia de sala, crea, une y sale.
export default function AppShell({ boot, onLogout }: { boot: Boot; onLogout: () => void }) {
  const [me, setMe] = useState<Me>(boot.user);
  const [groups, setGroups] = useState<GroupSummary[]>(boot.groups);
  const [gid, setGid] = useState<string | null>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("g");
    return fromUrl && boot.groups.some((g) => g.id === fromUrl) ? fromUrl : boot.currentGroup;
  });
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [sheet, setSheet] = useState<"none" | "switch" | "create" | "join">("none");
  const [loadError, setLoadError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const push = usePushNotifications(me.id) as Push;

  // Tema de la cuenta (viene de la base, puede haberlo cambiado en otro celular).
  useEffect(() => {
    const theme = me.theme || DEFAULT_THEME;
    applyTheme(theme);
    rememberTheme(me.id, theme);
  }, [me.theme]);

  async function refreshGroups() {
    const j = await api<{ groups: GroupSummary[] }>("/api/groups");
    setGroups(j.groups);
    return j.groups;
  }

  // Al cambiar de sala: todas las llamadas van a esa sala y se cargan sus miembros.
  useEffect(() => {
    if (!gid) return;
    let cancelled = false;
    setDetail(null);
    setLoadError("");
    setApiGroup(gid);
    api<{ group: GroupDetail }>(`/api/groups/${gid}`)
      .then((j) => {
        if (cancelled) return;
        setMembers(j.group.members);
        setDetail(j.group);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    api("/api/me", "PATCH", { lastGroup: gid }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gid, reloadTick]);

  // Si te sacan de la sala abierta (o se borra), pasa a otra.
  useEffect(() => {
    const gone = async () => {
      const list = await refreshGroups().catch(() => [] as GroupSummary[]);
      setGid(list[0]?.id || null);
    };
    window.addEventListener(GROUP_GONE, gone);
    return () => window.removeEventListener(GROUP_GONE, gone);
  }, []);

  function switchGroup(id: string) {
    setSheet("none");
    if (id !== gid) {
      setGid(id);
      window.scrollTo({ top: 0 });
    }
  }

  async function pin(id: string, pinned: boolean) {
    setGroups((list) => list.map((g) => (g.id === id ? { ...g, pinned } : g)).sort(byPinned));
    const j = await api<{ user: Me }>("/api/me", "PATCH", { pin: id, pinned }).catch(() => null);
    if (j) setMe(j.user);
  }

  async function ready(group: GroupSummary) {
    setSheet("none");
    await refreshGroups().catch(() => setGroups((list) => [...list, group]));
    setGid(group.id);
  }

  async function leave(newAdmin?: string) {
    await api(`/api/groups/${gid}`, "DELETE", newAdmin ? { newAdmin } : undefined);
    const list = await refreshGroups();
    setGid(list[0]?.id || null);
  }

  function groupChanged(d: GroupDetail) {
    setMembers(d.members);
    setDetail(d);
    setGroups((list) => list.map((g) => (g.id === d.id ? { ...g, name: d.name, members: d.members, admin: d.admin } : g)));
  }

  function chooseTheme(id: string) {
    setMe((m) => ({ ...m, theme: id }));
    api("/api/me", "PATCH", { theme: id }).catch(() => {});
  }

  if (groups.length === 0 || !gid) return <Onboarding me={me} onReady={ready} onLogout={onLogout} />;

  const sheets = (
    <>
      {sheet === "switch" && (
        <GroupSwitcher
          groups={groups}
          currentId={gid}
          close={() => setSheet("none")}
          onSwitch={switchGroup}
          onPin={pin}
          onCreate={() => setSheet("create")}
          onJoin={() => setSheet("join")}
        />
      )}
      {sheet === "create" && <CreateGroupSheet close={() => setSheet("none")} onCreated={ready} />}
      {sheet === "join" && <JoinGroupSheet close={() => setSheet("none")} onJoined={ready} />}
    </>
  );

  if (!detail) {
    return (
      <div className="app-shell">
        <div className="mobile-app">
          {loadError ? (
            <div className="loading-state">
              <p>{loadError}</p>
              <button className="btn btn-secondary" onClick={() => setReloadTick((t) => t + 1)}>Reintentar</button>
            </div>
          ) : (
            <p className="loading-state">Abriendo la sala...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <GroupApp
        key={gid}
        me={me}
        group={detail}
        groups={groups}
        push={push}
        onOpenSwitcher={() => setSheet("switch")}
        onSwitch={switchGroup}
        onPin={pin}
        onCreate={() => setSheet("create")}
        onJoin={() => setSheet("join")}
        onLeave={leave}
        onGroupChanged={groupChanged}
        onMeChanged={setMe}
        onTheme={chooseTheme}
        onLogout={onLogout}
      />
      {sheets}
    </>
  );
}
