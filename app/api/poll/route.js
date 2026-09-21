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
