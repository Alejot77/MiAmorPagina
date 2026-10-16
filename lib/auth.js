import crypto from "crypto";
import { kv } from "@/lib/kv";
import { sendMail } from "@/lib/mail";

// Claves y correos de las cuentas (las cuentas viven en lib/users.js).
// - email: el correo YA verificado. Es el unico al que se mandan los
//   enlaces de "olvide mi clave".
// - pendingEmail: el correo que se acaba de vincular y espera que abran el
//   enlace de verificacion. Mientras tanto el verificado anterior (si habia)
//   sigue siendo el de recuperacion.

export const MIN_PASSWORD = 6;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password, record) {
  if (!record?.salt || !record?.hash || typeof password !== "string") return false;
  const hash = crypto.scryptSync(password, record.salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(record.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Error de una clave nueva, o null si sirve.
export function passwordProblem(newPassword, confirm) {
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD) {
    return `La clave debe tener al menos ${MIN_PASSWORD} caracteres`;
  }
  if (newPassword.length > 200) return "La clave es demasiado larga";
  if (newPassword !== confirm) return "Las claves no coinciden";
  return null;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// "alejandro@gmail.com" -> "al•••••••@gmail.com"
export function maskEmail(email) {
  if (!email) return null;
  const [user, domain] = email.split("@");
  const visible = user.slice(0, Math.min(2, user.length - 1));
  return `${visible}${"•".repeat(Math.max(1, user.length - visible.length))}@${domain}`;
}

// ---------- Enlaces de un solo uso ----------
// En la base solo se guarda el hash del token: aunque alguien viera la
// base, no podria armar un enlace valido.

const TOKEN_TTL = { verify: 60 * 60 * 24, reset: 60 * 60 };

const tokenKey = (token) => `auth-token:${crypto.createHash("sha256").update(String(token)).digest("hex")}`;

async function createToken(type, data) {
  const token = crypto.randomBytes(32).toString("base64url");
  await kv.set(tokenKey(token), { type, ...data }, { ex: TOKEN_TTL[type] });
  return token;
}

export async function peekToken(token, type) {
  if (!token || typeof token !== "string") return null;
  const data = await kv.get(tokenKey(token));
  return data?.type === type ? data : null;
}

export async function consumeToken(token, type) {
  if (!token || typeof token !== "string") return null;
  const data = await kv.getdel(tokenKey(token));
  return data?.type === type ? data : null;
}

// Evita mandar correos en rafaga (un envio por minuto por cuenta y tipo).
export async function tooSoon(kind, key) {
  const ok = await kv.set(`auth-cooldown:${kind}:${key}`, 1, { ex: 60, nx: true });
  return ok === null;
}

// Origen publico de la app para armar los enlaces de los correos. Nunca se
// toma de los encabezados de la peticion (se podrian falsificar para que el
// enlace de "olvide mi clave" apunte a otro sitio): en Vercel se usa el
// dominio de produccion que Vercel mismo define.
export function appOrigin(request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return new URL(request.url).origin; // desarrollo local
}

// El nombre lo escribe cada persona: se escapa antes de meterlo en el HTML.
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function emailLayout({ title, intro, button, link, outro }) {
  const text = `${title}\n\n${intro}\n\n${button}: ${link}\n\n${outro}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f1fb;font-family:Arial,Helvetica,sans-serif;color:#292231">
<div style="max-width:440px;margin:0 auto;padding:32px 20px">
  <div style="background:#ffffff;border-radius:22px;padding:30px 26px;text-align:center">
    <div style="font-size:12px;letter-spacing:2px;color:#7a4fd6;font-weight:bold">PLAN DE DOS</div>
    <h1 style="font-family:Georgia,serif;font-size:26px;margin:12px 0 10px">${escapeHtml(title)}</h1>
    <p style="font-size:15px;line-height:1.5;color:#5d5568;margin:0 0 24px">${escapeHtml(intro)}</p>
    <a href="${link}" style="display:inline-block;background:#7a4fd6;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:14px">${escapeHtml(button)}</a>
    <p style="font-size:12px;line-height:1.5;color:#8b8494;margin:24px 0 0">${escapeHtml(outro)}</p>
  </div>
  <p style="font-size:11px;color:#a49dad;text-align:center;margin-top:16px;word-break:break-all">Si el botón no funciona, copia este enlace:<br>${link}</p>
</div></body></html>`;
  return { text, html };
}

export async function sendVerificationEmail(request, user, email) {
  const token = await createToken("verify", { uid: user.id, email });
  const link = `${appOrigin(request)}/verificar?token=${token}`;
  await sendMail({
    to: email,
    subject: "Confirma tu correo en Plan de dos 💜",
    ...emailLayout({
      title: `Hola, ${user.name}`,
      intro: "Confirma que este es tu correo. Es el que vamos a usar si algún día olvidas tu clave.",
      button: "Confirmar mi correo",
      link,
      outro: "El enlace vence en 24 horas. Si no fuiste tú, ignora este correo.",
    }),
  });
}

export async function sendResetEmail(request, user) {
  const token = await createToken("reset", { uid: user.id });
  const link = `${appOrigin(request)}/recuperar?token=${token}`;
  await sendMail({
    to: user.email,
    subject: "Crea una clave nueva en Plan de dos",
    ...emailLayout({
      title: `¿Olvidaste tu clave, ${user.name}?`,
      intro: "Toca el botón para crear una clave nueva.",
      button: "Crear clave nueva",
      link,
      outro: "El enlace vence en 1 hora y sirve una sola vez. Si no lo pediste, ignora este correo: tu clave sigue igual.",
    }),
  });
}

// Manda el correo de verificacion sin tumbar la peticion si falla: la
// cuenta queda creada y desde la app se puede reenviar.
export async function trySendVerification(request, user, email) {
  try {
    await sendVerificationEmail(request, user, email);
    return { emailSent: true };
  } catch (err) {
    console.error("[auth] no se pudo enviar la verificacion:", err?.message);
    return { emailSent: false, emailError: "No pudimos enviar el correo de verificación. Puedes reenviarlo desde la pestaña Cuenta." };
  }
}
