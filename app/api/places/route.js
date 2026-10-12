import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE, FOOD_TYPES, PLACE_GROUPS } from "@/config";
import { loadAllPlans, loadVotesFor, todayStrBogota } from "@/lib/planWindow";
import { requireSession } from "@/lib/session";
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
// ese sitio, con los dos votando por el. No se guarda: se calcula al leer.
async function countVisits() {
  const today = todayStrBogota();
  const past = (await loadAllPlans()).filter((p) => p.weekend <= today);
  const votes = await loadVotesFor(past);
  const visits = {};
  for (const plan of past) {
    for (const step of plan.steps) {
      const chosen = PEOPLE.map((p) => votes[plan.id]?.[step.id]?.[p]);
      if (chosen.some((v) => !v) || new Set(chosen).size !== 1) continue;
      const option = step.options.find((o) => o.id === chosen[0]);
      // Los planes viejos guardaban el id del sitio como id de la opcion.
      const placeId = option?.placeId || (option?.id?.startsWith("place") ? option.id : null);
      if (placeId) visits[placeId] = (visits[placeId] || 0) + 1;
    }
  }
  return visits;
}

export async function GET(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const ids = (await kv.lrange("places", 0, -1)) || [];
  if (ids.length === 0) return NextResponse.json({ places: [] });
  const [raw, visits] = await Promise.all([kv.mget(...ids.map((id) => `place:${id}`)), countVisits()]);
  const places = (raw || []).filter(Boolean).map((p) => ({
    ...p,
    group: validGroup(p.group) ? p.group : "comida",
    visits: visits[p.id] || 0,
  }));
  return NextResponse.json({ places });
}

export async function POST(request) {
  const auth = await requireSession(request);
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
    createdBy: auth.person,
    createdAt: new Date().toISOString(),
  };
  for (const [field, clean] of Object.entries(FIELDS)) {
    const value = clean(body[field]);
    if (value) place[field] = value;
  }

  await Promise.all([kv.set(`place:${id}`, place), kv.lpush("places", id)]);
  return NextResponse.json({ place });
}

// Edicion parcial: solo cambia los campos que vienen en el body (asi el
// corazon de "favorito" puede actualizar solo ese campo).
export async function PATCH(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  if (!isId(body.placeId)) {
    return NextResponse.json({ error: "Falta el sitio a editar" }, { status: 400 });
  }

  const existing = await kv.get(`place:${body.placeId}`);
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

  await kv.set(`place:${body.placeId}`, updated);
  return NextResponse.json({ place: updated });
}

export async function DELETE(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const { placeId } = await readJson(request);
  if (!isId(placeId)) {
    return NextResponse.json({ error: "Falta el sitio a eliminar" }, { status: 400 });
  }
  await Promise.all([kv.lrem("places", 0, placeId), kv.del(`place:${placeId}`)]);
  return NextResponse.json({ ok: true });
}
