import { NextResponse } from "next/server";
import { getAuth, saveAuth, consumeToken, maskEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST { token } -> confirma el correo del enlace de verificacion.
export async function POST(request) {
  const { token } = (await request.json()) || {};
  const data = await consumeToken(token, "verify");
  if (!data) {
    return NextResponse.json({ error: "El enlace venció o ya se usó. Pide uno nuevo desde Ajustes." }, { status: 400 });
  }
  const record = await getAuth(data.person);
  if (record?.email === data.email && !record.pendingEmail) {
    return NextResponse.json({ ok: true, person: data.person, email: maskEmail(data.email) });
  }
  if (!record || record.pendingEmail !== data.email) {
    return NextResponse.json({ error: "Este enlace ya no sirve: después se vinculó otro correo." }, { status: 400 });
  }
  const { pendingEmail, ...rest } = record;
  await saveAuth(data.person, { ...rest, email: data.email });
  return NextResponse.json({ ok: true, person: data.person, email: maskEmail(data.email) });
}
