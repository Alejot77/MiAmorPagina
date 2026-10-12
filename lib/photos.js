import { del } from "@vercel/blob";
import { kv } from "@/lib/kv";

// Las fotos de cada plan viven en Vercel Blob (el archivo) y en el hash
// `photos:<planId>` (id -> { id, url, by, at, w, h }).
export const MAX_PHOTOS_PER_PLAN = 40;
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // llegan comprimidas desde el celular
export const PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function photosConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function loadPhotos(planId) {
  const raw = (await kv.hgetall(`photos:${planId}`)) || {};
  return Object.values(raw)
    .map((p) => (typeof p === "string" ? JSON.parse(p) : p))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

export async function countPhotos(planId) {
  return (await kv.hlen(`photos:${planId}`)) || 0;
}

// Al borrar un plan se borran tambien sus fotos (archivos incluidos).
export async function deletePlanPhotos(planId) {
  const photos = await loadPhotos(planId);
  if (photos.length > 0 && photosConfigured()) {
    await del(photos.map((p) => p.url)).catch((err) => console.error("[fotos] no se pudieron borrar los archivos:", err?.message));
  }
  await kv.del(`photos:${planId}`);
}
