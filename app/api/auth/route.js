import { NextResponse } from "next/server";
import { PEOPLE } from "@/config";
import {
  MIN_PASSWORD,
  getAuth,
  saveAuth,
  hashPassword,
  verifyPassword,
  normalizeEmail,
  isValidEmail,
  publicStatus,
  trySendVerification,
} from "@/lib/auth";
import { destroyAllSessions, overLimit, requireSession, resetLimit, withNewSession } from "@/lib/session";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Claves equivocadas permitidas por persona antes de esperar.
const LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW = 15 * 60;

function checkNewPassword(newPassword, newPasswordConfirm) {
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD) {
    return `La clave debe tener al menos ${MIN_PASSWORD} caracteres`;
  }
  if (newPassword.length > 200) return "La clave es demasiado larga";
  if (newPassword !== newPasswordConfirm) return "Las claves no coinciden";
  return null;
}

// GET /api/auth?person=X -> si tiene clave y el estado de su correo
// (enmascarado). Lo usa la pantalla de entrada.
export async function GET(request) {
  const person = new URL(request.url).searchParams.get("person");
  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  return NextResponse.json(publicStatus(await getAuth(person)));
}

// POST -> entrar con la clave. Deja la sesion iniciada (cookie).
// `needsEmail` avisa que la cuenta es de antes del correo.
export async function POST(request) {
  const { person, password } = await readJson(request);
  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  const existing = await getAuth(person);
  if (!existing) {
    return NextResponse.json({ error: "Todavía no has creado tu cuenta" }, { status: 400 });
  }
  if (await overLimit(`login:${person}`, LOGIN_ATTEMPTS, LOGIN_WINDOW)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera 15 minutos o usa «¿Olvidaste tu clave?»." },
      { status: 429 }
    );
  }
  if (!verifyPassword(typeof password === "string" ? password : "", existing)) {
    return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
  }
  await resetLimit(`login:${person}`);
  return withNewSession(person, { ok: true, person, needsEmail: !existing.email && !existing.pendingEmail });
}

// PUT -> crear la cuenta (correo + clave) la primera vez, o cambiar la clave
// (con sesion y pidiendo la actual). Al cambiarla se cierran las sesiones de
// los otros celulares.
export async function PUT(request) {
  const body = await readJson(request);
  const { currentPassword, newPassword, newPasswordConfirm } = body;
  const person = body.person;

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  const problem = checkNewPassword(newPassword, newPasswordConfirm);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const existing = await getAuth(person);
  if (existing) {
    const auth = await requireSession(request);
    if (auth.error) return auth.error;
    if (auth.person !== person) {
      return NextResponse.json({ error: "Solo puedes cambiar tu propia clave" }, { status: 403 });
    }
    if (!verifyPassword(typeof currentPassword === "string" ? currentPassword : "", existing)) {
      return NextResponse.json({ error: "La clave actual no es correcta" }, { status: 401 });
    }
    await saveAuth(person, { ...existing, ...hashPassword(newPassword) });
    await destroyAllSessions(person);
    return withNewSession(person, { ok: true });
  }

  // Cuenta nueva (solo si esa persona todavia no tiene clave).
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Escribe un correo válido" }, { status: 400 });
  }
  await saveAuth(person, { ...hashPassword(newPassword), pendingEmail: email });
  return withNewSession(person, { ok: true, person, ...(await trySendVerification(request, person, email)) });
}
