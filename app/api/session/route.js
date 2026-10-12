import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { DEFAULT_GROUP_NAME, THEMES, defaultThemeFor } from "@/config";
import { getAuth, publicStatus } from "@/lib/auth";
import { clearSessionCookie, destroySession, sessionPerson } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET -> quien tiene la sesion en este navegador y lo que la app necesita
// para arrancar (tema, nombre del grupo, estado del correo) en una sola
// llamada. Sin sesion: { person: null }.
export async function GET(request) {
  const person = await sessionPerson(request);
  if (!person) return NextResponse.json({ person: null });
  const [theme, groupName, record] = await Promise.all([
    kv.get(`theme:${person}`),
    kv.get("settings:group_name"),
    getAuth(person),
  ]);
  return NextResponse.json({
    person,
    theme: THEMES.some((t) => t.id === theme) ? theme : defaultThemeFor(person),
    groupName: typeof groupName === "string" && groupName.trim() ? groupName : DEFAULT_GROUP_NAME,
    account: publicStatus(record),
  });
}

// DELETE -> cerrar sesion en este navegador.
export async function DELETE(request) {
  await destroySession(request);
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
