import { NextResponse } from "next/server";
import { groupByCode, groupMembers, isMember } from "@/lib/groups";
import { overLimit, sessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET ?code= -> vista previa de una invitacion: nombre de la sala y cuantas
// personas hay (lo muestra el enlace /unirme/<codigo> antes de entrar).
export async function GET(request) {
  const ip = (request.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (await overLimit(`invite:${ip}`, 60, 60 * 60)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un rato." }, { status: 429 });
  }
  const group = await groupByCode(new URL(request.url).searchParams.get("code"));
  if (!group) return NextResponse.json({ error: "Esta invitación no existe o ya cambió" }, { status: 404 });
  const members = await groupMembers(group);
  const uid = await sessionUserId(request);
  return NextResponse.json({
    name: group.name,
    count: members.length,
    // Los nombres solo se muestran a quien ya tiene cuenta y sesion.
    ...(uid ? { members: members.slice(0, 6).map((m) => ({ id: m.id, name: m.name, color: m.color })), alreadyMember: await isMember(group.id, uid) } : {}),
  });
}
