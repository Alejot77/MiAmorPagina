"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PEOPLE, PERSON_COLORS } from "@/config";
import { useThemePerson } from "@/lib/useThemePerson";
import { usePushNotifications } from "@/lib/usePushNotifications";
import { PushSettings } from "../PushPrompt";

const STORAGE_KEY = "miamor_person";

function colorFor(name) {
  const idx = PEOPLE.indexOf(name);
  return PERSON_COLORS[idx] || "#b98b6f";
}

export default function Perfil() {
  const [person, setPerson] = useState(null);
  useThemePerson(person);
  const push = usePushNotifications(person);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(null);

  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPwConfirm, setNewPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const [ppcInput, setPpcInput] = useState("");
  const [thresholdInput, setThresholdInput] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [resettingId, setResettingId] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPerson(saved);
    } catch (e) {
      // se ignora
    }
    load();
  }, []);

  function load() {
    Promise.all([
      fetch("/api/points").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ])
      .then(([pointsData, settingsData]) => {
        setData(pointsData);
        setPpcInput(String(settingsData.pointsPerCategory));
        setThresholdInput(String(settingsData.dessertThreshold));
      })
      .catch(() => setError("No se pudo cargar el perfil."));
  }

  async function saveSettings(e) {
    e.preventDefault();
    if (!person) return;
    setSettingsError("");
    setSettingsSuccess("");
    setSettingsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person,
          pointsPerCategory: Number(ppcInput),
          dessertThreshold: Number(thresholdInput),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSettingsError(json.error || "Error al guardar la configuración");
        return;
      }
      setSettingsSuccess("¡Configuración guardada!");
      load();
    } catch (e) {
      setSettingsError("Error de conexión");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function resetPoints(who) {
    const label = who ? `los puntos de ${who}` : "los puntos de los dos";
    if (!window.confirm(`¿Reiniciar ${label} a 0? No se puede deshacer.`)) return;
    setError("");
    setResettingId(who || "all");
    try {
      const res = await fetch("/api/points", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(who ? { person: who } : {}),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al reiniciar los puntos");
        return;
      }
      load();
    } catch (e) {
      setError("Error al reiniciar los puntos");
    } finally {
      setResettingId(null);
    }
  }

  async function claimDessert(who) {
    setError("");
    setClaiming(who);
    try {
      const res = await fetch("/api/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: who }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al reclamar el postre");
        return;
      }
      load();
    } catch (e) {
      setError("Error al reclamar el postre");
    } finally {
      setClaiming(null);
    }
  }

  function togglePwForm() {
    setShowPwForm((v) => !v);
    setCurrentPw("");
    setNewPw("");
    setNewPwConfirm("");
    setPwError("");
    setPwSuccess("");
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (newPw.length < 4) {
      setPwError("La clave nueva debe tener al menos 4 caracteres");
      return;
    }
    if (newPw !== newPwConfirm) {
      setPwError("Las claves nuevas no coinciden");
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person,
          currentPassword: currentPw,
          newPassword: newPw,
          newPasswordConfirm: newPwConfirm,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPwError(json.error || "Error al cambiar la clave");
        return;
      }
      setPwSuccess("¡Clave actualizada!");
      setCurrentPw("");
      setNewPw("");
      setNewPwConfirm("");
    } catch (e) {
      setPwError("Error de conexión");
    } finally {
      setPwSaving(false);
    }
  }

  const threshold = data?.threshold || 100;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/">← Volver</Link>
        </div>
      </header>
      <main className="wrap">
        <h1>Perfil y puntos 🏆</h1>
        <p className="subtitle">
          Cada categoría que armas en un plan te da puntos. Al llegar a {threshold} puntos, el
          otro te debe un postre 🍰
        </p>

        {error && <p className="error">{error}</p>}

        {!data ? (
          <p>Cargando...</p>
        ) : (
          <div className="profile-grid">
            {PEOPLE.map((p) => {
              const points = data.points[p] || 0;
              const desserts = data.desserts[p] || 0;
              const pct = Math.min(100, Math.round((points / threshold) * 100));
              const owesReady = points >= threshold;
              return (
                <section key={p} className="poll profile-card">
                  <div className="profile-head">
                    <span className="avatar" style={{ background: colorFor(p) }}>
                      {p[0]}
                    </span>
                    <div>
                      <p className="profile-name">
                        {p} {person === p && <span className="profile-you">(tú)</span>}
                      </p>
                      <p className="profile-points">{points} pts</p>
                    </div>
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%`, background: colorFor(p) }}
                    />
                  </div>
                  <p className="progress-label">
                    {owesReady
                      ? "¡Llegó al puntaje del postre! 🍰"
                      : `Faltan ${threshold - points} pts para el postre`}
                  </p>

                  {desserts > 0 && (
                    <p className="profile-desserts">🍰 Postres ganados: {desserts}</p>
                  )}

                  {points > 0 && (
                    <button
                      type="button"
                      className="link-btn reset-points-btn"
                      onClick={() => resetPoints(p)}
                      disabled={resettingId === p}
                    >
                      {resettingId === p ? "Reiniciando..." : `Reiniciar puntos de ${p}`}
                    </button>
                  )}

                  {owesReady && (
                    <button
                      className="big-btn"
                      onClick={() => claimDessert(p)}
                      disabled={claiming === p}
                    >
                      {claiming === p ? "Reclamando..." : `Reclamar postre de ${p}`}
                    </button>
                  )}

                  {p === person && (
                    <div className="profile-password">
                      <button type="button" className="link-btn" onClick={togglePwForm}>
                        {showPwForm ? "Cancelar" : "Cambiar mi clave"}
                      </button>
                      {showPwForm && (
                        <form className="password-form" onSubmit={changePassword}>
                          <input
                            type="password"
                            placeholder="Clave actual"
                            value={currentPw}
                            onChange={(e) => setCurrentPw(e.target.value)}
                            required
                          />
                          <input
                            type="password"
                            placeholder="Clave nueva"
                            value={newPw}
                            onChange={(e) => setNewPw(e.target.value)}
                            required
                          />
                          <input
                            type="password"
                            placeholder="Repite la clave nueva"
                            value={newPwConfirm}
                            onChange={(e) => setNewPwConfirm(e.target.value)}
                            required
                          />
                          {pwError && <p className="error">{pwError}</p>}
                          {pwSuccess && <p className="password-success">{pwSuccess}</p>}
                          <button type="submit" className="big-btn" disabled={pwSaving}>
                            {pwSaving ? "Guardando..." : "Guardar clave nueva"}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {person && <PushSettings push={push} />}

        {data && person && (
          <section className="create-section settings-section">
            <h2>⚙️ Configuración de puntos</h2>
            <form onSubmit={saveSettings}>
              <label>
                Puntos por categoría agregada
                <input
                  type="number"
                  min="1"
                  value={ppcInput}
                  onChange={(e) => setPpcInput(e.target.value)}
                  required
                />
              </label>
              <label>
                Puntos para ganar un postre
                <input
                  type="number"
                  min="1"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  required
                />
              </label>
              {settingsError && <p className="error">{settingsError}</p>}
              {settingsSuccess && <p className="password-success">{settingsSuccess}</p>}
              <button type="submit" className="big-btn" disabled={settingsSaving}>
                {settingsSaving ? "Guardando..." : "Guardar configuración"}
              </button>
            </form>
          </section>
        )}
      </main>
    </>
  );
}
