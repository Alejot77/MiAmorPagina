import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { DEFAULT_GROUP_NAME, GROUP_NAME_MAX } from "@/config";
import { requireSession } from "@/lib/session";
import { cleanText, readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// GET -> nombre del grupo. Es publico: lo muestra la pantalla de entrada.
export async function GET() {
  const name = await kv.get("settings:group_name");
  return NextResponse.json({ name: typeof name === "string" && name.trim() ? name : DEFAULT_GROUP_NAME });
}

// PUT { name } -> cambia el nombre (vacio vuelve al de siempre).
export async function PUT(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const { name } = await readJson(request);
  if (typeof name === "string" && name.trim().length > GROUP_NAME_MAX) {
    return NextResponse.json({ error: `El nombre puede tener hasta ${GROUP_NAME_MAX} letras` }, { status: 400 });
  }
  const clean = cleanText(name, GROUP_NAME_MAX);
  if (clean) await kv.set("settings:group_name", clean);
  else await kv.del("settings:group_name");
  return NextResponse.json({ name: clean || DEFAULT_GROUP_NAME });
}
