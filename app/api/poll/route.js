import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE } from "@/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const ids = await kv.lrange("polls", 0, 0);
  if (!ids || ids.length === 0) {
    return NextResponse.json({ poll: null, votes: {}, people: PEOPLE });
  }

  const id = ids[0];
  const poll = await kv.get(`poll:${id}`);
  const votes = (await kv.hgetall(`votes:${id}`)) || {};

  return NextResponse.json({ poll, votes, people: PEOPLE });
}

export async function POST(request) {
  const body = await request.json();
  const { weekend, options, person } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }

  const cleanOptions = Array.isArray(options)
    ? options.map((o) => (typeof o === "string" ? o.trim() : "")).filter(Boolean)
    : [];

  if (!weekend || cleanOptions.length < 2) {
    return NextResponse.json(
      { error: "Faltan datos: fecha y al menos 2 opciones" },
      { status: 400 }
    );
  }

  const id = Date.now().toString();
  const poll = {
    id,
    weekend,
    options: cleanOptions.map((name, i) => ({ id: `opt${i}`, name })),
    createdBy: person,
    createdAt: new Date().toISOString(),
  };

  await kv.set(`poll:${id}`, poll);
  await kv.lpush("polls", id);

  return NextResponse.json({ poll, votes: {} });
}

export async function PATCH(request) {
  const body = await request.json();
  const { pollId, weekend, options, person } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  if (!pollId) {
    return NextResponse.json({ error: "Falta la encuesta a editar" }, { status: 400 });
  }

  const existing = await kv.get(`poll:${pollId}`);
  if (!existing) {
    return NextResponse.json({ error: "Esa encuesta no existe" }, { status: 404 });
  }

  const cleanOptions = Array.isArray(options)
    ? options.map((o) => (typeof o === "string" ? o.trim() : "")).filter(Boolean)
    : [];

  if (!weekend || cleanOptions.length < 2) {
    return NextResponse.json(
      { error: "Faltan datos: fecha y al menos 2 opciones" },
      { status: 400 }
    );
  }

  const updatedPoll = {
    ...existing,
    weekend,
    options: cleanOptions.map((name, i) => ({ id: `opt${i}`, name })),
    updatedBy: person,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`poll:${pollId}`, updatedPoll);

  // Si se quitaron opciones, se limpian los votos que ya no corresponden a ninguna.
  const votes = (await kv.hgetall(`votes:${pollId}`)) || {};
  const validIds = new Set(updatedPoll.options.map((o) => o.id));
  const orphanVoters = Object.entries(votes)
    .filter(([, optionId]) => !validIds.has(optionId))
    .map(([voter]) => voter);
  if (orphanVoters.length > 0) {
    await kv.hdel(`votes:${pollId}`, ...orphanVoters);
  }

  const finalVotes = await kv.hgetall(`votes:${pollId}`);
  return NextResponse.json({ poll: updatedPoll, votes: finalVotes || {} });
}

export async function DELETE(request) {
  const body = await request.json();
  const { pollId, person } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  if (!pollId) {
    return NextResponse.json({ error: "Falta la encuesta a eliminar" }, { status: 400 });
  }

  await kv.lrem("polls", 0, String(pollId));
  await kv.del(`poll:${pollId}`);
  await kv.del(`votes:${pollId}`);

  return NextResponse.json({ ok: true });
}
