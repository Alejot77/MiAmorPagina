import { NextResponse } from "next/server";
import { isPlanActive, loadAllPlans, loadVotesFor } from "@/lib/planWindow";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Planes que ya pasaron su martes de corte, con sus votos.
export async function GET(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const past = (await loadAllPlans()).filter((p) => !isPlanActive(p));
  const votes = await loadVotesFor(past);
  return NextResponse.json({ history: past.map((plan) => ({ plan, votes: votes[plan.id] })) });
}
