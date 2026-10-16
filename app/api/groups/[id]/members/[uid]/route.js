import { NextResponse } from "next/server";
import { groupMembers, isMember, removeMember, saveGroup } from "@/lib/groups";
import { getUser, saveUser } from "@/lib/users";
import { isAdmin, requireMemberOf } from "@/lib/session";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

async function checkAdmin(request, params) {
  const { id, uid } = await params;
  const auth = await requireMemberOf(request, id);
  if (auth.error) return auth;
  if (!isAdmin(auth.group, auth.uid)) {
    return { error: NextResponse.json({ error: "Solo quien administra la sala puede hacer eso" }, { status: 403 }) };
  }
  if (!(await isMember(id, uid))) return { error: NextResponse.json({ error: "Esa persona ya no está en la sala" }, { status: 404 }) };
  return { ...auth, target: uid };
}

// DELETE (admin) -> sacar a alguien de la sala.
export async function DELETE(request, { params }) {
  const auth = await checkAdmin(request, params);
  if (auth.error) return auth.error;
  if (auth.target === auth.uid) return NextResponse.json({ error: "Para salir usa «Salir de la sala»" }, { status: 400 });
  const remaining = await removeMember(auth.group, auth.target);
  const user = await getUser(auth.target);
  if (user) {
    await saveUser({
      ...user,
      pinned: (user.pinned || []).filter((g) => g !== auth.gid),
      ...(user.lastGroup === auth.gid ? { lastGroup: null } : {}),
    });
  }
  return NextResponse.json({ members: remaining ? await groupMembers(remaining) : [] });
}

// PATCH (admin) { admin: true|false } -> dar o quitar el rol de admin.
export async function PATCH(request, { params }) {
  const auth = await checkAdmin(request, params);
  if (auth.error) return auth.error;
  const { admin } = await readJson(request);
  const admins = new Set(auth.group.admins || []);
  if (admin) admins.add(auth.target);
  else admins.delete(auth.target);
  if (admins.size === 0) return NextResponse.json({ error: "La sala necesita al menos un admin" }, { status: 400 });
  const group = { ...auth.group, admins: [...admins] };
  await saveGroup(group);
  return NextResponse.json({ members: await groupMembers(group) });
}
