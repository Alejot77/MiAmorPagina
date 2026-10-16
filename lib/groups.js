import crypto from "crypto";
import { kv } from "@/lib/kv";
import { getUsers, newId, publicUser } from "@/lib/users";
import { DEFAULT_GROUP_NAME, DESSERT_THRESHOLD, POINTS_PER_CATEGORY } from "@/config";

// Salas:
//   group:<id>          = { id, name, createdBy, createdAt, admins: [ids], code, settings }
//   members:<id>        = set de cuentas
//   user-groups:<cuenta>= set de salas de esa cuenta
//   invite:<codigo>     = id de la sala
//   groups              = set de todas las salas (para el cron)
// Todo lo de una sala vive bajo g:<id>:... (planes, votos, sitios, fotos,
// puntos), asi una sala nunca toca los datos de otra.

export const gk = (gid, ...parts) => `g:${gid}:${parts.join(":")}`;

export const GROUP_LIMITS = { name: 40, reward: 30, members: 50, groupsPerUser: 30 };

// Sin letras que se confunden (0/O, 1/I/L).
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newCode() {
  return Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join("");
}

export function normalizeCode(code) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function getGroup(gid) {
  return typeof gid === "string" && gid ? kv.get(`group:${gid}`) : null;
}

export function saveGroup(group) {
  return kv.set(`group:${group.id}`, group);
}

export async function memberIds(gid) {
  return ((await kv.smembers(`members:${gid}`)) || []).map(String);
}

export async function isMember(gid, uid) {
  return Boolean(gid && uid && (await kv.sismember(`members:${gid}`, uid)));
}

export async function userGroupIds(uid) {
  return ((await kv.smembers(`user-groups:${uid}`)) || []).map(String);
}

export function groupSettings(group) {
  const s = group?.settings || {};
  return {
    pointsPerCategory: Number.isInteger(s.pointsPerCategory) && s.pointsPerCategory > 0 ? s.pointsPerCategory : POINTS_PER_CATEGORY,
    dessertThreshold: Number.isInteger(s.dessertThreshold) && s.dessertThreshold > 0 ? s.dessertThreshold : DESSERT_THRESHOLD,
    reward: typeof s.reward === "string" && s.reward.trim() ? s.reward : "postre",
  };
}

async function claimCode(gid) {
  for (let i = 0; i < 10; i++) {
    const code = newCode();
    if (await kv.set(`invite:${code}`, gid, { nx: true })) return code;
  }
  throw new Error("No se pudo crear el código de invitación");
}

export async function createGroup({ name, uid, extra = {} }) {
  const id = extra.id || newId("g");
  const code = await claimCode(id);
  const group = {
    id,
    name: name || DEFAULT_GROUP_NAME,
    createdBy: uid,
    createdAt: new Date().toISOString(),
    admins: [uid],
    code,
    settings: {},
    ...extra,
  };
  await saveGroup(group);
  await Promise.all([kv.sadd(`members:${id}`, uid), kv.sadd(`user-groups:${uid}`, id), kv.sadd("groups", id)]);
  return group;
}

export async function addMember(gid, uid) {
  await Promise.all([kv.sadd(`members:${gid}`, uid), kv.sadd(`user-groups:${uid}`, gid)]);
}

// Saca a alguien. Si era el ultimo admin, el admin pasa a quien queda; si no
// queda nadie, la sala se borra con todos sus datos.
export async function removeMember(group, uid) {
  await Promise.all([kv.srem(`members:${group.id}`, uid), kv.srem(`user-groups:${uid}`, group.id)]);
  const rest = await memberIds(group.id);
  if (rest.length === 0) {
    await deleteGroup(group);
    return null;
  }
  let admins = (group.admins || []).filter((a) => a !== uid && rest.includes(a));
  if (admins.length === 0) admins = [rest[0]];
  const updated = { ...group, admins };
  await saveGroup(updated);
  return updated;
}

export async function regenerateCode(group) {
  const code = await claimCode(group.id);
  if (group.code) await kv.del(`invite:${group.code}`);
  const updated = { ...group, code };
  await saveGroup(updated);
  return updated;
}

export async function groupByCode(code) {
  const clean = normalizeCode(code);
  if (clean.length < 4) return null;
  const gid = await kv.get(`invite:${clean}`);
  return gid ? getGroup(String(gid)) : null;
}

// Miembros con nombre y color, en orden de llegada aproximado (admins primero).
export async function groupMembers(group) {
  const ids = await memberIds(group.id);
  const users = await getUsers(ids);
  return users
    .map((u) => ({ ...publicUser(u), admin: (group.admins || []).includes(u.id) }))
    .sort((a, b) => Number(b.admin) - Number(a.admin) || a.name.localeCompare(b.name));
}

// Resumen de una sala para la lista de salas de una persona.
export async function groupSummary(group, uid, pinned = []) {
  const members = await groupMembers(group);
  return {
    id: group.id,
    name: group.name,
    members,
    admin: (group.admins || []).includes(uid),
    pinned: pinned.includes(group.id),
  };
}

// Borra una sala y todo lo suyo (planes, votos, sitios, fotos, puntos).
export async function deleteGroup(group) {
  const { deleteBlobs } = await import("@/lib/photos");
  let cursor = "0";
  const keys = [];
  do {
    const [next, batch] = await kv.scan(cursor, { match: `g:${group.id}:*`, count: 500 });
    cursor = String(next);
    keys.push(...batch);
  } while (cursor !== "0");
  const photoKeys = keys.filter((k) => k.includes(":photos:"));
  const photos = (await Promise.all(photoKeys.map((k) => kv.hgetall(k)))).flatMap((h) => Object.values(h || {}));
  await deleteBlobs(photos.map((p) => (typeof p === "string" ? JSON.parse(p) : p).url));
  await Promise.all([
    ...keys.map((k) => kv.del(k)),
    kv.del(`group:${group.id}`),
    kv.del(`members:${group.id}`),
    group.code ? kv.del(`invite:${group.code}`) : null,
    kv.srem("groups", group.id),
  ]);
}

// Lista de salas de una cuenta: fijadas primero.
export async function userGroups(user) {
  const ids = await userGroupIds(user.id);
  const groups = (await Promise.all(ids.map(getGroup))).filter(Boolean);
  const pinned = Array.isArray(user.pinned) ? user.pinned : [];
  const list = await Promise.all(groups.map((g) => groupSummary(g, user.id, pinned)));
  return list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));
}
