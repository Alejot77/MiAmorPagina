import { NextResponse } from "next/server";
import { passwordProblem, hashPassword, verifyPassword } from "@/lib/auth";
import { getUser, saveUser, userIdByEmail } from "@/lib/users";
import { ensureMigrated } from "@/lib/migrate";
import { destroyAllSessions, overLimit, requireSession, resetLimit, withNewSession } from "@/lib/session";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Claves equivocadas permitidas por cuenta antes de esperar.
const LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW = 15 * 60;
const WRONG = "Correo o clave incorrectos";

// POST { email, password } -> entrar. Deja la sesion iniciada (cookie).
export async function POST(request) {
  await ensureMigrated();
  const { email, password } = await readJson(request);
  const uid = await userIdByEmail(email);
  const user = uid && (await getUser(String(uid)));
  if (!user) return NextResponse.json({ error: WRONG }, { status: 401 });
  if (await overLimit(`login:${user.id}`, LOGIN_ATTEMPTS, LOGIN_WINDOW)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera 15 minutos o usa «¿Olvidaste tu clave?»." },
      { status: 429 }
    );
  }
  if (!verifyPassword(password, user)) return NextResponse.json({ error: WRONG }, { status: 401 });
  await resetLimit(`login:${user.id}`);
  return withNewSession(user.id, { ok: true });
}

// PUT { currentPassword, newPassword, newPasswordConfirm } -> cambia la clave
// de quien tiene la sesion y cierra las sesiones de los otros celulares.
export async function PUT(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const { currentPassword, newPassword, newPasswordConfirm } = await readJson(request);
  const problem = passwordProblem(newPassword, newPasswordConfirm);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const user = await getUser(auth.uid);
  if (!user) return NextResponse.json({ error: "Esa cuenta ya no existe" }, { status: 404 });
  if (await overLimit(`login:${user.id}`, LOGIN_ATTEMPTS, LOGIN_WINDOW)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera 15 minutos." }, { status: 429 });
  }
  if (!verifyPassword(currentPassword, user)) {
    return NextResponse.json({ error: "La clave actual no es correcta" }, { status: 401 });
  }
  await saveUser({ ...user, ...hashPassword(newPassword) });
  await destroyAllSessions(user.id);
  return withNewSession(user.id, { ok: true });
}
