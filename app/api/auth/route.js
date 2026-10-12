import { NextResponse } from "next/server";
import { PEOPLE } from "@/config";
import {
  getAuth,
  saveAuth,
  hashPassword,
  verifyPassword,
  normalizeEmail,
  isValidEmail,
  publicStatus,
  trySendVerification,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/auth?person=X -> si tiene clave y el estado de su correo.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const person = searchParams.get("person");
  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  return NextResponse.json(publicStatus(await getAuth(person)));
}

// POST -> iniciar sesion con una clave ya creada. `needsEmail` avisa que
// la cuenta es de antes del correo y hay que vincular uno.
export async function POST(request) {
  const body = await request.json();
  const { person, password } = body || {};
  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  const existing = await getAuth(person);
  if (!existing) {
    return NextResponse.json({ error: "Todavía no has creado tu cuenta" }, { status: 400 });
  }
  if (!verifyPassword(password || "", existing)) {
    return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, needsEmail: !existing.email && !existing.pendingEmail });
}

// PUT -> crear la cuenta (correo + clave) la primera vez, o cambiar la
// clave (pidiendo la actual).
export async function PUT(request) {
  const body = await request.json();
  const { person, currentPassword, newPassword, newPasswordConfirm } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  if (!newPassword || newPassword.length < 4) {
    return NextResponse.json({ error: "La clave debe tener al menos 4 caracteres" }, { status: 400 });
  }
  if (newPassword !== newPasswordConfirm) {
    return NextResponse.json({ error: "Las claves no coinciden" }, { status: 400 });
  }

  const existing = await getAuth(person);
  if (existing) {
    if (!verifyPassword(currentPassword || "", existing)) {
      return NextResponse.json({ error: "La clave actual no es correcta" }, { status: 401 });
    }
    await saveAuth(person, { ...existing, ...hashPassword(newPassword) });
    return NextResponse.json({ ok: true });
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Escribe un correo válido" }, { status: 400 });
  }
  await saveAuth(person, { ...hashPassword(newPassword), pendingEmail: email });
  return NextResponse.json({ ok: true, ...(await trySendVerification(request, person, email)) });
}
