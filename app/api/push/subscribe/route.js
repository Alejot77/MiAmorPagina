import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE } from "@/config";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json();
  const { person, subscription } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  }

  await kv.hset(`push:${person}`, { [subscription.endpoint]: subscription });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const body = await request.json();
  const { person, endpoint } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  if (endpoint) {
    await kv.hdel(`push:${person}`, endpoint);
  }
  return NextResponse.json({ ok: true });
}
