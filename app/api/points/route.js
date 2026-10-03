import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE } from "@/config";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const { dessertThreshold } = await getSettings();
  const points = Object.fromEntries(
    await Promise.all(PEOPLE.map(async (p) => [p, Number((await kv.get(`points:${p}`)) || 0)]))
  );
  const desserts = Object.fromEntries(
    await Promise.all(PEOPLE.map(async (p) => [p, Number((await kv.get(`desserts:${p}`)) || 0)]))
  );

  return NextResponse.json({ points, desserts, threshold: dessertThreshold });
}

// Reclamar el postre: resta el umbral de los puntos de quien lo alcanzo y
// suma 1 a su contador de postres ganados.
export async function POST(request) {
  const body = await request.json();
  const { person } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }

  const { dessertThreshold } = await getSettings();
  const current = Number((await kv.get(`points:${person}`)) || 0);
  if (current < dessertThreshold) {
    return NextResponse.json(
      { error: "Todavía no llegas al puntaje del postre" },
      { status: 400 }
    );
  }

  await kv.set(`points:${person}`, current - dessertThreshold);
  await kv.incrby(`desserts:${person}`, 1);

  const points = Number((await kv.get(`points:${person}`)) || 0);
  const desserts = Number((await kv.get(`desserts:${person}`)) || 0);

  return NextResponse.json({ points, desserts });
}

// Reiniciar puntos: {person} reinicia solo esa persona, sin person reinicia
// a los dos. No toca el contador de postres ya ganados (eso es historico).
export async function DELETE(request) {
  const body = await request.json().catch(() => ({}));
  const { person } = body || {};

  if (person && !PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }

  const targets = person ? [person] : PEOPLE;
  await Promise.all(targets.map((p) => kv.set(`points:${p}`, 0)));

  const points = Object.fromEntries(
    await Promise.all(PEOPLE.map(async (p) => [p, Number((await kv.get(`points:${p}`)) || 0)]))
  );

  return NextResponse.json({ points });
}
