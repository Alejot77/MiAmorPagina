import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE } from "@/config";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json();
  const { pollId, person, optionId } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }

  const ids = await kv.lrange("polls", 0, 0);
  if (!ids || ids.length === 0 || String(ids[0]) !== String(pollId)) {
    return NextResponse.json(
      { error: "Esta encuesta ya no está activa" },
      { status: 400 }
    );
  }

  const poll = await kv.get(`poll:${pollId}`);
  if (!poll || !poll.options.some((o) => o.id === optionId)) {
    return NextResponse.json({ error: "Opción inválida" }, { status: 400 });
  }

  // hset sobrescribe el valor de esta persona: siempre queda un solo voto por persona.
  await kv.hset(`votes:${pollId}`, { [person]: optionId });
  const votes = await kv.hgetall(`votes:${pollId}`);

  return NextResponse.json({ votes });
}
