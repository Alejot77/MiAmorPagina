import { NextResponse } from "next/server";
import { hydratePlan, isPlanActive, loadAllPlans, loadVotesFor } from "@/lib/planWindow";
import { requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";

// Planes de la sala que ya pasaron su martes de corte, con sus votos.
export async function GET(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const past = (await loadAllPlans(auth.gid)).filter((p) => !isPlanActive(p));
  const votes = await loadVotesFor(auth.gid, past);
  return NextResponse.json({ history: past.map((plan) => ({ plan: hydratePlan(plan, auth.members), votes: votes[plan.id] })) });
}
