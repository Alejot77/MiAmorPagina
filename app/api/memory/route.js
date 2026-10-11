import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE } from "@/config";

export const dynamic = "force-dynamic";

// Datos de "recuerdo" de un plan del historial: una nota/frase y si es
// favorito. Edicion parcial: solo cambia lo que viene en el body.
export async function PATCH(request) {
  const body = await request.json();
  const { planId, person } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }

  const plan = await kv.get(`plan:${planId}`);
  if (!plan) {
    return NextResponse.json({ error: "Ese plan no existe" }, { status: 404 });
  }

  const updated = { ...plan };
  if ("note" in body) {
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note) updated.memoryNote = note;
    else delete updated.memoryNote;
  }
  if ("favorite" in body) updated.favorite = Boolean(body.favorite);

  await kv.set(`plan:${planId}`, updated);
  return NextResponse.json({ plan: updated });
}
