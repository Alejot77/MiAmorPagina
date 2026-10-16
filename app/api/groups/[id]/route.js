import { NextResponse } from "next/server";
import { GROUP_LIMITS, groupMembers, groupSettings, regenerateCode, removeMember, saveGroup } from "@/lib/groups";
import { getUser, saveUser } from "@/lib/users";
import { notifyGroup, sendPushToUser } from "@/lib/push";
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

// DELETE { newAdmin? } -> salir de la sala. Si eres el unico admin y quedan
// otras personas, primero tienes que nombrar a quien te reemplaza. Si eras
// la ultima persona, la sala se borra.
export async function DELETE(request, { params }) {
  const { id } = await params;
  const auth = await requireMemberOf(request, id);
  if (auth.error) return auth.error;
  const { newAdmin } = await readJson(request);
  const user = await getUser(auth.uid);
  const others = auth.members.filter((m) => m !== auth.uid);
  let group = auth.group;
  let named = null;

  if (isAdmin(group, auth.uid) && others.length > 0) {
    const otherAdmins = (group.admins || []).filter((a) => a !== auth.uid && others.includes(a));
    if (otherAdmins.length === 0) {
      if (!others.includes(newAdmin)) {
        return NextResponse.json({ error: "Antes de salir, elige quién será el nuevo admin", code: "need-admin" }, { status: 400 });
      }
      group = { ...group, admins: [...(group.admins || []), newAdmin] };
      await saveGroup(group);
      named = await getUser(newAdmin);
    }
  }

  const remaining = await removeMember(group, auth.uid);
  await saveUser({
    ...user,
    pinned: (user.pinned || []).filter((g) => g !== id),
    ...(user.lastGroup === id ? { lastGroup: null } : {}),
  });
  if (remaining) {
    const others2 = auth.members.filter((m) => m !== named?.id);
    await notifyGroup(remaining, others2, auth.uid, {
      title: "👋 Alguien salió",
      body: named ? `${user.name} salió de la sala y nombró admin a ${named.name}` : `${user.name} salió de la sala`,
    });
    if (named) {
      await sendPushToUser(named.id, { title: `⭐ Ahora eres admin · ${remaining.name}`, body: `${user.name} salió de la sala y te dejó como admin`, url: `/?g=${remaining.id}` });
    }
  }
  return NextResponse.json({ ok: true, deleted: !remaining });
}
