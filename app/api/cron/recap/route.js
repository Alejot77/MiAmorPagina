import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE } from "@/config";
import { sendPushToPerson } from "@/lib/push";
import { currentMonth, loadAllPlans, monthName, shiftMonth } from "@/lib/recap";

export const dynamic = "force-dynamic";

// Lo llama el cron de Vercel el dia 1 de cada mes (vercel.json): avisa a
// los dos que el resumen del mes anterior ya se puede ver.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const month = shiftMonth(currentMonth(), -1);
  const count = (await loadAllPlans()).filter((p) => p.weekend.startsWith(month)).length;
  if (count === 0) return NextResponse.json({ month, skipped: "sin planes" });

  // Un solo aviso por mes aunque el cron se repita.
  const first = await kv.set(`recap-notified:${month}`, 1, { nx: true, ex: 60 * 60 * 24 * 45 });
  if (first === null) return NextResponse.json({ month, skipped: "ya avisado" });

  await Promise.all(
    PEOPLE.map((person) =>
      sendPushToPerson(person, {
        title: `📸 Su resumen de ${monthName(month)} está listo`,
        body: `${count} ${count === 1 ? "salida" : "salidas"}, lo que comieron, lo que hicieron y sus fotos. Ábranlo juntos 💜`,
        url: `/?recap=${month}`,
        tag: `recap-${month}`,
      })
    )
  );
  return NextResponse.json({ month, notified: true, plans: count });
}
