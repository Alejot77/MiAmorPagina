import crypto from "crypto";
import { kv } from "@/lib/kv";
import { maskEmail, normalizeEmail } from "@/lib/auth";

// Cuentas: `user:<id>` = { id, name, color, email?, pendingEmail?, salt, hash,
// theme?, pinned: [salas fijadas], lastGroup?, flowers?, createdAt }.
// `user-email:<correo>` -> id (para entrar con el correo y que no se repita).

export const AVATAR_COLORS = ["#ef7096", "#e45757", "#7a5cf0", "#2f9e8f", "#e8913a", "#3d7be0", "#c04fd8", "#5aa84a"];
export const NAME_MAX = 30;

export function newId(prefix) {
  return `${prefix}${crypto.randomBytes(8).toString("hex")}`;
}

export function getUser(id) {
  return typeof id === "string" && id ? kv.get(`user:${id}`) : null;
}

export async function getUsers(ids) {
  if (!ids || ids.length === 0) return [];
  return ((await kv.mget(...ids.map((id) => `user:${id}`))) || []).filter(Boolean);
}

export function saveUser(user) {
  return kv.set(`user:${user.id}`, user);
}

export async function userIdByEmail(email) {
  const clean = normalizeEmail(email);
  return clean ? kv.get(`user-email:${clean}`) : null;
}

// Reserva el correo para esta cuenta. false si ya lo tiene otra.
export async function claimEmail(email, userId) {
  const clean = normalizeEmail(email);
  const ok = await kv.set(`user-email:${clean}`, userId, { nx: true });
  if (ok) return true;
  return (await kv.get(`user-email:${clean}`)) === userId;
}

export function releaseEmail(email, userId) {
  const clean = normalizeEmail(email);
  if (!clean) return null;
  return kv.get(`user-email:${clean}`).then((owner) => (owner === userId ? kv.del(`user-email:${clean}`) : null));
}

export function pickColor() {
  return AVATAR_COLORS[crypto.randomInt(AVATAR_COLORS.length)];
}

// Lo que ven los demas miembros de una sala.
export function publicUser(user) {
  return { id: user.id, name: user.name, color: user.color };
}

// Lo que ve la propia persona de su cuenta (sin la clave ni el correo completo).
export function selfUser(user) {
  return {
    id: user.id,
    name: user.name,
    color: user.color,
    email: maskEmail(user.email),
    emailVerified: Boolean(user.email),
    pendingEmail: maskEmail(user.pendingEmail),
    theme: user.theme || null,
    pinned: Array.isArray(user.pinned) ? user.pinned : [],
    flowers: Boolean(user.flowers),
    createdAt: user.createdAt || null,
    seenUpdate: user.seenUpdate || null,
  };
}
