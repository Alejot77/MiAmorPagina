import webpush from "web-push";
import { kv } from "@/lib/kv";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:nadie@example.com";

let configured = null;
function ensureConfigured() {
  if (configured !== null) return configured;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[push] Faltan las claves VAPID en Vercel: no se envían avisos");
    configured = false;
    return configured;
  }
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  } catch (err) {
    console.error(`[push] Claves VAPID o VAPID_SUBJECT inválidos: ${err.message}`);
    configured = false;
  }
  return configured;
}


// Solo el servicio (fcm.googleapis.com, web.push.apple.com...) para saber
// qué tipo de dispositivo es sin dejar el endpoint completo en los logs.
function serviceOf(endpoint) {
  try {
    return new URL(endpoint).host;
  } catch {
    return "desconocido";
  }
}

// Manda una notificacion a TODOS los dispositivos suscritos de esa cuenta.
// Si una suscripcion ya no es valida (el navegador la borro), se limpia sola.
// Nunca lanza error: un aviso fallido no debe impedir guardar un plan o voto.
// Todo queda en los logs de Vercel con el prefijo [push].
export async function sendPushToUser(person, payload) {
  try {
    if (!ensureConfigured()) return;
    if (!person) return;

    const subs = (await kv.hgetall(`push:${person}`)) || {};
    const entries = Object.entries(subs);
    if (entries.length === 0) {
      console.log(`[push] ${person} no tiene dispositivos con avisos activados ("${payload.title}" no se envió)`);
      return;
    }

    await Promise.all(
      entries.map(async ([endpoint, sub]) => {
        const service = serviceOf(endpoint);
        try {
          await webpush.sendNotification(sub, JSON.stringify(payload));
          console.log(`[push] Enviado a ${person} (${service}): "${payload.title}"`);
        } catch (err) {
          const status = err?.statusCode ?? "sin código";
          const hint =
            err?.statusCode === 403
              ? " — la suscripción se creó con otras claves VAPID; se renueva cuando esa persona abra la app"
              : "";
          console.error(
            `[push] Falló el envío a ${person} (${service}): ${status} ${err?.body || err?.message || ""}${hint}`
          );
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await kv.hdel(`push:${person}`, endpoint);
            console.log(`[push] Suscripción vencida de ${person} (${service}) eliminada`);
          }
        }
      })
    );
  } catch (err) {
    console.error(`[push] Error inesperado avisando a ${person}: ${err?.message || err}`);
  }
}

// Avisa a los demas miembros de una sala. El titulo lleva el nombre de la
// sala y al tocarlo se abre la app en esa sala.
export async function notifyGroup(group, members, exceptUid, { title, body }) {
  const targets = members.filter((id) => id !== exceptUid);
  await Promise.all(
    targets.map((uid) =>
      sendPushToUser(uid, { title: `${title} · ${group.name}`, body, url: `/?g=${group.id}`, tag: `${group.id}-${Date.now()}` })
    )
  );
}
