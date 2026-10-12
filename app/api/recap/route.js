import { NextResponse } from "next/server";
import { loadVotesFor } from "@/lib/planWindow";
import { requireSession } from "@/lib/session";
import { loadPhotos, countPhotos } from "@/lib/photos";
import { currentMonth, loadAllPlans, monthName, shiftMonth } from "@/lib/recap";

export const dynamic = "force-dynamic";

// Resumen del mes. Un mes se "abre" el dia 1 del mes siguiente (hora de
// Bogota); antes solo se anuncia.
//   GET           -> meses disponibles y el que esta en curso.
//   GET ?month=   -> planes de ese mes con sus votos y fotos.
export async function GET(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const month = new URL(request.url).searchParams.get("month");
  const now = currentMonth();
  const plans = await loadAllPlans();

  if (!month) {
    const byMonth = {};
    for (const p of plans) (byMonth[p.weekend.slice(0, 7)] ||= []).push(p);
    const months = await Promise.all(
      Object.keys(byMonth)
        .filter((m) => m < now)
        .sort((a, b) => (a < b ? 1 : -1))
        .map(async (m) => ({
          month: m,
          plans: byMonth[m].length,
          photos: (await Promise.all(byMonth[m].map((p) => countPhotos(p.id)))).reduce((a, b) => a + b, 0),
        }))
    );
    const upcoming = byMonth[now] ? { month: now, plans: byMonth[now].length, opensOn: `${shiftMonth(now, 1)}-01` } : null;
    return NextResponse.json({ months, upcoming });
  }

  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Mes inválido" }, { status: 400 });
  if (month >= now) {
    return NextResponse.json(
      { error: `El resumen de ${monthName(month)} se abre el 1 de ${monthName(shiftMonth(month, 1))}.` },
      { status: 403 }
    );
  }
  const inMonth = plans.filter((p) => p.weekend.startsWith(month)).sort((a, b) => (a.weekend < b.weekend ? -1 : 1));
  const [votes, photos] = await Promise.all([loadVotesFor(inMonth), Promise.all(inMonth.map((p) => loadPhotos(p.id)))]);
  const entries = inMonth.map((plan, i) => ({ plan, votes: votes[plan.id], photos: photos[i] }));
  return NextResponse.json({ month, entries });
}
