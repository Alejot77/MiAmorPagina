import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { FOOD_TYPES, PLACE_GROUPS } from "@/config";
import { gk } from "@/lib/groups";
import { loadAllPlans, loadVotesFor, planVoters, stepOutcome, todayStrBogota } from "@/lib/planWindow";
import { requireMember } from "@/lib/session";
import { LIMITS, cleanNote, cleanText, isId, readJson, safeLink } from "@/lib/validate";

export const dynamic = "force-dynamic";

const validFoodType = (key) => FOOD_TYPES.some((f) => f.key === key);
const validGroup = (key) => PLACE_GROUPS.some((g) => g.key === key);

// Campos de texto editables de un sitio, ya limpios.
const FIELDS = {
  link: safeLink,
  area: (v) => cleanText(v, LIMITS.area),
  note: (v) => cleanNote(v),
};

// Visitas = cuantos planes ya pasados (su fecha ya llego) terminaron eligiendo
// ese sitio (votacion decidida, sin empate). No se guarda: se calcula al leer.
async function countVisits(gid, members) {
  const today = todayStrBogota();
  const past = (await loadAllPlans(gid)).filter((p) => p.weekend <= today);
  const votes = await loadVotesFor(gid, past);
  const visits = {};
  for (const plan of past) {
    const voters = planVoters(plan, members);
    for (const step of plan.steps) {
      const { winners } = stepOutcome(step, votes[plan.id]?.[step.id], voters);
      if (winners.length !== 1) continue;
      const option = winners[0];
      // Los planes viejos guardaban el id del sitio como id de la opcion.
      const placeId = option?.placeId || (option?.id?.startsWith("place") ? option.id : null);
      if (placeId) visits[placeId] = (visits[placeId] || 0) + 1;
    }
  }
  return visits;
}

export async function GET(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const ids = (await kv.lrange(gk(auth.gid, "places"), 0, -1)) || [];
  if (ids.length === 0) return NextResponse.json({ places: [] });
  const [raw, visits] = await Promise.all([kv.mget(...ids.map((id) => gk(auth.gid, "place", id))), countVisits(auth.gid, auth.members)]);
  const places = (raw || []).filter(Boolean).map((p) => ({
    ...p,
    group: validGroup(p.group) ? p.group : "comida",
    visits: visits[p.id] || 0,
  }));
  return NextResponse.json({ places });
}

export async function POST(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  const name = cleanText(body.name, LIMITS.name);
  if (!name) {
    return NextResponse.json({ error: "Falta el nombre del sitio" }, { status: 400 });
  }

  const id = `place${Date.now()}`;
  const place = {
    id,
    name,
    group: validGroup(body.group) ? body.group : "comida",
    category: validFoodType(body.category) ? body.category : "otro",
    favorite: Boolean(body.favorite),
    createdBy: auth.uid,
    createdAt: new Date().toISOString(),
  };
  for (const [field, clean] of Object.entries(FIELDS)) {
    const value = clean(body[field]);
    if (value) place[field] = value;
  }

  await Promise.all([kv.set(gk(auth.gid, "place", id), place), kv.lpush(gk(auth.gid, "places"), id)]);
  return NextResponse.json({ place });
}

// Edicion parcial: solo cambia los campos que vienen en el body (asi el
// corazon de "favorito" puede actualizar solo ese campo).
export async function PATCH(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  if (!isId(body.placeId)) {
    return NextResponse.json({ error: "Falta el sitio a editar" }, { status: 400 });
  }

  const existing = await kv.get(gk(auth.gid, "place", body.placeId));
  if (!existing) {
    return NextResponse.json({ error: "Ese sitio no existe" }, { status: 404 });
  }

  const updated = { ...existing };
  if ("name" in body) {
    const name = cleanText(body.name, LIMITS.name);
    if (!name) {
      return NextResponse.json({ error: "Falta el nombre del sitio" }, { status: 400 });
    }
    updated.name = name;
  }
  if ("group" in body && validGroup(body.group)) updated.group = body.group;
  if ("category" in body && validFoodType(body.category)) updated.category = body.category;
  if ("favorite" in body) updated.favorite = Boolean(body.favorite);
  for (const [field, clean] of Object.entries(FIELDS)) {
    if (!(field in body)) continue;
    const value = clean(body[field]);
    if (value) updated[field] = value;
    else delete updated[field];
  }

  await kv.set(gk(auth.gid, "place", body.placeId), updated);
  return NextResponse.json({ place: updated });
}

export async function DELETE(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const { placeId } = await readJson(request);
  if (!isId(placeId)) {
    return NextResponse.json({ error: "Falta el sitio a eliminar" }, { status: 400 });
  }
  await Promise.all([kv.lrem(gk(auth.gid, "places"), 0, placeId), kv.del(gk(auth.gid, "place", placeId))]);
  return NextResponse.json({ ok: true });
}
