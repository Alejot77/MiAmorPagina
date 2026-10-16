import { NextResponse } from "next/server";
import { GROUP_LIMITS, groupMembers, groupSettings, regenerateCode, removeMember, saveGroup } from "@/lib/groups";
import { getUser, saveUser } from "@/lib/users";
import { notifyGroup } from "@/lib/push";
import { isAdmin, requireMemberOf } from "@/lib/session";
import { cleanText, readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

async function detail(group, uid) {
  return {
    id: group.id,
    name: group.name,
    code: group.code,
    createdAt: group.createdAt,
    settings: groupSettings(group),
    members: await groupMembers(group),
    admin: isAdmin(group, uid),
  };
}

// GET -> datos de la sala (miembros, codigo de invitacion, reglas).
export async function GET(request, { params }) {
  const { id } = await params;
  const auth = await requireMemberOf(request, id);
  if (auth.error) return auth.error;
  return NextResponse.json({ group: await detail(auth.group, auth.uid) });
}

// PATCH (solo admins) -> { name }, { settings: { pointsPerCategory,
// dessertThreshold, reward } } o { regenerateCode: true }.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const auth = await requireMemberOf(request, id);
  if (auth.error) return auth.error;
  if (!isAdmin(auth.group, auth.uid)) {
    return NextResponse.json({ error: "Solo quien administra la sala puede cambiar eso" }, { status: 403 });
  }
  const body = await readJson(request);
  let group = { ...auth.group };

  if ("name" in body) {
    const name = cleanText(body.name, GROUP_LIMITS.name);
    if (!name) return NextResponse.json({ error: "Ponle un nombre a la sala" }, { status: 400 });
    group.name = name;
  }
  if (body.settings && typeof body.settings === "object") {
    const s = body.settings;
    const settings = { ...(group.settings || {}) };
    if ("pointsPerCategory" in s) {
      const v = Number(s.pointsPerCategory);
      if (!Number.isInteger(v) || v <= 0 || v > 1000) {
        return NextResponse.json({ error: "Los puntos por categoría deben ser un número entre 1 y 1000" }, { status: 400 });
      }
      settings.pointsPerCategory = v;
    }
    if ("dessertThreshold" in s) {
      const v = Number(s.dessertThreshold);
      if (!Number.isInteger(v) || v <= 0 || v > 100000) {
        return NextResponse.json({ error: "La meta debe ser un número entre 1 y 100000" }, { status: 400 });
      }
      settings.dessertThreshold = v;
    }
    if ("reward" in s) settings.reward = cleanText(s.reward, GROUP_LIMITS.reward) || "postre";
    group.settings = settings;
  }
  await saveGroup(group);
  if (body.regenerateCode) group = await regenerateCode(group);
  return NextResponse.json({ group: await detail(group, auth.uid) });
}

// DELETE -> salir de la sala. Si era la ultima persona, la sala se borra.
export async function DELETE(request, { params }) {
  const { id } = await params;
  const auth = await requireMemberOf(request, id);
  if (auth.error) return auth.error;
  const user = await getUser(auth.uid);
  const remaining = await removeMember(auth.group, auth.uid);
  await saveUser({
    ...user,
    pinned: (user.pinned || []).filter((g) => g !== id),
    ...(user.lastGroup === id ? { lastGroup: null } : {}),
  });
  if (remaining) {
    await notifyGroup(remaining, auth.members, auth.uid, { title: "👋 Alguien salió", body: `${user.name} salió de la sala` });
  }
  return NextResponse.json({ ok: true, deleted: !remaining });
}
