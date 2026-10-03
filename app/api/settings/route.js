import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE } from "@/config";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request) {
  const body = await request.json();
  const { person, pointsPerCategory, dessertThreshold } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  const ppc = Number(pointsPerCategory);
  const threshold = Number(dessertThreshold);
  if (!Number.isFinite(ppc) || ppc <= 0) {
    return NextResponse.json(
      { error: "Los puntos por categoría deben ser un número mayor a 0" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return NextResponse.json(
      { error: "El puntaje del postre debe ser un número mayor a 0" },
      { status: 400 }
    );
  }

  await kv.set("settings:points_per_category", ppc);
  await kv.set("settings:dessert_threshold", threshold);

  return NextResponse.json({ pointsPerCategory: ppc, dessertThreshold: threshold });
}
