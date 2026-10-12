import { NextResponse } from "next/server";
import { PEOPLE } from "@/config";
import {
  getAuth,
  saveAuth,
  verifyPassword,
  normalizeEmail,
  isValidEmail,
  publicStatus,
  tooSoon,
  trySendVerification,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH -> vincular o cambiar el correo (pide la clave actual). El correo
// nuevo queda pendiente hasta que abran el enlace; mientras tanto el
// verificado anterior sigue sirviendo para recuperar la clave.
export async function PATCH(request) {
  const body = await request.json();
  const { person, password } = body || {};
  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  const record = await getAuth(person);
  if (!record) {
    return NextResponse.json({ error: "Todavía no has creado tu cuenta" }, { status: 400 });
  }
  if (!verifyPassword(password || "", record)) {
    return NextResponse.json({ error: "La clave no es correcta" }, { status: 401 });
  }
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Escribe un correo válido" }, { status: 400 });
  }

  if (email === record.email) {
    const { pendingEmail, ...rest } = record;
    await saveAuth(person, rest);
    return NextResponse.json({ ok: true, ...publicStatus(rest) });
  }

  const updated = { ...record, pendingEmail: email };
  await saveAuth(person, updated);
  await tooSoon("verify", person);
  const sent = await trySendVerification(request, person, email);
  return NextResponse.json({ ok: true, ...publicStatus(updated), ...sent });
}

// POST -> reenviar el correo de verificacion del correo pendiente.
export async function POST(request) {
  const body = await request.json();
  const { person } = body || {};
  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  const record = await getAuth(person);
  if (!record?.pendingEmail) {
    return NextResponse.json({ error: "No hay ningún correo esperando verificación" }, { status: 400 });
  }
  if (await tooSoon("verify", person)) {
    return NextResponse.json({ error: "Acabamos de enviarlo. Espera un minuto antes de pedirlo otra vez." }, { status: 429 });
  }
  const sent = await trySendVerification(request, person, record.pendingEmail);
  if (!sent.emailSent) return NextResponse.json({ error: sent.emailError }, { status: 502 });
  return NextResponse.json({ ok: true, ...publicStatus(record) });
}
