import crypto from "crypto";
import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { getGroup, gk, memberIds } from "@/lib/groups";
import { sendPushToUser } from "@/lib/push";
import { currentMonth, loadAllPlans, monthName, shiftMonth } from "@/lib/recap";

export const dynamic = "force-dynamic";

// Compara la clave del cron en tiempo constante.
function validCronSecret(header) {
  const secret = process.env.CRON_SECRET;
  if (!secret || typeof header !== "string") return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Lo llama el cron de Vercel el dia 1 de cada mes (vercel.json): en cada
// sala que tuvo planes el mes anterior, avisa que ya se puede ver su resumen.
export async function GET(request) {
  if (!validCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const month = shiftMonth(currentMonth(), -1);
  const groupIds = ((await kv.smembers("groups")) || []).map(String);
  const results = [];

  for (const gid of groupIds) {
    const count = (await loadAllPlans(gid)).filter((p) => p.weekend.startsWith(month)).length;
    if (count === 0) continue;
    // Un solo aviso por sala y mes aunque el cron se repita.
    const first = await kv.set(gk(gid, "recap-notified", month), 1, { nx: true, ex: 60 * 60 * 24 * 45 });
    if (first === null) continue;
    const [group, members] = await Promise.all([getGroup(gid), memberIds(gid)]);
    if (!group) continue;
    await Promise.all(
      members.map((uid) =>
        sendPushToUser(uid, {
          title: `📸 El resumen de ${monthName(month)} está listo · ${group.name}`,
          body: `${count} ${count === 1 ? "salida" : "salidas"}, lo que comieron, lo que hicieron y sus fotos.`,
          url: `/?g=${gid}&recap=${month}`,
          tag: `recap-${gid}-${month}`,
        })
      )
    );
    results.push({ group: gid, plans: count });
  }
  return NextResponse.json({ month, notified: results });
}
