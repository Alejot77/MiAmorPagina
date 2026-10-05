"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "push-prompt-dismissed-at";
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
// este dispositivo y no se dijo "Ahora no" en los últimos 7 días. Nunca si
// el permiso ya está bloqueado (el navegador no deja volver a preguntar).
export function useAutoPushPrompt(push, enabled) {
  const [open, setOpen] = useState(false);
  const shouldAsk =
    (push.supported && !push.subscribed && push.permission !== "denied") || push.needsInstall;

  useEffect(() => {
    if (!enabled || !shouldAsk || dismissedRecently()) return;
    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [enabled, shouldAsk]);

  useEffect(() => {
    if (push.subscribed) setOpen(false);
  }, [push.subscribed]);

  return [open, setOpen];
}

// "¿Activar avisos?": el "Sí" es el toque que necesita el navegador (obligatorio
// en iPhone) para mostrar su propia solicitud de permiso. En un iPhone que
// abre la página en Safari, en vez de eso explica cómo instalar la app,
// porque allá las notificaciones solo existen en la app instalada.
export default function PushPrompt({ push, open, onClose }) {
  if (!open) return null;

  const close = () => {
    markDismissed();
    onClose();
  };

  if (push.needsInstall) {
    return (
      <div className="flower-modal-overlay" onClick={close}>
        <div className="flower-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="flower-modal-emoji">🔔</div>
          <h2>Instala la app para recibir avisos</h2>
          <p>En iPhone las notificaciones solo llegan si la app está en tu pantalla de inicio:</p>
          <ol className="push-steps">
            <li>Toca <b>Compartir</b> ⬆️ abajo en Safari.</li>
            <li>Elige <b>«Agregar a inicio»</b> → <b>Agregar</b>.</li>
            <li>Abre la app desde el ícono nuevo 💜 y activa los avisos.</li>
          </ol>
          <div className="flower-modal-actions">
            <button className="big-btn" onClick={close}>Entendido</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flower-modal-overlay" onClick={push.loading ? undefined : close}>
      <div className="flower-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="flower-modal-emoji">🔔</div>
        <h2>¿Activar los avisos?</h2>
        <p>Te avisamos cuando tu amor cree un plan o vote, aunque no tengas la app abierta.</p>
        {push.error && <div className="error push-error">{push.error}</div>}
        <div className="flower-modal-actions">
          {push.error ? (
            <button className="big-btn" onClick={close}>Entendido</button>
          ) : (
            <button className="big-btn" onClick={push.subscribe} disabled={push.loading}>
              {push.loading ? "Esperando permiso…" : "Sí, activar"}
            </button>
          )}
          {!push.error && (
            <button className="link-btn" onClick={close} disabled={push.loading}>
              Ahora no
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
