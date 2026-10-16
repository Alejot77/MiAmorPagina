import crypto from "crypto";
import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { getGroup, isMember, memberIds } from "@/lib/groups";

// Sesiones del servidor: al entrar con la clave se crea un token al azar que
// viaja en una cookie httpOnly (el JavaScript de la pagina no la puede
// leer). En la base solo se guarda el hash del token. Cada ruta de la API
// toma la cuenta de la sesion, nunca de lo que mande el navegador.

const COOKIE = "pd_session";
const TTL = 60 * 60 * 24 * 180; // 180 dias desde el ultimo uso
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // lo maximo que guardan los navegadores

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const sessionKey = (h) => `session:${h}`;
const userSessions = (uid) => `sessions:${uid}`;

export async function createSession(uid) {
  const token = crypto.randomBytes(32).toString("base64url");
  const h = hash(token);
  await Promise.all([kv.set(sessionKey(h), { uid, at: Date.now() }, { ex: TTL }), kv.sadd(userSessions(uid), h)]);
  return token;
}

export function setSessionCookie(response, token) {
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}

export function clearSessionCookie(response) {
  response.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}

// Respuesta JSON que ademas deja la cuenta con sesion iniciada.
export async function withNewSession(uid, body, init) {
  const token = await createSession(uid);
  return setSessionCookie(NextResponse.json(body, init), token);
}

// Cuenta de la sesion. Las sesiones de antes de las salas guardaban el
// nombre ({ person }): se traducen a la cuenta que les creo la migracion.
export async function sessionUserId(request) {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const h = hash(token);
  const key = sessionKey(h);
  const session = await kv.get(key);
  if (!session) return null;
  let uid = session.uid;
  if (!uid && session.person) {
    const { ensureMigrated } = await import("@/lib/migrate");
    await ensureMigrated();
    uid = await kv.get(`legacy-person:${session.person}`);
    if (!uid) return null;
    await Promise.all([kv.set(key, { uid, at: session.at || Date.now() }, { ex: TTL }), kv.sadd(userSessions(uid), h)]);
    return uid;
  }
  kv.expire(key, TTL).catch(() => {}); // se renueva con cada uso
  return uid || null;
}

export async function destroySession(request) {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return;
  const h = hash(token);
  const session = await kv.get(sessionKey(h));
  await kv.del(sessionKey(h));
  if (session?.uid) await kv.srem(userSessions(session.uid), h);
}

// Cierra todas las sesiones de una cuenta (al cambiar o recuperar la clave).
export async function destroyAllSessions(uid) {
  const hashes = (await kv.smembers(userSessions(uid))) || [];
  await Promise.all([...hashes.map((h) => kv.del(sessionKey(h))), kv.del(userSessions(uid))]);
}

// Las peticiones que cambian datos deben venir de esta misma app (ademas de
// la cookie SameSite=Lax, por si un navegador viejo no la respeta).
function sameOrigin(request) {
  if (request.method === "GET" || request.method === "HEAD") return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Uso en una ruta:
//   const auth = await requireSession(request);
//   if (auth.error) return auth.error;
//   const uid = auth.uid;
export async function requireSession(request) {
  if (!sameOrigin(request)) {
    return { error: NextResponse.json({ error: "Origen no permitido" }, { status: 403 }) };
  }
  const uid = await sessionUserId(request);
  if (!uid) {
    return { error: NextResponse.json({ error: "Tu sesión terminó. Vuelve a entrar.", code: "no-session" }, { status: 401 }) };
  }
  return { uid };
}

// Para las rutas de una sala: la sala va en el encabezado X-Group y la
// cuenta tiene que ser miembro. Devuelve { uid, gid, group, members }.
export async function requireMember(request) {
  const gid = request.headers.get("x-group") || new URL(request.url).searchParams.get("g");
  return requireMemberOf(request, gid);
}

export async function requireMemberOf(request, gid) {
  const auth = await requireSession(request);
  if (auth.error) return auth;
  if (!gid || !(await isMember(gid, auth.uid))) {
    return { error: NextResponse.json({ error: "No eres parte de esa sala", code: "no-group" }, { status: 403 }) };
  }
  const [group, members] = await Promise.all([getGroup(gid), memberIds(gid)]);
  if (!group) return { error: NextResponse.json({ error: "Esa sala ya no existe", code: "no-group" }, { status: 404 }) };
  return { uid: auth.uid, gid, group, members };
}

export const isAdmin = (group, uid) => (group?.admins || []).includes(uid);

// Limite de intentos (ej. claves equivocadas): true si ya se pasó.
export async function overLimit(key, limit, windowSec) {
  const count = await kv.incr(`rl:${key}`);
  if (count === 1) await kv.expire(`rl:${key}`, windowSec);
  return count > limit;
}

export async function resetLimit(key) {
  await kv.del(`rl:${key}`);
}
