import { NextResponse } from "next/server";
import { userGroups } from "@/lib/groups";
import { getUser, selfUser } from "@/lib/users";
import { ensureMigrated } from "@/lib/migrate";
import { clearSessionCookie, destroySession, sessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET -> quien tiene la sesion, sus salas y en cual estaba. Sin sesion:
// { user: null }.
export async function GET(request) {
  await ensureMigrated();
  const uid = await sessionUserId(request);
  const user = uid && (await getUser(uid));
  if (!user) return NextResponse.json({ user: null });
  const groups = await userGroups(user);
  const current = groups.find((g) => g.id === user.lastGroup) || groups[0] || null;
  return NextResponse.json({ user: selfUser(user), groups, currentGroup: current?.id || null });
}

// DELETE -> cerrar sesion en este navegador.
export async function DELETE(request) {
  await destroySession(request);
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
