import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { gk } from "@/lib/groups";
import { getUser } from "@/lib/users";
import { notifyGroup } from "@/lib/push";
import { isPlanActive, loadActivePlans, planVoters } from "@/lib/planWindow";
import { requireMember } from "@/lib/session";
import { isId, readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// POST { planId, stepId, optionId } -> voto de quien tiene la sesion.
export async function POST(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const { gid, uid, group, members } = auth;
  const { planId, stepId, optionId } = await readJson(request);
  if (!isId(planId) || !isId(stepId)) {
    return NextResponse.json({ error: "Opción inválida" }, { status: 400 });
  }

  const plan = await kv.get(gk(gid, "plan", planId));
  if (!plan || !isPlanActive(plan)) {
    return NextResponse.json({ error: "Este plan ya no está activo" }, { status: 400 });
  }
  if (!planVoters(plan, members).includes(uid)) {
    return NextResponse.json({ error: "Este plan se creó antes de que llegaras: podrás votar en los próximos" }, { status: 403 });
  }
  const step = plan.steps.find((s) => s.id === stepId);
  if (!step || !step.options.some((o) => o.id === optionId)) {
    return NextResponse.json({ error: "Opción inválida" }, { status: 400 });
  }
  if (step.closed) return NextResponse.json({ error: "Esta votación ya se cerró" }, { status: 400 });

  // hset sobrescribe el valor de esta cuenta: siempre queda un solo voto por persona y categoria.
  await kv.hset(gk(gid, "votes", planId, stepId), { [uid]: optionId });

  const name = (await getUser(uid))?.name || "Alguien";
  await notifyGroup(group, members, uid, { title: "✅ Nuevo voto", body: `${name} votó en "${step.question}"` });

  return NextResponse.json(await loadActivePlans(gid, members));
}
