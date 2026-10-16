import { NextResponse } from "next/server";
import { THEMES } from "@/config";
import { isMember } from "@/lib/groups";
import { NAME_MAX, getUser, saveUser, selfUser } from "@/lib/users";
import { requireSession } from "@/lib/session";
import { cleanText, readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// PATCH -> cambios de la propia cuenta (solo lo que venga):
//   { name }            nombre que ven los demas
//   { theme }           tema de color
//   { pin, pinned }     fijar / soltar una sala en el cambio rapido
//   { lastGroup }       sala que se abre al entrar
export async function PATCH(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  const user = await getUser(auth.uid);
  if (!user) return NextResponse.json({ error: "Esa cuenta ya no existe" }, { status: 404 });
  const updated = { ...user };

  if ("name" in body) {
    const name = cleanText(body.name, NAME_MAX);
    if (!name) return NextResponse.json({ error: "Escribe tu nombre" }, { status: 400 });
    updated.name = name;
  }
  if ("theme" in body) {
    if (!THEMES.some((t) => t.id === body.theme)) return NextResponse.json({ error: "Ese tema no existe" }, { status: 400 });
    updated.theme = body.theme;
  }
  if ("pin" in body) {
    if (!(await isMember(body.pin, user.id))) return NextResponse.json({ error: "No eres parte de esa sala" }, { status: 403 });
    const pinned = new Set(Array.isArray(user.pinned) ? user.pinned : []);
    if (body.pinned) pinned.add(body.pin);
    else pinned.delete(body.pin);
    updated.pinned = [...pinned];
  }
  if ("lastGroup" in body) {
    if (!(await isMember(body.lastGroup, user.id))) return NextResponse.json({ error: "No eres parte de esa sala" }, { status: 403 });
    updated.lastGroup = body.lastGroup;
  }

  await saveUser(updated);
  return NextResponse.json({ user: selfUser(updated) });
}
