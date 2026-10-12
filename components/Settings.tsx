"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { GROUP_NAME_MAX, PEOPLE, THEMES, TOGETHER_SINCE, themeInfo } from "@/config";
import type { Account, PointsData } from "./types";
import { api } from "./api";
import { Avatar, Button, ConfirmDialog, Icon, PointsProgress } from "./ui";
import { OTHER_PERSON } from "./planUtils";
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

// Nombre del grupo: lo ven los dos (encabezado y login).
function GroupNameForm({ person, groupName, onGroupName }: { person: string; groupName: string; onGroupName: (name: string) => void }) {
  const [name, setName] = useState(groupName);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(groupName), [groupName]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    setBusy(true);
    try {
      const res = await api<{ name: string }>("/api/group", "PUT", { person, name });
      onGroupName(res.name);
      setMsg("Nombre guardado ✓");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <p className="email-status">Aparece arriba en la app y al entrar. Lo ven los dos.</p>
      <div className="password-fields">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={GROUP_NAME_MAX} placeholder="Plan de dos" />
      </div>
      {error && <p className="form-error" style={{ margin: "0 0 10px" }}>{error}</p>}
      {msg && <p className="form-success" style={{ margin: "0 0 10px" }}>{msg}</p>}
      <Button type="submit" variant="secondary" className="full" disabled={busy || name.trim() === groupName}>
        {busy ? "Guardando..." : "Guardar nombre"}
      </Button>
    </form>
  );
}

