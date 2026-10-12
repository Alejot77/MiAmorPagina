import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE } from "@/config";
import { getSettings } from "@/lib/settings";
import { requireSession } from "@/lib/session";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

async function loadPoints() {
  const values = await Promise.all(PEOPLE.flatMap((p) => [kv.get(`points:${p}`), kv.get(`desserts:${p}`)]));
  return {
    points: Object.fromEntries(PEOPLE.map((p, i) => [p, Number(values[i * 2] || 0)])),
    desserts: Object.fromEntries(PEOPLE.map((p, i) => [p, Number(values[i * 2 + 1] || 0)])),
  };
}

export async function GET(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const [{ dessertThreshold }, data] = await Promise.all([getSettings(), loadPoints()]);
  return NextResponse.json({ ...data, threshold: dessertThreshold });
}

// Reclamar el postre de { person }: resta el umbral de sus puntos y suma 1 a
// sus postres ganados. Lo puede marcar cualquiera de los dos.
export async function POST(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const { person } = await readJson(request);
  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }

  const { dessertThreshold } = await getSettings();
  const current = Number((await kv.get(`points:${person}`)) || 0);
  if (current < dessertThreshold) {
    return NextResponse.json({ error: "Todavía no llega al puntaje del postre" }, { status: 400 });
  }
  // decrby es atomico: dos toques seguidos no restan de mas.
  const [points, desserts] = await Promise.all([
    kv.decrby(`points:${person}`, dessertThreshold),
    kv.incrby(`desserts:${person}`, 1),
  ]);
  return NextResponse.json({ points, desserts });
}

// Reiniciar puntos: { person } reinicia solo a esa persona; sin person, a los
// dos. No toca los postres ya ganados (eso es historico).
export async function DELETE(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const { person } = await readJson(request);
  if (person && !PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  await Promise.all((person ? [person] : PEOPLE).map((p) => kv.set(`points:${p}`, 0)));
  return NextResponse.json({ points: (await loadPoints()).points });
}
