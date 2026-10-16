import { NextResponse } from "next/server";
import { isValidEmail, normalizeEmail, tooSoon, trySendVerification, verifyPassword } from "@/lib/auth";
import { claimEmail, getUser, releaseEmail, saveUser, selfUser } from "@/lib/users";
import { overLimit, requireSession } from "@/lib/session";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// PATCH { password, email } -> cambiar el correo de la cuenta (pide la
// clave). El correo nuevo queda pendiente hasta que abran el enlace;
// mientras tanto el verificado anterior sigue sirviendo para recuperar la
// clave.
export async function PATCH(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  const user = await getUser(auth.uid);
  if (!user) return NextResponse.json({ error: "Esa cuenta ya no existe" }, { status: 404 });
  if (await overLimit(`login:${user.id}`, 8, 15 * 60)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera 15 minutos." }, { status: 429 });
  }
  if (!verifyPassword(body.password, user)) {
    return NextResponse.json({ error: "La clave no es correcta" }, { status: 401 });
  }
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return NextResponse.json({ error: "Escribe un correo válido" }, { status: 400 });

  if (email === user.email) {
    const { pendingEmail, ...rest } = user;
    if (pendingEmail) await releaseEmail(pendingEmail, user.id);
    await saveUser(rest);
    return NextResponse.json({ ok: true, ...selfUser(rest) });
  }
  if (!(await claimEmail(email, user.id))) {
    return NextResponse.json({ error: "Ese correo ya lo usa otra cuenta." }, { status: 409 });
  }
  if (user.pendingEmail && user.pendingEmail !== email) await releaseEmail(user.pendingEmail, user.id);
  const updated = { ...user, pendingEmail: email, pendingSince: Date.now() };
  await saveUser(updated);
  await tooSoon("verify", user.id);
  const sent = await trySendVerification(request, updated, email);
  return NextResponse.json({ ok: true, ...selfUser(updated), ...sent });
}

// POST -> reenviar el correo de verificacion del correo pendiente.
export async function POST(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const user = await getUser(auth.uid);
  if (!user?.pendingEmail) {
    return NextResponse.json({ error: "No hay ningún correo esperando verificación" }, { status: 400 });
  }
  if (await tooSoon("verify", user.id)) {
    return NextResponse.json({ error: "Acabamos de enviarlo. Espera un minuto antes de pedirlo otra vez." }, { status: 429 });
  }
  const sent = await trySendVerification(request, user, user.pendingEmail);
  if (!sent.emailSent) return NextResponse.json({ error: sent.emailError }, { status: 502 });
  return NextResponse.json({ ok: true, ...selfUser(user) });
}
