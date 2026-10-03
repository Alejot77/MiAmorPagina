import webpush from "web-push";
import { kv } from "@/lib/kv";
import { PEOPLE } from "@/config";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:nadie@example.com";

let configured = false;
function ensureConfigured() {
  if (configured) return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  }
  configured = true;
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

export function otherPerson(name) {
  return PEOPLE.find((p) => p !== name) || null;
}

// Manda una notificacion a TODOS los dispositivos suscritos de esa persona.
// Si una suscripcion ya no es valida (el navegador la borro), se limpia sola.
export async function sendPushToPerson(person, payload) {
  if (!ensureConfigured()) return; // VAPID sin configurar: no hace nada
  if (!PEOPLE.includes(person)) return;

  const subs = (await kv.hgetall(`push:${person}`)) || {};
  const entries = Object.entries(subs);
  if (entries.length === 0) return;

  await Promise.all(
    entries.map(async ([endpoint, sub]) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await kv.hdel(`push:${person}`, endpoint);
        }
      }
    })
  );
}
