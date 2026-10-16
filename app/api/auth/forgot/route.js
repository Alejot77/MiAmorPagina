import { NextResponse } from "next/server";
import { maskEmail, normalizeEmail, sendResetEmail, tooSoon } from "@/lib/auth";
import { getUser, userIdByEmail } from "@/lib/users";
import { ensureMigrated } from "@/lib/migrate";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// POST { email } -> "olvide mi clave": manda un enlace para crear una clave
// nueva, solo al correo VERIFICADO de esa cuenta. La respuesta es la misma
// exista o no la cuenta (para no revelar quien esta registrado).
export async function POST(request) {
  await ensureMigrated();
  const { email } = await readJson(request);
  const clean = normalizeEmail(email);
  const generic = NextResponse.json({ ok: true, email: maskEmail(clean) });
  const uid = await userIdByEmail(clean);
  const user = uid && (await getUser(String(uid)));
  if (!user?.email || user.email !== clean) return generic;
  if (await tooSoon("reset", user.id)) return generic;
  try {
    await sendResetEmail(request, user);
  } catch (err) {
    console.error("[auth] no se pudo enviar el correo de recuperacion:", err?.message);
    return NextResponse.json({ error: "No pudimos enviar el correo. Intenta de nuevo en un rato." }, { status: 502 });
  }
  return generic;
}