// Correo de la cuenta: el verificado es el que recibe los enlaces de
// "¿Olvidaste tu clave?". Cambiarlo pide la clave actual.
function EmailSettings({ person, account, onChanged }: { person: string; account: Account | null; onChanged: (a: Account) => void }) {
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
      const res = await api("/api/auth/email", "PATCH", { person, password, email });
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
      await api("/api/auth/email", "POST", { person });
      setMsg(`Listo, lo reenviamos a ${account?.pendingEmail}. Si no lo ves, revisa la carpeta de Spam.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const hasAny = Boolean(account?.email || account?.pendingEmail);
  return (
    <>
      <p className="email-status">
        {account?.email && <>Verificado: <strong>{account.email}</strong>{account.pendingEmail ? " (se sigue usando hasta que confirmes el nuevo)" : ""}<br /></>}
        {account?.pendingEmail && <>Esperando confirmación: <strong>{account.pendingEmail}</strong></>}
        {!hasAny && "Todavía no tienes correo. Sin él no podemos ayudarte si olvidas tu clave."}
      </p>
      {account?.pendingEmail && (
        <Button variant="ghost" className="full" onClick={resend} disabled={busy}>Reenviar el enlace</Button>
      )}
      <form onSubmit={save}>
        <div className="password-fields">
          <input type="email" placeholder={hasAny ? "Correo nuevo" : "tu@correo.com"} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <input type="password" placeholder="Tu clave actual" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        {error && <p className="form-error" style={{ margin: "0 0 10px" }}>{error}</p>}
        {msg && <p className="form-success" style={{ margin: "0 0 10px" }}>{msg}</p>}
        <Button type="submit" variant="secondary" className="full" disabled={busy}>
          {busy ? "Un momento..." : hasAny ? "Cambiar mi correo" : "Vincular mi correo"}
        </Button>
      </form>
    </>
  );
}

// Pestaña "Cuenta": puntos de los dos y todos los ajustes en desplegables.
export function AccountPage({ person, points, settings, push, account, theme, groupName, focus, onChanged, onAccountChanged, onTheme, onGroupName, onLogout }: {
  person: string;
  points: PointsData | null;
  settings: { pointsPerCategory: number; dessertThreshold: number } | null;
  push: Push;
  account: Account | null;
  theme: string;
  groupName: string;
  focus?: { group: string; at: number } | null;
  onChanged: () => void;
  onAccountChanged: (a: Account) => void;
  onTheme: (id: string) => void;
  onGroupName: (name: string) => void;
  onLogout: () => void;
}) {
  const [draftPoints, setDraftPoints] = useState(String(settings?.pointsPerCategory ?? 10));
  const [draftGoal, setDraftGoal] = useState(String(settings?.dessertThreshold ?? 100));
  const [configMsg, setConfigMsg] = useState("");
  const [configError, setConfigError] = useState("");
  const [confirmPerson, setConfirmPerson] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  const [error, setError] = useState("");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const group = (id: string) => ({ id, open: openGroup === id, onToggle: () => setOpenGroup(openGroup === id ? null : id) });

  // Desde otra pantalla se puede pedir abrir un bloque (ej. "Vincular" correo).
  useEffect(() => {
    if (!focus) return;
    setOpenGroup(focus.group);
    window.setTimeout(() => document.getElementById(`grupo-${focus.group}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }, [focus?.at]);

  const goal = points?.threshold || 100;
  const perCategory = settings?.pointsPerCategory ?? 10;

  async function saveConfig() {
    setConfigMsg("");
    setConfigError("");
    try {
      await api("/api/settings", "PUT", { person, pointsPerCategory: Number(draftPoints), dessertThreshold: Number(draftGoal) });
      setConfigMsg("Configuración guardada ✓");
      onChanged();
    } catch (err: any) {
      setConfigError(err.message);
    }
  }

  async function resetPoints() {
    setBusy(true);
    try {
      await api("/api/points", "DELETE", { person: confirmPerson });
      setConfirmPerson(null);
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function claimDessert(who: string) {
    setError("");
    try {
      await api("/api/points", "POST", { person: who });
      onChanged();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg("");
    setPwError("");
    if (pw.next.length < 6) return setPwError("La clave nueva debe tener al menos 6 caracteres");
    if (pw.next !== pw.confirm) return setPwError("Las claves nuevas no coinciden");
    try {
      await api("/api/auth", "PUT", { person, currentPassword: pw.current, newPassword: pw.next, newPasswordConfirm: pw.confirm });
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg("¡Clave actualizada!");
    } catch (err: any) {
      setPwError(err.message);
    }
  }

  return (
    <main className="page account-page">
      <span className="eyebrow">TU CUENTA</span>
      <div className="account-hero">
        <Avatar person={person} />
        <div>
          <h1>{person}</h1>
          <p>Planeando juntos desde {TOGETHER_SINCE} <span className="heart">♥</span></p>
        </div>
      </div>

          {error && <p className="form-error">{error}</p>}

          <span className="settings-label">PUNTOS</span>
          <section className="couple-points">
            {PEOPLE.map((p) => {
              const pts = points?.points[p] || 0;
              const desserts = points?.desserts[p] || 0;
              const reached = pts >= goal;
              const other = OTHER_PERSON(p);
              return (
                <div className="person-points" key={p}>
                  <div className="person-heading">
                    <Avatar person={p} />
                    <div><span>{p.toUpperCase()}{p === person ? " · TÚ" : ""}</span><strong>{pts} pts</strong></div>
                  </div>
                  <PointsProgress points={pts} goal={goal} person={p} />
                  <div className="person-progress-copy">
                    <span>{pts} / {goal}{desserts > 0 ? ` · 🍰 ${desserts} ${desserts === 1 ? "postre ganado" : "postres ganados"}` : ""}</span>
                    <span>{reached ? `${other} le debe un postre 🍰` : `Faltan ${goal - pts} pts para el postre 🍰`}</span>
                  </div>
                  {reached && <Button variant="secondary" className="claim-dessert" onClick={() => claimDessert(p)}>Reclamar el postre de {p}</Button>}
                </div>
              );
            })}
          </section>

          <span className="settings-label">PREFERENCIAS</span>

          <SettingsGroup icon={<Icon name="edit" />} title="Nombre del grupo" summary={groupName} {...group("nombre")}>
            <GroupNameForm person={person} groupName={groupName} onGroupName={onGroupName} />
          </SettingsGroup>

          <SettingsGroup icon={<Icon name="sparkles" />} title="Tema" summary={`${themeInfo(theme).name} · ${themeInfo(theme).dark ? "oscuro" : "claro"}`} {...group("tema")}>
            <ThemePicker theme={theme} onTheme={onTheme} />
          </SettingsGroup>

          <SettingsGroup icon="🔔" title="Avisos" summary={pushSummary(push).text} summaryOn={pushSummary(push).on} {...group("avisos")}>
            <PushPanel push={push} />
          </SettingsGroup>

          <SettingsGroup icon={<Icon name="sliders" />} title="Reglas de puntos" summary={`${perCategory} pts por categoría · postre a los ${goal}`} {...group("puntos")}>
            <p className="email-status">Cada categoría que agregas a un plan suma {perCategory} puntos. Al llegar a {goal}, el otro te invita un postre 🍰 Las reglas aplican para los dos.</p>
            <div className="number-settings">
              <label><span>Puntos por categoría agregada</span><input type="number" min="1" value={draftPoints} onChange={(e) => setDraftPoints(e.target.value)} /></label>
              <label><span>Puntos para ganar un postre</span><input type="number" min="1" value={draftGoal} onChange={(e) => setDraftGoal(e.target.value)} /></label>
            </div>
            {configError && <p className="form-error" style={{ margin: "0 0 10px" }}>{configError}</p>}
            <Button variant="secondary" className="full" onClick={saveConfig}>{configMsg || "Guardar configuración"}</Button>
          </SettingsGroup>

          <span className="settings-label">MI CUENTA</span>

          <SettingsGroup
            icon={<Icon name="mail" />}
            title="Mi correo"
            summary={account?.email ? account.email : account?.pendingEmail ? `Por confirmar: ${account.pendingEmail}` : "Sin correo vinculado"}
            summaryOn={Boolean(account?.email)}
            {...group("correo")}
          >
            <EmailSettings person={person} account={account} onChanged={onAccountChanged} />
          </SettingsGroup>

          <SettingsGroup icon={<Icon name="heart" />} title="Mi clave" summary={`Para entrar como ${person}`} {...group("clave")}>
            <form onSubmit={changePassword}>
              <div className="password-fields">
                <input type="password" placeholder="Clave actual" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
                <input type="password" placeholder="Clave nueva" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
                <input type="password" placeholder="Repite la clave nueva" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
              </div>
              {pwError && <p className="form-error" style={{ margin: "0 0 10px" }}>{pwError}</p>}
              {pwMsg && <p className="form-success" style={{ margin: "0 0 10px" }}>{pwMsg}</p>}
              <Button type="submit" variant="secondary" className="full">Cambiar mi clave</Button>
            </form>
          </SettingsGroup>

          <SettingsGroup icon={<Icon name="trash" />} tone="pink" title="Reiniciar progreso" summary="Volver los puntos a 0" {...group("reiniciar")}>
            <p className="email-status">Estas acciones no se pueden deshacer. Los postres ya ganados se mantienen.</p>
            {PEOPLE.map((p) => <button key={p} className="destructive-link" onClick={() => setConfirmPerson(p)}>Reiniciar puntos de {p}</button>)}
          </SettingsGroup>

          <span className="settings-label">MÁS</span>
          <div className="menu-list account-links">
            <Link href="/flores">
              <span className="menu-icon pink"><Icon name="flower" /></span>
              <span><strong>Flores</strong><small>Pequeños detalles entre ustedes</small></span>
              <Icon name="chevron" />
            </Link>
            <button onClick={onLogout}>
              <span className="menu-icon neutral"><Icon name="logout" /></span>
              <span><strong>Cambiar de persona</strong><small>Salir de la cuenta de {person}</small></span>
              <Icon name="chevron" />
            </button>
          </div>
          <div className="profile-signature">Hecho con cariño para dos.</div>
        {confirmPerson && (
          <ConfirmDialog
            title={`¿Reiniciar los puntos de ${confirmPerson}?`}
            message="Su progreso vuelve a 0. Los postres ya ganados se mantienen."
            confirmLabel="Reiniciar puntos"
            busy={busy}
            onConfirm={resetPoints}
            onCancel={() => setConfirmPerson(null)}
          />
        )}
    </main>
  );
}
