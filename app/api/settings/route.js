import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { getSettings } from "@/lib/settings";
import { requireSession } from "@/lib/session";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  return NextResponse.json(await getSettings());
}

// PUT { pointsPerCategory, dessertThreshold } -> reglas de puntos (de los dos).
export async function PUT(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  const ppc = Number(body.pointsPerCategory);
  const threshold = Number(body.dessertThreshold);
  if (!Number.isInteger(ppc) || ppc <= 0 || ppc > 1000) {
    return NextResponse.json({ error: "Los puntos por categoría deben ser un número entre 1 y 1000" }, { status: 400 });
  }
  if (!Number.isInteger(threshold) || threshold <= 0 || threshold > 100000) {
    return NextResponse.json({ error: "El puntaje del postre debe ser un número entre 1 y 100000" }, { status: 400 });
  }
  await Promise.all([kv.set("settings:points_per_category", ppc), kv.set("settings:dessert_threshold", threshold)]);
  return NextResponse.json({ pointsPerCategory: ppc, dessertThreshold: threshold });
}
