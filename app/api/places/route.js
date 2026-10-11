import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE, FOOD_TYPES, PLACE_GROUPS } from "@/config";
import { todayStrBogota } from "@/lib/planWindow";

export const dynamic = "force-dynamic";

function validFoodType(key) {
  return FOOD_TYPES.some((f) => f.key === key);
}

function validGroup(key) {
  return PLACE_GROUPS.some((g) => g.key === key);
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Visitas = cuantos planes ya pasados (su fecha ya llego) terminaron eligiendo
// ese sitio, con los dos votando por el. No se guarda: se calcula al leer.
async function countVisits() {
  const ids = await kv.lrange("plans", 0, -1);
  const today = todayStrBogota();
  const visits = {};
  const plans = (await Promise.all((ids || []).map((id) => kv.get(`plan:${id}`)))).filter(Boolean);

  for (const plan of plans) {
    if (plan.weekend > today) continue;
    for (const step of plan.steps) {
      const votes = (await kv.hgetall(`votes:${plan.id}:${step.id}`)) || {};
      const chosen = PEOPLE.map((p) => votes[p]);
      if (chosen.some((v) => !v) || new Set(chosen).size !== 1) continue;
      const option = step.options.find((o) => o.id === chosen[0]);
      // Los planes viejos guardaban el id del sitio como id de la opcion.
      const placeId = option?.placeId || (option?.id?.startsWith("place") ? option.id : null);
      if (placeId) visits[placeId] = (visits[placeId] || 0) + 1;
    }
  }
  return visits;
}

export async function GET() {
  const ids = await kv.lrange("places", 0, -1);
  if (!ids || ids.length === 0) {
    return NextResponse.json({ places: [] });
  }
  const [raw, visits] = await Promise.all([
    Promise.all(ids.map((id) => kv.get(`place:${id}`))),
    countVisits(),
  ]);
  const places = raw.filter(Boolean).map((p) => ({
    ...p,
    group: validGroup(p.group) ? p.group : "comida",
    visits: visits[p.id] || 0,
  }));
  return NextResponse.json({ places });
}

export async function POST(request) {
  const body = await request.json();
  const { name, category, group, link, area, note, favorite, person } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  const cleanName = cleanText(name);
  if (!cleanName) {
    return NextResponse.json({ error: "Falta el nombre del sitio" }, { status: 400 });
  }

  const id = `place${Date.now()}`;
  const place = {
    id,
    name: cleanName,
    group: validGroup(group) ? group : "comida",
    category: validFoodType(category) ? category : "otro",
    ...(cleanText(link) ? { link: cleanText(link) } : {}),
    ...(cleanText(area) ? { area: cleanText(area) } : {}),
    ...(cleanText(note) ? { note: cleanText(note) } : {}),
    favorite: Boolean(favorite),
    createdBy: person,
    createdAt: new Date().toISOString(),
  };

  await kv.set(`place:${id}`, place);
  await kv.lpush("places", id);

  return NextResponse.json({ place });
}

// Edicion parcial: solo cambia los campos que vienen en el body (asi el
// corazon de "favorito" puede actualizar solo ese campo).
export async function PATCH(request) {
  const body = await request.json();
  const { placeId, person } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  if (!placeId) {
    return NextResponse.json({ error: "Falta el sitio a editar" }, { status: 400 });
  }

  const existing = await kv.get(`place:${placeId}`);
  if (!existing) {
    return NextResponse.json({ error: "Ese sitio no existe" }, { status: 404 });
  }

  const updated = { ...existing };

  if ("name" in body) {
    const cleanName = cleanText(body.name);
    if (!cleanName) {
      return NextResponse.json({ error: "Falta el nombre del sitio" }, { status: 400 });
    }
    updated.name = cleanName;
  }
  if ("group" in body && validGroup(body.group)) updated.group = body.group;
  if ("category" in body && validFoodType(body.category)) updated.category = body.category;
  if ("favorite" in body) updated.favorite = Boolean(body.favorite);
  for (const field of ["link", "area", "note"]) {
    if (!(field in body)) continue;
    const value = cleanText(body[field]);
    if (value) updated[field] = value;
    else delete updated[field];
  }

  await kv.set(`place:${placeId}`, updated);
  return NextResponse.json({ place: updated });
}

export async function DELETE(request) {
  const body = await request.json();
  const { placeId, person } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  if (!placeId) {
    return NextResponse.json({ error: "Falta el sitio a eliminar" }, { status: 400 });
  }

  await kv.lrem("places", 0, String(placeId));
  await kv.del(`place:${placeId}`);

  return NextResponse.json({ ok: true });
}
