import { del } from "@vercel/blob";
import { kv } from "@/lib/kv";
import { gk } from "@/lib/groups";

// Las fotos de cada plan viven en Vercel Blob (el archivo) y en el hash
// `g:<sala>:photos:<planId>` (id -> { id, url, by, at, w, h }).
export const MAX_PHOTOS_PER_PLAN = 40;
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // llegan comprimidas desde el celular
export const PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function photosConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

const photosKey = (gid, planId) => gk(gid, "photos", planId);

export async function loadPhotos(gid, planId) {
  const raw = (await kv.hgetall(photosKey(gid, planId))) || {};
  return Object.values(raw)
    .map((p) => (typeof p === "string" ? JSON.parse(p) : p))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

export async function countPhotos(gid, planId) {
  return (await kv.hlen(photosKey(gid, planId))) || 0;
}

export async function deleteBlobs(urls) {
  const list = urls.filter(Boolean);
  if (list.length === 0 || !photosConfigured()) return;
  await del(list).catch((err) => console.error("[fotos] no se pudieron borrar los archivos:", err?.message));
}

// Al borrar un plan se borran tambien sus fotos (archivos incluidos).
export async function deletePlanPhotos(gid, planId) {
  const photos = await loadPhotos(gid, planId);
  await deleteBlobs(photos.map((p) => p.url));
  await kv.del(photosKey(gid, planId));
}
