import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { gk } from "@/lib/groups";
import { getUser } from "@/lib/users";
import { notifyGroup } from "@/lib/push";
import { isPlanActive, loadActivePlans, planVoters } from "@/lib/planWindow";
import { isAdmin, requireMember } from "@/lib/session";
import { isId, readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// POST { planId, stepId } -> cierra una votacion aunque falte gente: gana lo
// mas votado entre quienes votaron. Solo quien creo el plan o un admin.
export async function POST(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const { gid, uid, group, members } = auth;
  const { planId, stepId } = await readJson(request);
  if (!isId(planId) || !isId(stepId)) return NextResponse.json({ error: "Votación inválida" }, { status: 400 });

  const plan = await kv.get(gk(gid, "plan", planId));
  if (!plan || !isPlanActive(plan)) return NextResponse.json({ error: "Este plan ya no está activo" }, { status: 400 });
  if (plan.createdBy !== uid && !isAdmin(group, uid)) {
    return NextResponse.json({ error: "Solo quien creó el plan o un admin puede cerrar la votación" }, { status: 403 });
  }
  const step = plan.steps.find((s) => s.id === stepId);
  if (!step) return NextResponse.json({ error: "Votación inválida" }, { status: 400 });
  // En pareja se decide cuando votan los dos (como siempre).
  if (planVoters(plan, members).length <= 2) {
    return NextResponse.json({ error: "En pareja la votación se decide cuando votan los dos" }, { status: 400 });
  }
  const votes = (await kv.hgetall(gk(gid, "votes", planId, stepId))) || {};
  if (Object.keys(votes).length === 0) {
    return NextResponse.json({ error: "Nadie ha votado todavía" }, { status: 400 });
  }

  const updated = { ...plan, steps: plan.steps.map((s) => (s.id === stepId ? { ...s, closed: true } : s)) };
  await kv.set(gk(gid, "plan", planId), updated);
  const name = (await getUser(uid))?.name || "Alguien";
  await notifyGroup(group, members, uid, { title: "🔒 Votación cerrada", body: `${name} cerró "${step.question}". ¡Mira qué ganó!` });
  return NextResponse.json(await loadActivePlans(gid, members));
}
