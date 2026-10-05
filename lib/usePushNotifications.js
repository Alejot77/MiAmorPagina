"use client";

import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// Una suscripcion queda amarrada a la clave publica con la que se creo. Si
// las claves VAPID cambian en Vercel, el envio a esa suscripcion falla (403)
// aunque el navegador la siga mostrando como activa.
function isStale(sub) {
  const key = sub.options?.applicationServerKey;
  if (!key || !VAPID_KEY) return false;
  const current = urlBase64ToUint8Array(VAPID_KEY);
  const old = new Uint8Array(key);
  return old.length !== current.length || old.some((v, i) => v !== current[i]);
}

// Cancela una suscripcion vieja en el navegador y la borra del servidor.
async function forgetSubscription(sub, person) {
  if (person) {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ person, endpoint: sub.endpoint }),
    }).catch(() => {});
  }
  await sub.unsubscribe().catch(() => {});
}

function createSubscription(reg) {
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
  });
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// Dónde se permiten las notificaciones a mano cuando el navegador no muestra
// la solicitud o quedaron bloqueadas.
export function permissionHelp() {
  if (isIOS()) return "En el iPhone: Ajustes → Notificaciones → Nuestros planes → activa «Permitir notificaciones».";
  if (/android/i.test(navigator.userAgent)) {
    return isInstalled()
      ? "Mantén presionado el ícono de la app → Información de la app (ⓘ) → Notificaciones → actívalas."
      : "Toca el ícono a la izquierda de la dirección, arriba → Permisos → Notificaciones → Permitir.";
  }
  return "Haz clic en el ícono a la izquierda de la dirección (o en la campanita tachada, si aparece) → Notificaciones → Permitir.";
}

// Activa/desactiva notificaciones push para esta persona en este dispositivo.
//
// - supported: el navegador puede recibir push y hay clave VAPID.
// - needsInstall: es un iPhone abriendo la página en Safari. Allá las
//   notificaciones solo existen si la app está agregada a la pantalla de
//   inicio y se abre desde el ícono (por eso el manifest en app/manifest.js).
// - permission: "default" | "granted" | "denied" (del navegador).
export function usePushNotifications(person) {
  const [supported, setSupported] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [permission, setPermission] = useState("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const vapidKey = VAPID_KEY;
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      Boolean(vapidKey);
    setSupported(ok);
    setNeedsInstall(Boolean(vapidKey) && !ok && isIOS() && !isInstalled());
    if (!ok) return;
    setPermission(Notification.permission);

    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(Boolean(sub) && !isStale(sub));
      })
      .catch(() => {});

    // Si la persona cambia el permiso en los ajustes y vuelve a la app, lo notamos.
    const recheck = () => setPermission(Notification.permission);
    document.addEventListener("visibilitychange", recheck);
    return () => document.removeEventListener("visibilitychange", recheck);
  }, []);

  // Re-sincroniza con el servidor la suscripción que ya tiene este
  // dispositivo (por si se perdió en la base de datos o cambió de persona).
  // Si se creó con claves VAPID viejas, la reemplaza por una nueva sin
  // preguntar nada, porque el permiso ya estaba dado.
  useEffect(() => {
    if (!supported || !person) return;
    navigator.serviceWorker.ready
      .then(async (reg) => {
        let sub = await reg.pushManager.getSubscription();
        if (sub && isStale(sub)) {
          await forgetSubscription(sub, person);
          sub = Notification.permission === "granted" ? await createSubscription(reg).catch(() => null) : null;
          setSubscribed(Boolean(sub));
        }
        if (!sub) return;
        return fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person, subscription: sub.toJSON() }),
        });
      })
      .catch(() => {});
  }, [supported, person]);

  const subscribe = useCallback(async () => {
    if (!supported || !person) return;
    setError("");
    setLoading(true);
    try {
      // El permiso se pide ANTES de cualquier otra espera: Safari solo
      // muestra la solicitud si sale directamente del toque en el botón.
      const result = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setError(
          result === "denied"
            ? `Las notificaciones están bloqueadas. ${permissionHelp()}`
            : `No apareció la solicitud o se cerró. ${permissionHelp()}`
        );
        return;
      }
      await navigator.serviceWorker.register("/sw.js");
      // Suscribirse exige un service worker ya activo (en la primera visita
      // puede seguir instalándose).
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub && isStale(sub)) {
        await forgetSubscription(sub, person);
        sub = null;
      }
      if (!sub) sub = await createSubscription(reg);
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person, subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setSubscribed(true);
    } catch (e) {
      setError("No se pudieron activar las notificaciones. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [supported, person]);

  const unsubscribe = useCallback(async () => {
    if (!supported || !person) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person, endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [supported, person]);

  const configured = Boolean(VAPID_KEY);

  return { configured, supported, needsInstall, permission, subscribed, loading, error, subscribe, unsubscribe };
}
