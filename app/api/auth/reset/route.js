import { NextResponse } from "next/server";
import { consumeToken, hashPassword, passwordProblem, peekToken } from "@/lib/auth";
import { getUser, saveUser } from "@/lib/users";
import { destroyAllSessions, withNewSession } from "@/lib/session";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// GET ?token= -> dice si el enlace sigue sirviendo (sin gastarlo).
export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  const data = await peekToken(token, "reset");
  const user = data && (await getUser(data.uid));
  return NextResponse.json(user ? { valid: true, name: user.name } : { valid: false });
}

// POST { token, newPassword, newPasswordConfirm } -> pone la clave nueva,
// cierra las sesiones viejas y deja esta iniciada.
export async function POST(request) {
  const { token, newPassword, newPasswordConfirm } = await readJson(request);
  const problem = passwordProblem(newPassword, newPasswordConfirm);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const data = await consumeToken(token, "reset");
  const user = data && (await getUser(data.uid));
  if (!user) {
    return NextResponse.json({ error: "El enlace venció o ya se usó. Pide uno nuevo." }, { status: 400 });
  }
  await saveUser({ ...user, ...hashPassword(newPassword) });
  await destroyAllSessions(user.id);
  return withNewSession(user.id, { ok: true, name: user.name });
}
