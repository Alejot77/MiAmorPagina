"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PEOPLE, TOGETHER_SINCE } from "@/config";
import type { PointsData } from "./types";
import { api } from "./api";
import { Avatar, Button, ConfirmDialog, Icon, Modal, PointsProgress } from "./ui";
import { OTHER_PERSON } from "./planUtils";

type Push = { supported: boolean; subscribed: boolean; loading: boolean; error: string; subscribe: () => void; unsubscribe: () => void };

export function ProfileMenu({ person, points, close, openRoulette, openSettings, logout }: {
  person: string;
  points: PointsData | null;
  close: () => void;
  openRoulette: () => void;
  openSettings: () => void;
  logout: () => void;
}) {
  const mine = points?.points[person] || 0;
  const goal = points?.threshold || 100;
  const remaining = Math.max(0, goal - mine);
  return (
    <Modal close={close}>
      <div className="profile-block personal-profile">
        <div className="profile-current-user">
          <Avatar person={person} />
          <div><span className="eyebrow">CUENTA PERSONAL</span><h2>{person.toUpperCase()}</h2></div>
          <span className="points-badge">🏆 {mine} pts</span>
        </div>
        <PointsProgress points={mine} goal={goal} person={person} />
        <div className="points-caption">
          <span>{mine} / {goal}</span>
          <span>{remaining > 0 ? `${remaining} pts para tu próximo postre 🍰` : "¡Llegaste a la meta! 🍰"}</span>
        </div>
        <div className="relationship-note">
          <span className="mini-pair">{PEOPLE.map((p) => <Avatar key={p} person={p} small />)}</span>
          Planeando juntos desde {TOGETHER_SINCE} <span className="heart">♥</span>
        </div>
      </div>
      <div className="menu-list">
        <button onClick={openRoulette}>
          <span className="menu-icon purple"><Icon name="roulette" /></span>
          <span><strong>Ruleta</strong><small>Cuando decidir se pone difícil</small></span>
          <Icon name="chevron" />
        </button>
        <Link href="/flores">
          <span className="menu-icon pink"><Icon name="flower" /></span>
          <span><strong>Flores</strong><small>Pequeños detalles entre ustedes</small></span>
          <Icon name="chevron" />
        </Link>
        <button onClick={openSettings}>
          <span className="menu-icon neutral"><Icon name="sliders" /></span>
          <span><strong>Ajustes</strong><small>Puntos, avisos y tu clave</small></span>
          <Icon name="chevron" />
        </button>
        <button onClick={logout}>
          <span className="menu-icon neutral"><Icon name="logout" /></span>
          <span><strong>Cambiar de persona</strong><small>Salir de la cuenta de {person}</small></span>
          <Icon name="chevron" />
        </button>
      </div>
      <div className="profile-signature">Hecho con cariño para dos.</div>
    </Modal>
  );
}

export function SettingsScreen({ person, points, settings, push, close, onChanged }: {
  person: string;
  points: PointsData | null;
  settings: { pointsPerCategory: number; dessertThreshold: number } | null;
  push: Push;
  close: () => void;
  onChanged: () => void;
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
    if (pw.next.length < 4) return setPwError("La clave nueva debe tener al menos 4 caracteres");
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
    <Modal close={close} full>
      <div className="settings-screen">
        <header className="settings-header">
          <button className="icon-button" onClick={close} aria-label="Volver"><Icon name="arrow" /></button>
          <div><span className="eyebrow">AJUSTES</span><strong>Perfil y puntos</strong></div>
          <span />
        </header>
        <main className="settings-content">
          <section className="settings-intro">
            <span className="step-emoji">🏆</span>
            <h1>Perfil y puntos</h1>
            <p>Cada categoría que agregas a un plan suma {perCategory} puntos. Al llegar a {goal}, el otro te invita un postre 🍰</p>
          </section>

          {error && <p className="form-error">{error}</p>}

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

          <section className="settings-section">
            <div className="section-title"><Icon name="sliders" /><div><strong>Configuración de puntos</strong><small>Ajusten sus propias reglas</small></div></div>
            <div className="number-settings">
              <label><span>Puntos por categoría agregada</span><input type="number" min="1" value={draftPoints} onChange={(e) => setDraftPoints(e.target.value)} /></label>
              <label><span>Puntos para ganar un postre</span><input type="number" min="1" value={draftGoal} onChange={(e) => setDraftGoal(e.target.value)} /></label>
            </div>
            {configError && <p className="form-error" style={{ margin: "0 0 10px" }}>{configError}</p>}
            <Button variant="secondary" className="full" onClick={saveConfig}>{configMsg || "Guardar configuración"}</Button>
          </section>

          <section className="settings-section">
            <div className="notification-row">
              <span className="menu-icon purple">🔔</span>
              <div>
                <strong>Avisos</strong>
                <small>
                  {!push.supported
                    ? "No disponibles en este dispositivo o navegador"
                    : push.subscribed ? "Activados en este dispositivo" : "Desactivados en este dispositivo"}
                </small>
              </div>
              {push.supported && (
                <button
                  className={`notification-toggle ${push.subscribed ? "on" : ""}`}
                  onClick={push.subscribed ? push.unsubscribe : push.subscribe}
                  disabled={push.loading}
                  aria-label={push.subscribed ? "Desactivar avisos" : "Activar avisos"}
                >
                  <i />
                </button>
              )}
            </div>
            {push.error && <p className="form-error" style={{ margin: "10px 0 0" }}>{push.error}</p>}
          </section>

          <section className="settings-section">
            <div className="section-title"><Icon name="heart" /><div><strong>Mi clave</strong><small>Para entrar como {person}</small></div></div>
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
          </section>

          <section className="settings-section reset-section">
            <strong>Reiniciar progreso</strong>
            <p>Estas acciones no se pueden deshacer.</p>
            {PEOPLE.map((p) => <button key={p} className="destructive-link" onClick={() => setConfirmPerson(p)}>Reiniciar puntos de {p}</button>)}
          </section>
        </main>
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
      </div>
    </Modal>
  );
}
