// Limpieza de lo que llega del navegador antes de guardarlo.

export const LIMITS = {
  name: 80, // opciones, sitios, tipos de comida
  question: 120,
  area: 80,
  note: 500,
  link: 500,
  steps: 12, // categorias por plan
  options: 20, // opciones por categoria
};

export function cleanText(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

// Nota de varias lineas (respeta los saltos de linea).
export function cleanNote(value, max = LIMITS.note) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, max);
}

// Solo enlaces http/https. "maps.app.goo.gl/x" se completa con https://.
// Cualquier otra cosa (javascript:, data:, ...) se descarta.
export function safeLink(value) {
  const raw = cleanText(value, LIMITS.link);
  if (!raw) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function isDateStr(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Ids que se usan dentro de claves de la base (plan:<id>, votes:<id>:<id>).
export function isId(value) {
  return typeof value === "string" && /^[\w:.-]{1,80}$/.test(value);
}

// Lee el JSON del cuerpo sin reventar si viene vacio o mal formado.
export async function readJson(request) {
  try {
    return (await request.json()) || {};
  } catch {
    return {};
  }
}
