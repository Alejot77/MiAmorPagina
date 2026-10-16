import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { gk } from "@/lib/groups";
import { requireMember } from "@/lib/session";
import { cleanNote, isId, readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Datos de "recuerdo" de un plan del historial: una nota/frase y si es
// favorito. Edicion parcial: solo cambia lo que viene en el body.
export async function PATCH(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  if (!isId(body.planId)) return NextResponse.json({ error: "Falta el plan" }, { status: 400 });

  const plan = await kv.get(gk(auth.gid, "plan", body.planId));
  if (!plan) {
    return NextResponse.json({ error: "Ese plan no existe" }, { status: 404 });
  }

  const updated = { ...plan };
  if ("note" in body) {
    const note = cleanNote(body.note);
    if (note) updated.memoryNote = note;
    else delete updated.memoryNote;
  }
  if ("favorite" in body) updated.favorite = Boolean(body.favorite);

  await kv.set(gk(auth.gid, "plan", body.planId), updated);
  return NextResponse.json({ plan: updated });
}
