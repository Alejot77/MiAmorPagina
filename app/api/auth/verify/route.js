import { NextResponse } from "next/server";
import { maskEmail, peekToken } from "@/lib/auth";
import { claimEmail, getUser, releaseEmail, saveUser } from "@/lib/users";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// POST { token } -> confirma el correo del enlace de verificacion.
// El enlace NO se gasta al usarlo: los revisores de enlaces de Gmail lo
// abren antes que la persona, y si se gastara ella veria "enlace no
// valido" aunque el correo ya quedo confirmado. Repetirlo es inofensivo
// (solo confirma el mismo correo al que llego) y vence a las 24 horas.
export async function POST(request) {
  const { token } = await readJson(request);
  const data = await peekToken(token, "verify");
  if (!data) {
    return NextResponse.json({ error: "El enlace venció. Pide uno nuevo desde la pestaña Cuenta." }, { status: 400 });
  }
  const user = await getUser(data.uid);
  const ok = NextResponse.json({ ok: true, name: user?.name, email: maskEmail(data.email) });
  if (user?.email === data.email) return ok;
  if (!user || user.pendingEmail !== data.email) {
    return NextResponse.json({ error: "Este enlace ya no sirve: después se vinculó otro correo." }, { status: 400 });
  }
  if (!(await claimEmail(data.email, user.id))) {
    return NextResponse.json({ error: "Ese correo ya lo usa otra cuenta." }, { status: 409 });
  }
  const { pendingEmail, ...rest } = user;
  if (user.email && user.email !== data.email) await releaseEmail(user.email, user.id);
  await saveUser({ ...rest, email: data.email });
  return ok;
}
