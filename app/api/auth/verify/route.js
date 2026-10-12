import { NextResponse } from "next/server";
import { getAuth, saveAuth, peekToken, maskEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST { token } -> confirma el correo del enlace de verificacion.
// El enlace NO se gasta al usarlo: los revisores de enlaces de Gmail lo
// abren antes que la persona, y si se gastara ella veria "enlace no
// valido" aunque el correo ya quedo confirmado. Repetirlo es inofensivo
// (solo confirma el mismo correo al que llego) y vence a las 24 horas.
export async function POST(request) {
  const { token } = (await request.json()) || {};
  const data = await peekToken(token, "verify");
  if (!data) {
    return NextResponse.json({ error: "El enlace venció. Pide uno nuevo desde la pestaña Cuenta." }, { status: 400 });
  }
  const ok = NextResponse.json({ ok: true, person: data.person, email: maskEmail(data.email) });
  const record = await getAuth(data.person);
  if (record?.email === data.email) return ok;
  if (!record || record.pendingEmail !== data.email) {
    return NextResponse.json({ error: "Este enlace ya no sirve: después se vinculó otro correo." }, { status: 400 });
  }
  const { pendingEmail, ...rest } = record;
  await saveAuth(data.person, { ...rest, email: data.email });
  return ok;
}
