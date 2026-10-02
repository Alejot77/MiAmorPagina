import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE, FOOD_TYPES } from "@/config";

export const dynamic = "force-dynamic";

function validCategory(key) {
  return FOOD_TYPES.some((f) => f.key === key);
}

export async function GET() {
  const ids = await kv.lrange("places", 0, -1);
  if (!ids || ids.length === 0) {
    return NextResponse.json({ places: [] });
  }
  const places = (await Promise.all(ids.map((id) => kv.get(`place:${id}`)))).filter(Boolean);
  return NextResponse.json({ places });
}

export async function POST(request) {
  const body = await request.json();
  const { name, category, link, person } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName) {
    return NextResponse.json({ error: "Falta el nombre del sitio" }, { status: 400 });
  }

  const id = `place${Date.now()}`;
  const place = {
    id,
    name: cleanName,
    category: validCategory(category) ? category : "otro",
    ...(typeof link === "string" && link.trim() ? { link: link.trim() } : {}),
    createdBy: person,
    createdAt: new Date().toISOString(),
  };

  await kv.set(`place:${id}`, place);
  await kv.lpush("places", id);

  return NextResponse.json({ place });
}

export async function PATCH(request) {
  const body = await request.json();
  const { placeId, name, category, link, person } = body || {};

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

  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName) {
    return NextResponse.json({ error: "Falta el nombre del sitio" }, { status: 400 });
  }
  const cleanLink = typeof link === "string" ? link.trim() : "";

  const updated = {
    ...existing,
    name: cleanName,
    category: validCategory(category) ? category : existing.category,
  };
  delete updated.link;
  if (cleanLink) updated.link = cleanLink;

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
