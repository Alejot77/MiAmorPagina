import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireSession } from "@/lib/session";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// El servidor manda los avisos a la URL que registra el navegador. Solo se
// aceptan los servicios de notificaciones reales, para que nadie pueda
// hacer que el servidor llame a otras direcciones.
const PUSH_HOSTS = [".googleapis.com", ".push.apple.com", ".mozilla.com", ".mozaws.net", ".notify.windows.com"];

function validSubscription(sub) {
  if (!sub || typeof sub.endpoint !== "string" || sub.endpoint.length > 1000) return false;
  if (typeof sub.keys?.p256dh !== "string" || typeof sub.keys?.auth !== "string") return false;
  try {
    const url = new URL(sub.endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.some((h) => url.hostname.endsWith(h));
  } catch {
    return false;
  }
}

export async function POST(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const { subscription } = await readJson(request);
  if (!validSubscription(subscription)) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  }
  const { endpoint, keys } = subscription;
  await kv.hset(`push:${auth.uid}`, { [endpoint]: { endpoint, keys } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const { endpoint } = await readJson(request);
  if (typeof endpoint === "string" && endpoint) await kv.hdel(`push:${auth.uid}`, endpoint);
  return NextResponse.json({ ok: true });
}
