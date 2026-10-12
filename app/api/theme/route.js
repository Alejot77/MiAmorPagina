import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { THEMES } from "@/config";
import { requireSession } from "@/lib/session";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// PUT { theme } -> guarda el tema de quien tiene la sesion. (El tema actual
// llega con GET /api/session.)
export async function PUT(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const { theme } = await readJson(request);
  if (!THEMES.some((t) => t.id === theme)) return NextResponse.json({ error: "Ese tema no existe" }, { status: 400 });
  await kv.set(`theme:${auth.person}`, theme);
  return NextResponse.json({ theme });
}
