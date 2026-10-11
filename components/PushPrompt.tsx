"use client";

import { useEffect, useState } from "react";
import { permissionHelp } from "@/lib/usePushNotifications";
import { Button } from "./ui";

export type Push = {
  configured: boolean;
  supported: boolean;
  needsInstall: boolean;
  permission: string;
  subscribed: boolean;
  loading: boolean;
  error: string;
  subscribe: () => void;
  unsubscribe: () => void;
};

// "-v2": quien ya había dicho "Ahora no" (o tocado fuera de la ventana, que
// antes también contaba) vuelve a ver la pregunta una vez con esta versión.
const DISMISSED_KEY = "push-prompt-dismissed-at-v2";
const ASK_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY)) || 0;
    return Date.now() - at < ASK_AGAIN_AFTER_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // sin almacenamiento: volverá a preguntar la próxima vez, no pasa nada
  }
}

// Decide si la ventana se abre sola al entrar: si todavía no hay avisos en
// este dispositivo y no se dijo "Ahora no" en los últimos 7 días. Si el
// permiso está bloqueado también se abre, para explicar cómo desbloquearlo.
export function useAutoPushPrompt(push: Push, enabled: boolean) {
  const [open, setOpen] = useState(false);
  const shouldAsk = (push.supported && !push.subscribed) || push.needsInstall;

  useEffect(() => {
    if (!enabled || !shouldAsk || dismissedRecently()) return;
    const timer = window.setTimeout(() => setOpen(true), 1500);
    return () => window.clearTimeout(timer);
  }, [enabled, shouldAsk]);

  useEffect(() => {
    if (push.subscribed) setOpen(false);
  }, [push.subscribed]);

  return [open, setOpen] as const;
}

function InstallSteps() {
  return (
    <ol className="push-steps">
      <li>Abre la app en <b>Safari</b> y toca <b>Compartir</b> ⬆️ (abajo).</li>
      <li>Elige <b>«Agregar a inicio»</b> → <b>Agregar</b>.</li>
      <li>Abre la app desde el ícono nuevo 💜 y activa los avisos.</li>
    </ol>
  );
}

// "¿Activar los avisos?": el "Sí" es el toque que necesita el navegador (obligatorio
// en iPhone) para mostrar su propia solicitud de permiso. En un iPhone que
// abre la página en Safari, en vez de eso explica cómo instalar la app,
// porque allá las notificaciones solo existen en la app instalada. Solo se
// cierra con sus botones: tocar fuera no la silencia.
export default function PushPrompt({ push, open, onClose }: { push: Push; open: boolean; onClose: () => void }) {
  if (!open) return null;

  const close = () => {
    markDismissed();
    onClose();
  };

  let body;
  if (push.needsInstall) {
    body = (
      <>
        <h2>Instala la app para recibir avisos</h2>
        <p>En iPhone las notificaciones solo llegan si la app está en tu pantalla de inicio:</p>
        <InstallSteps />
        <Button className="full" onClick={close}>Entendido</Button>
      </>
    );
  } else if (push.permission === "denied") {
    body = (
      <>
        <h2>Los avisos están bloqueados</h2>
        <p>{permissionHelp()} Después vuelve a la app y actívalos desde Ajustes.</p>
        <Button className="full" onClick={close}>Entendido</Button>
      </>
    );
  } else {
    body = (
      <>
        <h2>¿Activar los avisos?</h2>
        <p>Te avisamos cuando tu amor cree un plan o vote, aunque no tengas la app abierta.</p>
        {push.error && <p className="form-error push-error">{push.error}</p>}
        {push.error ? (
          <Button className="full" onClick={close}>Entendido</Button>
        ) : (
          <>
            <Button className="full" onClick={push.subscribe} disabled={push.loading}>
              {push.loading ? "Esperando permiso…" : "Sí, activar"}
            </Button>
            <Button variant="ghost" className="full" onClick={close} disabled={push.loading}>Ahora no</Button>
          </>
        )}
      </>
    );
  }

  return (
    <div className="confirm-backdrop">
      <div className="confirm-dialog push-dialog">
        <span className="menu-icon purple">🔔</span>
        {body}
      </div>
    </div>
  );
}

// Sección "Avisos" de Ajustes: siempre dice en qué estado están los avisos
// en ESTE dispositivo y ofrece lo que corresponda (activar, desactivar,
// instalar la app o desbloquearlos).
export function PushSettings({ push }: { push: Push }) {
  let status: string;
  let extra = null;
  let toggle = false;
  let action = null;

  if (!push.configured) {
    status = "No están configurados en el servidor (faltan las claves VAPID en Vercel).";
  } else if (push.needsInstall) {
    status = "En iPhone solo funcionan con la app instalada en la pantalla de inicio:";
    extra = <InstallSteps />;
  } else if (!push.supported) {
    status = "Este navegador no permite avisos. Ábrela en Chrome (Android) o en Safari (iPhone) en vez de dentro de otra app.";
  } else if (push.subscribed) {
    status = "Activados en este dispositivo";
    toggle = true;
  } else if (push.permission === "denied") {
    status = `Bloqueados en este dispositivo. ${permissionHelp()}`;
    action = (
      <Button variant="secondary" className="full" onClick={push.subscribe} disabled={push.loading}>
        {push.loading ? "Activando..." : "Ya los permití, activar"}
      </Button>
    );
  } else {
    status = "Desactivados. Actívalos para enterarte cuando tu amor cree un plan o vote.";
    toggle = true;
  }

  return (
    <section className="settings-section">
      <div className="notification-row">
        <span className="menu-icon purple">🔔</span>
        <div><strong>Avisos</strong><small>{status}</small></div>
        {toggle && (
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
      {extra}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
      {push.error && <p className="form-error push-error" style={{ margin: "10px 0 0" }}>{push.error}</p>}
    </section>
  );
}
