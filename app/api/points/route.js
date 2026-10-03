import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE, DESSERT_THRESHOLD } from "@/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const points = Object.fromEntries(
    await Promise.all(PEOPLE.map(async (p) => [p, Number((await kv.get(`points:${p}`)) || 0)]))
  );
  const desserts = Object.fromEntries(
    await Promise.all(PEOPLE.map(async (p) => [p, Number((await kv.get(`desserts:${p}`)) || 0)]))
  );

  return NextResponse.json({ points, desserts, threshold: DESSERT_THRESHOLD });
}

// Reclamar el postre: resta el umbral de los puntos de quien lo alcanzo y
// suma 1 a su contador de postres ganados.
export async function POST(request) {
  const body = await request.json();
  const { person } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }

  const current = Number((await kv.get(`points:${person}`)) || 0);
  if (current < DESSERT_THRESHOLD) {
    return NextResponse.json(
      { error: "Todavía no llegas al puntaje del postre" },
      { status: 400 }
    );
  }

  await kv.set(`points:${person}`, current - DESSERT_THRESHOLD);
  await kv.incrby(`desserts:${person}`, 1);

  const points = Number((await kv.get(`points:${person}`)) || 0);
  const desserts = Number((await kv.get(`desserts:${person}`)) || 0);

  return NextResponse.json({ points, desserts });
}
