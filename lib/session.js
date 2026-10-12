import crypto from "crypto";
import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE } from "@/config";

// Sesiones del servidor: al entrar con la clave se crea un token al azar que
// viaja en una cookie httpOnly (el JavaScript de la pagina no la puede
// leer). En la base solo se guarda el hash del token. Cada ruta de la API
// toma a la persona de la sesion, nunca de lo que mande el navegador.

const COOKIE = "pd_session";
const TTL = 60 * 60 * 24 * 180; // 180 dias desde el ultimo uso
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // lo maximo que guardan los navegadores

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const sessionKey = (h) => `session:${h}`;
const personSessions = (person) => `sessions:${person}`;

export async function createSession(person) {
  const token = crypto.randomBytes(32).toString("base64url");
  const h = hash(token);
  await Promise.all([
    kv.set(sessionKey(h), { person, at: Date.now() }, { ex: TTL }),
    kv.sadd(personSessions(person), h),
  ]);
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

// Respuesta JSON que ademas deja a la persona con sesion iniciada.
export async function withNewSession(person, body, init) {
  const token = await createSession(person);
  return setSessionCookie(NextResponse.json(body, init), token);
}

export async function sessionPerson(request) {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const key = sessionKey(hash(token));
  const session = await kv.get(key);
  if (!session || !PEOPLE.includes(session.person)) return null;
  kv.expire(key, TTL).catch(() => {}); // se renueva con cada uso
  return session.person;
}

export async function destroySession(request) {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return;
  const h = hash(token);
  const session = await kv.get(sessionKey(h));
  await kv.del(sessionKey(h));
  if (session?.person) await kv.srem(personSessions(session.person), h);
}

// Cierra todas las sesiones de una persona (al cambiar o recuperar la clave).
export async function destroyAllSessions(person) {
  const hashes = (await kv.smembers(personSessions(person))) || [];
  await Promise.all([...hashes.map((h) => kv.del(sessionKey(h))), kv.del(personSessions(person))]);
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
//   const person = auth.person;
export async function requireSession(request) {
  if (!sameOrigin(request)) {
    return { error: NextResponse.json({ error: "Origen no permitido" }, { status: 403 }) };
  }
  const person = await sessionPerson(request);
  if (!person) {
    return { error: NextResponse.json({ error: "Tu sesión terminó. Vuelve a entrar.", code: "no-session" }, { status: 401 }) };
  }
  return { person };
}

// Limite de intentos (ej. claves equivocadas): true si ya se pasó.
export async function overLimit(key, limit, windowSec) {
  const count = await kv.incr(`rl:${key}`);
  if (count === 1) await kv.expire(`rl:${key}`, windowSec);
  return count > limit;
}

export async function resetLimit(key) {
  await kv.del(`rl:${key}`);
}
