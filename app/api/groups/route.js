import { NextResponse } from "next/server";
import { GROUP_LIMITS, createGroup, groupSummary, userGroupIds, userGroups } from "@/lib/groups";
import { getUser, saveUser } from "@/lib/users";
import { requireSession } from "@/lib/session";
import { cleanText, readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

// GET -> salas de quien tiene la sesion (fijadas primero).
export async function GET(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const user = await getUser(auth.uid);
  return NextResponse.json({ groups: user ? await userGroups(user) : [] });
}

// POST { name } -> crea una sala; quien la crea queda de admin.
export async function POST(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const name = cleanText((await readJson(request)).name, GROUP_LIMITS.name);
  if (!name) return NextResponse.json({ error: "Ponle un nombre a la sala" }, { status: 400 });
  if ((await userGroupIds(auth.uid)).length >= GROUP_LIMITS.groupsPerUser) {
    return NextResponse.json({ error: `Puedes estar en hasta ${GROUP_LIMITS.groupsPerUser} salas` }, { status: 400 });
  }
  const group = await createGroup({ name, uid: auth.uid });
  const user = await getUser(auth.uid);
  await saveUser({ ...user, lastGroup: group.id });
  return NextResponse.json({ group: await groupSummary(group, auth.uid, user.pinned || []) });
}
