"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { THEMES, themeInfo } from "@/config";
import type { Account, GroupDetail, GroupSummary, Me, PointsData } from "./types";
import { api } from "./api";
import { Avatar, Button, ConfirmDialog, Icon, Modal, PointsProgress, SheetHeader } from "./ui";
import { InvitePanel, MembersPanel } from "./Groups";
import { PushPanel, pushSummary, type Push } from "./PushPrompt";

// Temas de color: cada tarjeta es una miniatura de la app con ese tema.
function ThemePicker({ theme, onTheme }: { theme: string; onTheme: (id: string) => void }) {
  return (
    <>
      <p className="email-status">Solo cambia cómo ves la app tú.</p>
      <div className="theme-grid">
        {THEMES.map((t) => (
          <button key={t.id} className={`theme-option ${theme === t.id ? "selected" : ""}`} onClick={() => onTheme(t.id)} aria-pressed={theme === t.id}>
            <span className="theme-swatch" style={{ background: t.preview[0] }}>
              <i style={{ background: t.preview[1] }}>
                <b style={{ background: t.preview[2] }} />
                <b style={{ background: t.preview[3] }} />
              </i>
            </span>
            <span className="theme-name">{t.name}</span>
            {theme === t.id && <span className="theme-check"><Icon name="check" size={12} /></span>}
            <small>{t.dark ? "Oscuro" : "Claro"}</small>
          </button>
        ))}
      </div>
    </>
  );
}

// Bloque desplegable de Ajustes: el encabezado muestra un resumen y al
// tocarlo se abre (solo uno abierto a la vez).
function SettingsGroup({ id, icon, tone = "purple", title, summary, summaryOn, open, onToggle, children }: {
  id?: string;
  icon: ReactNode;
  tone?: "purple" | "pink";
  title: string;
  summary: ReactNode;
  summaryOn?: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section id={id ? `grupo-${id}` : undefined} className={`settings-section settings-group ${open ? "open" : ""}`}>
      <button className="settings-group-head" onClick={onToggle} aria-expanded={open}>
        <span className={`menu-icon ${tone}`}>{icon}</span>
        <span>
          <strong>{title}</strong>
          <small className={summaryOn ? "on" : ""}>{summary}</small>
        </span>
        <i><Icon name="chevron" size={18} /></i>
      </button>
      <div className="settings-group-body"><div><div className="settings-group-inner">{children}</div></div></div>
    </section>
  );
}

