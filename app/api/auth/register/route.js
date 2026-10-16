import { NextResponse } from "next/server";
import { hashPassword, isValidEmail, normalizeEmail, passwordProblem, trySendVerification } from "@/lib/auth";
import { NAME_MAX, claimEmail, getUser, newId, pickColor, saveUser, userIdByEmail } from "@/lib/users";
import { kv } from "@/lib/kv";
import { ensureMigrated } from "@/lib/migrate";
import { overLimit, withNewSession } from "@/lib/session";
import { cleanText, readJson } from "@/lib/validate";
import { DEFAULT_THEME } from "@/config";

export const dynamic = "force-dynamic";

// Si alguien registro este correo sin confirmarlo hace mas de 24 horas, se
// libera (para que nadie pueda "apartar" el correo de otra persona).
const STALE_MS = 24 * 60 * 60 * 1000;
async function freeStaleEmail(email) {
  const owner = await userIdByEmail(email);
  if (!owner) return;
  const user = await getUser(String(owner));
  if (!user) return kv.del(`user-email:${email}`);
  if (user.email === email || user.pendingEmail !== email) return;
  if (Date.now() - (user.pendingSince || 0) < STALE_MS) return;
  const { pendingEmail, pendingSince, ...rest } = user;
  await Promise.all([saveUser(rest), kv.del(`user-email:${email}`)]);
}

// POST { name, email, password, passwordConfirm } -> crea la cuenta, manda
// el correo de verificacion y deja la sesion iniciada.
export async function POST(request) {
  await ensureMigrated();
  const body = await readJson(request);
  const name = cleanText(body.name, NAME_MAX);
  const email = normalizeEmail(body.email);
  if (!name) return NextResponse.json({ error: "Escribe tu nombre" }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "Escribe un correo válido" }, { status: 400 });
  const problem = passwordProblem(body.password, body.passwordConfirm);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  // Freno a la creacion masiva de cuentas desde un mismo lugar.
  const ip = (request.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (await overLimit(`register:${ip}`, 10, 60 * 60)) {
    return NextResponse.json({ error: "Demasiadas cuentas nuevas desde aquí. Intenta más tarde." }, { status: 429 });
  }

  const id = newId("u");
  await freeStaleEmail(email);
  if (!(await claimEmail(email, id))) {
    return NextResponse.json({ error: "Ya hay una cuenta con ese correo. Entra o usa «¿Olvidaste tu clave?»." }, { status: 409 });
  }
  const user = {
    id,
    name,
    color: pickColor(),
    pendingEmail: email,
    pendingSince: Date.now(),
    ...hashPassword(body.password),
    theme: DEFAULT_THEME,
    pinned: [],
    createdAt: new Date().toISOString(),
  };
  await saveUser(user);
  return withNewSession(id, { ok: true, ...(await trySendVerification(request, user, email)) });
}
