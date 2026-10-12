import { NextResponse } from "next/server";
import { PEOPLE } from "@/config";
import { getAuth, maskEmail, tooSoon, sendResetEmail } from "@/lib/auth";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// POST { person } -> "olvide mi clave": manda un enlace para crear una
// clave nueva, solo al correo verificado de esa persona.
export async function POST(request) {
  const { person } = await readJson(request);
  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  const record = await getAuth(person);
  if (!record) {
    return NextResponse.json({ error: "Todavía no has creado tu cuenta" }, { status: 400 });
  }
  if (!record.email) {
    return NextResponse.json(
      { error: "Todavía no tienes un correo verificado, así que no podemos recuperar tu clave por correo." },
      { status: 400 }
    );
  }
  const email = maskEmail(record.email);
  if (await tooSoon("reset", person)) {
    return NextResponse.json({ ok: true, email, again: true });
  }
  try {
    await sendResetEmail(request, person, record.email);
  } catch (err) {
    console.error("[auth] no se pudo enviar el correo de recuperacion:", err?.message);
    return NextResponse.json({ error: "No pudimos enviar el correo. Intenta de nuevo en un rato." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, email });
}
