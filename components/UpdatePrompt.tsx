"use client";

import { useEffect, useState } from "react";
import build from "@/lib/version.json";
import { Icon } from "./ui";

// Version con la que se abrio la app (fijada al compilar).
const CURRENT = build.version;
const EVERY = 5 * 60 * 1000;

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// En la app instalada (acceso directo en la pantalla de inicio) el celular
// deja la version vieja abierta por dias. Se pregunta al servidor cual es la
// version publicada al volver a la app y cada tanto; si cambio, se ofrece
// reiniciar.
export default function UpdatePrompt() {
  const [available, setAvailable] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    if (!CURRENT || !isInstalled()) return;
    let found = false;
    const check = async () => {
      if (found || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { version } = await res.json();
        if (version && version !== CURRENT) {
          found = true;
          setAvailable(true);
        }
      } catch {
        // sin conexion: se intenta la proxima vez
      }
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (found) setAvailable(true); // si la cerro con "Luego", vuelve a salir al regresar
      else check();
    };
    const first = window.setTimeout(check, 2000);
    const timer = window.setInterval(check, EVERY);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!available) return null;
  return (
    <div className="update-prompt" role="status">
      <span className="update-prompt-icon">✨</span>
      <div>
        <strong>Hay una versión nueva</strong>
        <small>Reinicia la app para tener lo último.</small>
      </div>
      <button
        className="update-prompt-go"
        disabled={restarting}
        onClick={() => {
          setRestarting(true);
          window.location.reload();
        }}
      >
        {restarting ? "Reiniciando…" : "Reiniciar"}
      </button>
      <button className="update-prompt-close" onClick={() => setAvailable(false)} aria-label="Luego">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
