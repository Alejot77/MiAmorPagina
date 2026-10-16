import { NextResponse } from "next/server";
import { GROUP_LIMITS, addMember, groupByCode, groupSummary, isMember, memberIds, userGroupIds } from "@/lib/groups";
import { getUser, saveUser } from "@/lib/users";
import { notifyGroup } from "@/lib/push";
import { overLimit, requireSession } from "@/lib/session";
import { readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// POST { code } -> unirse a una sala con su codigo (o el del enlace).
export async function POST(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  // Freno a probar codigos al azar.
  if (await overLimit(`join:${auth.uid}`, 20, 60 * 60)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un rato." }, { status: 429 });
  }
  const group = await groupByCode((await readJson(request)).code);
  if (!group) return NextResponse.json({ error: "Ese código no existe o ya cambió" }, { status: 404 });

  const user = await getUser(auth.uid);
  if (!(await isMember(group.id, auth.uid))) {
    if ((await memberIds(group.id)).length >= GROUP_LIMITS.members) {
      return NextResponse.json({ error: `La sala ya tiene ${GROUP_LIMITS.members} personas` }, { status: 400 });
    }
    if ((await userGroupIds(auth.uid)).length >= GROUP_LIMITS.groupsPerUser) {
      return NextResponse.json({ error: `Puedes estar en hasta ${GROUP_LIMITS.groupsPerUser} salas` }, { status: 400 });
    }
    await addMember(group.id, auth.uid);
    const members = await memberIds(group.id);
    await notifyGroup(group, members, auth.uid, { title: "👋 Alguien nuevo", body: `${user.name} se unió a la sala` });
  }
  await saveUser({ ...user, lastGroup: group.id });
  return NextResponse.json({ group: await groupSummary(group, auth.uid, user.pinned || []) });
}