// Un solo campo de texto con boton de guardar (nombre de la sala, mi nombre).
function TextForm({ value, max, placeholder, note, onSave }: {
  value: string;
  max: number;
  placeholder: string;
  note: string;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState(value);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(value), [value]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    setBusy(true);
    try {
      await onSave(text);
      setMsg("Guardado ✓");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <p className="email-status">{note}</p>
      <div className="password-fields">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={max} placeholder={placeholder} />
      </div>
      {error && <p className="form-error" style={{ margin: "0 0 10px" }}>{error}</p>}
      {msg && <p className="form-success" style={{ margin: "0 0 10px" }}>{msg}</p>}
      <Button type="submit" variant="secondary" className="full" disabled={busy || !text.trim() || text.trim() === value}>
        {busy ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}

// Correo de la cuenta: el verificado es el que recibe los enlaces de
// "¿Olvidaste tu clave?". Cambiarlo pide la clave actual.
function EmailSettings({ account, onChanged }: { account: Account; onChanged: (a: Account) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    setBusy(true);
    try {
      const res = await api("/api/auth/email", "PATCH", { password, email });
      onChanged(res);
      setEmail("");
      setPassword("");
      if (res.emailSent === false) setError(res.emailError);
      else setMsg(res.pendingEmail ? `Te enviamos un enlace a ${res.pendingEmail}. Ábrelo para confirmarlo (si no lo ves, revisa la carpeta de Spam).` : "Ese ya es tu correo verificado ✓");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setMsg("");
    setError("");
    setBusy(true);
    try {
      await api("/api/auth/email", "POST");
      setMsg(`Listo, lo reenviamos a ${account.pendingEmail}. Si no lo ves, revisa la carpeta de Spam.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="email-status">
        {account.email && <>Verificado: <strong>{account.email}</strong>{account.pendingEmail ? " (se sigue usando hasta que confirmes el nuevo)" : ""}<br /></>}
        {account.pendingEmail && <>Esperando confirmación: <strong>{account.pendingEmail}</strong></>}
      </p>
      {account.pendingEmail && <Button variant="ghost" className="full" onClick={resend} disabled={busy}>Reenviar el enlace</Button>}
      <form onSubmit={save}>
        <div className="password-fields">
          <input type="email" placeholder="Correo nuevo" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <input type="password" placeholder="Tu clave actual" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        {error && <p className="form-error" style={{ margin: "0 0 10px" }}>{error}</p>}
        {msg && <p className="form-success" style={{ margin: "0 0 10px" }}>{msg}</p>}
        <Button type="submit" variant="secondary" className="full" disabled={busy}>{busy ? "Un momento..." : "Cambiar mi correo"}</Button>
      </form>
    </>
  );
}

function PasswordForm() {
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    if (pw.next.length < 6) return setError("La clave nueva debe tener al menos 6 caracteres");
    if (pw.next !== pw.confirm) return setError("Las claves nuevas no coinciden");
    try {
      await api("/api/auth", "PUT", { currentPassword: pw.current, newPassword: pw.next, newPasswordConfirm: pw.confirm });
      setPw({ current: "", next: "", confirm: "" });
      setMsg("¡Clave actualizada! Se cerró la sesión en tus otros celulares.");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={save}>
      <div className="password-fields">
        <input type="password" placeholder="Clave actual" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required />
        <input type="password" placeholder="Clave nueva" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" required />
        <input type="password" placeholder="Repite la clave nueva" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" required />
      </div>
      {error && <p className="form-error" style={{ margin: "0 0 10px" }}>{error}</p>}
      {msg && <p className="form-success" style={{ margin: "0 0 10px" }}>{msg}</p>}
      <Button type="submit" variant="secondary" className="full">Cambiar mi clave</Button>
    </form>
  );
}

// Reglas de puntos de la sala (solo admins las cambian).
function RulesForm({ group, onChanged }: { group: GroupDetail; onChanged: (g: GroupDetail) => void }) {
  const s = group.settings;
  const [points, setPoints] = useState(String(s.pointsPerCategory));
  const [goal, setGoal] = useState(String(s.dessertThreshold));
  const [reward, setReward] = useState(s.reward);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setMsg("");
    setError("");
    try {
      const res = await api<{ group: GroupDetail }>(`/api/groups/${group.id}`, "PATCH", {
        settings: { pointsPerCategory: Number(points), dessertThreshold: Number(goal), reward },
      });
      onChanged(res.group);
      setMsg("Reglas guardadas ✓");
    } catch (err: any) {
      setError(err.message);
    }
  }

  const text = `Cada categoría que agregas a un plan suma ${s.pointsPerCategory} puntos. Quien llega a ${s.dessertThreshold} gana «${s.reward}» y ${group.members.length === 2 ? "se lo invita el otro" : "se lo invita el grupo"}.`;
  if (!group.admin) return <p className="email-status">{text} Solo quien administra la sala puede cambiar las reglas.</p>;
  return (
    <>
      <p className="email-status">{text}</p>
      <div className="number-settings">
        <label><span>Puntos por categoría agregada</span><input type="number" min="1" value={points} onChange={(e) => setPoints(e.target.value)} /></label>
        <label><span>Puntos para ganar el premio</span><input type="number" min="1" value={goal} onChange={(e) => setGoal(e.target.value)} /></label>
        <label><span>Premio</span><input className="reward-input" value={reward} maxLength={30} onChange={(e) => setReward(e.target.value)} placeholder="postre" /></label>
      </div>
      {error && <p className="form-error" style={{ margin: "0 0 10px" }}>{error}</p>}
      <Button variant="secondary" className="full" onClick={save}>{msg || "Guardar reglas"}</Button>
    </>
  );
}

// Si eres el unico admin, antes de salir eliges quien te reemplaza.
function LeaveAsAdmin({ group, me, close, onLeave }: { group: GroupDetail; me: Me; close: () => void; onLeave: (newAdmin: string) => Promise<void> }) {
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const others = group.members.filter((m) => m.id !== me.id);

  async function leave() {
    setBusy(true);
    setError("");
    try {
      await onLeave(pick);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal close={close}>
      <SheetHeader eyebrow="ANTES DE SALIR" title="Elige al nuevo admin" subtitle={`Eres quien administra «${group.name}». Alguien tiene que quedar a cargo.`} close={close} />
      <div className="admin-pick">
        {others.map((m) => (
          <button key={m.id} className={pick === m.id ? "selected" : ""} onClick={() => setPick(m.id)} aria-pressed={pick === m.id}>
            <Avatar name={m.name} color={m.color} />
            <strong>{m.name}</strong>
            <i>{pick === m.id && <Icon name="check" size={14} />}</i>
          </button>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="confirm-destructive leave-confirm" onClick={leave} disabled={!pick || busy}>
        {busy ? "Saliendo..." : pick ? `Nombrar a ${others.find((m) => m.id === pick)?.name} y salir` : "Elige a alguien"}
      </button>
      <Button variant="ghost" className="full" onClick={close}>Mejor me quedo</Button>
    </Modal>
  );
}

const sinceLabel = (iso: string) => new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(iso));

// Pestaña "Cuenta": la sala abierta (puntos, invitar, miembros, reglas),
// tus salas, preferencias y tu cuenta, en desplegables.
export function AccountPage({ me, group, groups, points, push, focus, onPointsChanged, onMeChanged, onGroupChanged, onLeave, onSwitch, onPin, onCreate, onJoin, onTheme, onLogout, onStartTour }: {
  me: Me;
  group: GroupDetail;
  groups: GroupSummary[];
  points: PointsData | null;
  push: Push;
  focus?: { group: string; at: number } | null;
  onPointsChanged: () => void;
  onMeChanged: (me: Me) => void;
  onGroupChanged: (g: GroupDetail) => void;
  onLeave: (newAdmin?: string) => Promise<void>;
  onSwitch: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onCreate: () => void;
  onJoin: () => void;
  onTheme: (id: string) => void;
  onLogout: () => void;
  onStartTour: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState<string | null>(null); // id o "all"
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const group_ = (id: string) => ({ id, open: openGroup === id, onToggle: () => setOpenGroup(openGroup === id ? null : id) });

  // Desde otra pantalla se puede pedir abrir un bloque (ej. "Vincular" correo).
  useEffect(() => {
    if (!focus) return;
    setOpenGroup(focus.group);
    window.setTimeout(() => document.getElementById(`grupo-${focus.group}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }, [focus?.at]);

  const goal = points?.threshold || group.settings.dessertThreshold;
  const reward = points?.reward || group.settings.reward;
  const pair = group.members.length === 2;
  const ranking = [...group.members].sort((a, b) => (points?.points[b.id] || 0) - (points?.points[a.id] || 0));
  const theme = me.theme || "lila";

  async function claim(uid: string) {
    setError("");
    try {
      await api("/api/points", "POST", { uid });
      onPointsChanged();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      await api("/api/points", "DELETE", confirmReset === "all" ? {} : { uid: confirmReset });
      setConfirmReset(null);
      onPointsChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Unico admin con mas gente en la sala: tiene que nombrar a alguien.
  const soleAdmin = group.admin && group.members.length > 1 && group.members.filter((m) => m.admin).length === 1;

  async function leave() {
    setBusy(true);
    try {
      await onLeave();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
      setConfirmLeave(false);
    }
  }

  return (
    <main className="page account-page">
      <span className="eyebrow">TU CUENTA</span>
      <div className="account-hero">
        <Avatar name={me.name} color={me.color} />
        <div>
          <h1>{me.name}</h1>
          <p>{groups.length} {groups.length === 1 ? "sala" : "salas"} · tema {themeInfo(theme).name}</p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {/* ---------- Sala abierta ---------- */}
      <span className="settings-label">ESTA SALA · {group.name.toUpperCase()}</span>
      <p className="account-since">Planeando juntos desde {sinceLabel(group.createdAt)} <span className="heart">♥</span></p>
      <section className="couple-points">
        {ranking.map((m, i) => {
          const pts = points?.points[m.id] || 0;
          const won = points?.desserts[m.id] || 0;
          const reached = pts >= goal;
          const others = group.members.filter((o) => o.id !== m.id);
          return (
            <div className="person-points" key={m.id}>
              <div className="person-heading">
                <Avatar name={m.name} color={m.color} />
                <div><span>{!pair && `${i + 1}. `}{m.name.toUpperCase()}{m.id === me.id ? " · TÚ" : ""}</span><strong>{pts} pts</strong></div>
              </div>
              <PointsProgress points={pts} goal={goal} color={m.color} />
              <div className="person-progress-copy">
                <span>{pts} / {goal}{won > 0 ? ` · 🏆 ${won} ${won === 1 ? "premio ganado" : "premios ganados"}` : ""}</span>
                <span>{reached ? `🎁 Ganó «${reward}»: ${pair ? `se lo debe ${others[0]?.name}` : "se lo debe el grupo"}` : `Faltan ${goal - pts} pts para «${reward}»`}</span>
              </div>
              {reached && <Button variant="secondary" className="claim-dessert" onClick={() => claim(m.id)}>Marcar «{reward}» de {m.name} como cobrado</Button>}
            </div>
          );
        })}
      </section>

      <SettingsGroup icon={<Icon name="sparkles" />} title="Invitar a la sala" summary={`Código ${group.code}`} {...group_("invitar")}>
        <InvitePanel group={group} onChanged={onGroupChanged} />
      </SettingsGroup>

      <SettingsGroup icon={<Icon name="user" />} title="Miembros" summary={`${group.members.length} ${group.members.length === 1 ? "persona" : "personas"}${group.admin ? " · eres admin" : ""}`} {...group_("miembros")}>
        <MembersPanel group={group} me={me} onChanged={(members) => onGroupChanged({ ...group, members })} />
      </SettingsGroup>

      {group.admin && (
        <SettingsGroup icon={<Icon name="edit" />} title="Nombre de la sala" summary={group.name} {...group_("nombre")}>
          <TextForm
            value={group.name}
            max={40}
            placeholder="Nombre de la sala"
            note="Lo ven todos los de la sala."
            onSave={async (name) => onGroupChanged((await api<{ group: GroupDetail }>(`/api/groups/${group.id}`, "PATCH", { name })).group)}
          />
        </SettingsGroup>
      )}

      <SettingsGroup icon={<Icon name="sliders" />} title="Reglas de puntos" summary={`${group.settings.pointsPerCategory} pts por categoría · «${group.settings.reward}» a los ${group.settings.dessertThreshold}`} {...group_("puntos")}>
        <RulesForm group={group} onChanged={onGroupChanged} />
      </SettingsGroup>

      {group.admin && (
        <SettingsGroup icon={<Icon name="trash" />} tone="pink" title="Reiniciar puntos" summary="Volver los puntos a 0" {...group_("reiniciar")}>
          <p className="email-status">No se puede deshacer. Los premios ya ganados se mantienen.</p>
          {group.members.map((m) => <button key={m.id} className="destructive-link" onClick={() => setConfirmReset(m.id)}>Reiniciar puntos de {m.name}</button>)}
          {group.members.length > 2 && <button className="destructive-link" onClick={() => setConfirmReset("all")}>Reiniciar los de todos</button>}
        </SettingsGroup>
      )}

      <button className="leave-group" onClick={() => setConfirmLeave(true)}>Salir de «{group.name}»</button>
      {soleAdmin && <p className="leave-note">Eres el único admin: al salir eliges quién te reemplaza. También puedes dar admin a alguien desde «Miembros».</p>}

      {/* ---------- Mis salas ---------- */}
      <span className="settings-label">MIS SALAS</span>
      <div className="settings-section my-groups">
        {groups.map((g) => (
          <div key={g.id} className={`group-row ${g.id === group.id ? "current" : ""}`}>
            <button className="group-row-main" onClick={() => g.id !== group.id && onSwitch(g.id)}>
              <span className="mini-pair">{g.members.slice(0, 3).map((m) => <Avatar key={m.id} name={m.name} color={m.color} small />)}</span>
              <span><strong>{g.name}</strong><small>{g.id === group.id ? "Abierta ahora" : `${g.members.length} ${g.members.length === 1 ? "persona" : "personas"}`}</small></span>
              {g.id === group.id && <Icon name="check" size={18} />}
            </button>
            <button className={`pin-button ${g.pinned ? "on" : ""}`} onClick={() => onPin(g.id, !g.pinned)} aria-label={g.pinned ? "Soltar sala" : "Fijar sala"} aria-pressed={g.pinned}>
              <Icon name="pin" size={16} />
            </button>
          </div>
        ))}
        <div className="group-actions">
          <Button variant="secondary" onClick={onCreate}><Icon name="plus" size={17} /> Crear sala</Button>
          <Button variant="ghost" onClick={onJoin}>Unirme con código</Button>
        </div>
      </div>

      {/* ---------- Preferencias ---------- */}
      <span className="settings-label">PREFERENCIAS</span>
      <SettingsGroup icon={<Icon name="sparkles" />} title="Tema" summary={`${themeInfo(theme).name} · ${themeInfo(theme).dark ? "oscuro" : "claro"}`} {...group_("tema")}>
        <ThemePicker theme={theme} onTheme={onTheme} />
      </SettingsGroup>
      <SettingsGroup icon="🔔" title="Avisos" summary={pushSummary(push).text} summaryOn={pushSummary(push).on} {...group_("avisos")}>
        <PushPanel push={push} />
      </SettingsGroup>

      {/* ---------- Mi cuenta ---------- */}
      <span className="settings-label">MI CUENTA</span>
      <SettingsGroup icon={<Icon name="user" />} title="Mi nombre" summary={me.name} {...group_("minombre")}>
        <TextForm
          value={me.name}
          max={30}
          placeholder="Tu nombre"
          note="Así te ven en todas tus salas."
          onSave={async (name) => onMeChanged({ ...me, ...(await api<{ user: Me }>("/api/me", "PATCH", { name })).user })}
        />
      </SettingsGroup>
      <SettingsGroup
        icon={<Icon name="mail" />}
        title="Mi correo"
        summary={me.email ? me.email : me.pendingEmail ? `Por confirmar: ${me.pendingEmail}` : "Sin correo"}
        summaryOn={Boolean(me.email)}
        {...group_("correo")}
      >
        <EmailSettings account={me} onChanged={(a) => onMeChanged({ ...me, ...a })} />
      </SettingsGroup>
      <SettingsGroup icon={<Icon name="heart" />} title="Mi clave" summary="Cambiar la clave para entrar" {...group_("clave")}>
        <PasswordForm />
      </SettingsGroup>

      <span className="settings-label">MÁS</span>
      <div className="menu-list account-links">
        <button onClick={onStartTour}>
          <span className="menu-icon purple"><Icon name="sparkles" /></span>
          <span><strong>Ver la visita guiada</strong><small>Un repaso rápido de todo lo que puedes hacer</small></span>
          <Icon name="chevron" />
        </button>
        {me.flowers && (
          <Link href="/flores">
            <span className="menu-icon pink"><Icon name="flower" /></span>
            <span><strong>Flores</strong><small>Pequeños detalles entre ustedes</small></span>
            <Icon name="chevron" />
          </Link>
        )}
        <button onClick={onLogout}>
          <span className="menu-icon neutral"><Icon name="logout" /></span>
          <span><strong>Cerrar sesión</strong><small>Salir de la cuenta de {me.name} en este celular</small></span>
          <Icon name="chevron" />
        </button>
      </div>
      <div className="profile-signature">Hecho con cariño para planear juntos.</div>

      {confirmReset && (
        <ConfirmDialog
          title={confirmReset === "all" ? "¿Reiniciar los puntos de todos?" : `¿Reiniciar los puntos de ${group.members.find((m) => m.id === confirmReset)?.name}?`}
          message="El progreso vuelve a 0. Los premios ya ganados se mantienen."
          confirmLabel="Reiniciar puntos"
          busy={busy}
          onConfirm={reset}
          onCancel={() => setConfirmReset(null)}
        />
      )}
      {confirmLeave && soleAdmin && (
        <LeaveAsAdmin group={group} me={me} close={() => setConfirmLeave(false)} onLeave={(id) => onLeave(id)} />
      )}
      {confirmLeave && !soleAdmin && (
        <ConfirmDialog
          title={`¿Salir de «${group.name}»?`}
          message={group.members.length === 1 ? "Eres la última persona: la sala y todo lo suyo se borran." : "Dejas de ver sus planes. Puedes volver con el código de invitación."}
          confirmLabel="Salir de la sala"
          busy={busy}
          onConfirm={leave}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </main>
  );
}
