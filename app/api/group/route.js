import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE, DEFAULT_GROUP_NAME, GROUP_NAME_MAX } from "@/config";

export const dynamic = "force-dynamic";

// GET -> nombre del grupo (lo usa tambien el login, antes de entrar).
export async function GET() {
  const name = await kv.get("settings:group_name");
  return NextResponse.json({ name: typeof name === "string" && name.trim() ? name : DEFAULT_GROUP_NAME });
}

// PUT { person, name } -> cambia el nombre (vacio vuelve al de siempre).
export async function PUT(request) {
  const { person, name } = (await request.json()) || {};
  if (!PEOPLE.includes(person)) return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  const clean = String(name || "").replace(/\s+/g, " ").trim();
  if (clean.length > GROUP_NAME_MAX) {
    return NextResponse.json({ error: `El nombre puede tener hasta ${GROUP_NAME_MAX} letras` }, { status: 400 });
  }
  if (clean) await kv.set("settings:group_name", clean);
  else await kv.del("settings:group_name");
  return NextResponse.json({ name: clean || DEFAULT_GROUP_NAME });
}
