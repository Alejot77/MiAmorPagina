import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE } from "@/config";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json();
  const { planId, stepId, person, optionId } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }

  const ids = await kv.lrange("plans", 0, 0);
  if (!ids || ids.length === 0 || String(ids[0]) !== String(planId)) {
    return NextResponse.json({ error: "Este plan ya no está activo" }, { status: 400 });
  }

  const plan = await kv.get(`plan:${planId}`);
  const step = plan?.steps.find((s) => s.id === stepId);
  if (!step || !step.options.some((o) => o.id === optionId)) {
    return NextResponse.json({ error: "Opción inválida" }, { status: 400 });
  }

  // hset sobrescribe el valor de esta persona: siempre queda un solo voto por persona y categoria.
  await kv.hset(`votes:${planId}:${stepId}`, { [person]: optionId });
  const votes = await kv.hgetall(`votes:${planId}:${stepId}`);

  return NextResponse.json({ stepId, votes });
}
