import { NextResponse } from "next/server";
import { MIN_PASSWORD, getAuth, saveAuth, hashPassword, peekToken, consumeToken } from "@/lib/auth";
import { destroyAllSessions, withNewSession } from "@/lib/session";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// GET ?token= -> dice si el enlace sigue sirviendo (sin gastarlo).
export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  const data = await peekToken(token, "reset");
  return NextResponse.json(data ? { valid: true, person: data.person } : { valid: false });
}

// POST { token, newPassword, newPasswordConfirm } -> pone la clave nueva,
// cierra las sesiones viejas y deja esta iniciada.
export async function POST(request) {
  const { token, newPassword, newPasswordConfirm } = await readJson(request);
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `La clave debe tener al menos ${MIN_PASSWORD} caracteres` }, { status: 400 });
  }
  if (newPassword.length > 200) return NextResponse.json({ error: "La clave es demasiado larga" }, { status: 400 });
  if (newPassword !== newPasswordConfirm) {
    return NextResponse.json({ error: "Las claves no coinciden" }, { status: 400 });
  }
  const data = await consumeToken(token, "reset");
  const record = data && (await getAuth(data.person));
  if (!record) {
    return NextResponse.json({ error: "El enlace venció o ya se usó. Pide uno nuevo." }, { status: 400 });
  }
  await saveAuth(data.person, { ...record, ...hashPassword(newPassword) });
  await destroyAllSessions(data.person);
  return withNewSession(data.person, { ok: true, person: data.person });
}
