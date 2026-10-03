import crypto from "crypto";
import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE } from "@/config";

export const dynamic = "force-dynamic";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const hash = crypto.scryptSync(password, record.salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(record.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// GET /api/auth?person=X -> indica si esa persona ya tiene una clave creada.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const person = searchParams.get("person");
  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  const existing = await kv.get(`auth:${person}`);
  return NextResponse.json({ hasPassword: Boolean(existing) });
}

// POST -> iniciar sesion con una clave ya creada.
export async function POST(request) {
  const body = await request.json();
  const { person, password } = body || {};
  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  const existing = await kv.get(`auth:${person}`);
  if (!existing) {
    return NextResponse.json({ error: "Todavía no has creado tu clave" }, { status: 400 });
  }
  if (!verifyPassword(password || "", existing)) {
    return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}

// PUT -> crear la clave por primera vez, o cambiarla (pidiendo la actual).
export async function PUT(request) {
  const body = await request.json();
  const { person, currentPassword, newPassword, newPasswordConfirm } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  if (!newPassword || newPassword.length < 4) {
    return NextResponse.json(
      { error: "La clave debe tener al menos 4 caracteres" },
      { status: 400 }
    );
  }
  if (newPassword !== newPasswordConfirm) {
    return NextResponse.json({ error: "Las claves no coinciden" }, { status: 400 });
  }

  const existing = await kv.get(`auth:${person}`);
  if (existing) {
    if (!verifyPassword(currentPassword || "", existing)) {
      return NextResponse.json({ error: "La clave actual no es correcta" }, { status: 401 });
    }
  }

  await kv.set(`auth:${person}`, hashPassword(newPassword));
  return NextResponse.json({ ok: true });
}
