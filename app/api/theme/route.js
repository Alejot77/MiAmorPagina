import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE, THEMES, defaultThemeFor } from "@/config";

export const dynamic = "force-dynamic";

// GET ?person= -> tema elegido por esa persona (o el suyo por defecto).
export async function GET(request) {
  const person = new URL(request.url).searchParams.get("person");
  if (!PEOPLE.includes(person)) return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  const theme = await kv.get(`theme:${person}`);
  return NextResponse.json({ theme: THEMES.some((t) => t.id === theme) ? theme : defaultThemeFor(person) });
}

// PUT { person, theme } -> guarda el tema de esa persona.
export async function PUT(request) {
  const { person, theme } = (await request.json()) || {};
  if (!PEOPLE.includes(person)) return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  if (!THEMES.some((t) => t.id === theme)) return NextResponse.json({ error: "Ese tema no existe" }, { status: 400 });
  await kv.set(`theme:${person}`, theme);
  return NextResponse.json({ theme });
}
