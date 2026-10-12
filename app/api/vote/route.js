import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { sendPushToPerson, otherPerson } from "@/lib/push";
import { isPlanActive, loadActivePlans } from "@/lib/planWindow";
import { requireSession } from "@/lib/session";
import { isId, readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// POST { planId, stepId, optionId } -> voto de quien tiene la sesion.
export async function POST(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const person = auth.person;
  const { planId, stepId, optionId } = await readJson(request);
  if (!isId(planId) || !isId(stepId)) {
    return NextResponse.json({ error: "Opción inválida" }, { status: 400 });
  }

  const plan = await kv.get(`plan:${planId}`);
  if (!plan || !isPlanActive(plan)) {
    return NextResponse.json({ error: "Este plan ya no está activo" }, { status: 400 });
  }

  const step = plan.steps.find((s) => s.id === stepId);
  if (!step || !step.options.some((o) => o.id === optionId)) {
    return NextResponse.json({ error: "Opción inválida" }, { status: 400 });
  }

  // hset sobrescribe el valor de esta persona: siempre queda un solo voto por persona y categoria.
  await kv.hset(`votes:${planId}:${stepId}`, { [person]: optionId });

  const target = otherPerson(person);
  if (target) {
    await sendPushToPerson(target, {
      title: "✅ Nuevo voto",
      body: `${person} votó en "${step.question}"`,
      url: "/",
    });
  }

  const { plans, votes } = await loadActivePlans();
  return NextResponse.json({ plans, votes });
}
