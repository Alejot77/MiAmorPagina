import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { gk, groupSettings } from "@/lib/groups";
import { isAdmin, requireMember } from "@/lib/session";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

async function loadPoints(gid, members) {
  const values = await Promise.all(members.flatMap((uid) => [kv.get(gk(gid, "points", uid)), kv.get(gk(gid, "desserts", uid))]));
  return {
    points: Object.fromEntries(members.map((uid, i) => [uid, Number(values[i * 2] || 0)])),
    desserts: Object.fromEntries(members.map((uid, i) => [uid, Number(values[i * 2 + 1] || 0)])),
  };
}

// GET -> puntos y premios ganados de cada miembro de la sala.
export async function GET(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const { dessertThreshold, reward } = groupSettings(auth.group);
  return NextResponse.json({ ...(await loadPoints(auth.gid, auth.members)), threshold: dessertThreshold, reward });
}

// POST { uid } -> marcar como cobrado el premio de esa persona: resta la meta
// de sus puntos y suma 1 a sus premios ganados.
export async function POST(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const { uid } = await readJson(request);
  if (!auth.members.includes(uid)) return NextResponse.json({ error: "Esa persona no está en la sala" }, { status: 400 });
  const { dessertThreshold } = groupSettings(auth.group);
  const current = Number((await kv.get(gk(auth.gid, "points", uid))) || 0);
  if (current < dessertThreshold) {
    return NextResponse.json({ error: "Todavía no llega a la meta" }, { status: 400 });
  }
  // decrby es atomico: dos toques seguidos no restan de mas.
  const [points, desserts] = await Promise.all([
    kv.decrby(gk(auth.gid, "points", uid), dessertThreshold),
    kv.incrby(gk(auth.gid, "desserts", uid), 1),
  ]);
  return NextResponse.json({ points, desserts });
}

// DELETE { uid? } (solo admins) -> reinicia los puntos de esa persona o de
// toda la sala. No toca los premios ya ganados (eso es historico).
export async function DELETE(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  if (!isAdmin(auth.group, auth.uid)) {
    return NextResponse.json({ error: "Solo quien administra la sala puede reiniciar puntos" }, { status: 403 });
  }
  const { uid } = await readJson(request);
  if (uid && !auth.members.includes(uid)) return NextResponse.json({ error: "Esa persona no está en la sala" }, { status: 400 });
  await Promise.all((uid ? [uid] : auth.members).map((m) => kv.set(gk(auth.gid, "points", m), 0)));
  return NextResponse.json({ points: (await loadPoints(auth.gid, auth.members)).points });
}
