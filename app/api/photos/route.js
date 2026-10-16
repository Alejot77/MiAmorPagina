import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { kv } from "@/lib/kv";
import { MAX_PHOTOS_PER_PLAN, MAX_PHOTO_BYTES, PHOTO_TYPES, loadPhotos, photosConfigured } from "@/lib/photos";
import { gk } from "@/lib/groups";
import { requireMember } from "@/lib/session";
import { isId, readJson } from "@/lib/validate";

export const dynamic = "force-dynamic";

const NOT_CONFIGURED = "Falta conectar el almacenamiento de fotos (Vercel Blob) en Vercel.";

// GET ?planId= -> fotos de ese plan.
export async function GET(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const planId = new URL(request.url).searchParams.get("planId");
  if (!isId(planId)) return NextResponse.json({ error: "Falta el plan" }, { status: 400 });
  return NextResponse.json({ photos: await loadPhotos(auth.gid, planId), configured: photosConfigured() });
}

// POST (multipart: planId, person, file, w, h) -> sube una foto.
export async function POST(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const { gid, uid: person } = auth;
  if (!photosConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Falta la foto" }, { status: 400 });
  const planId = form.get("planId");
  const file = form.get("file");

  if (!isId(planId) || !(await kv.get(gk(gid, "plan", planId)))) return NextResponse.json({ error: "Ese plan ya no existe" }, { status: 404 });
  if (!file || typeof file === "string") return NextResponse.json({ error: "Falta la foto" }, { status: 400 });
  const ext = PHOTO_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Ese archivo no es una foto (JPG, PNG o WebP)" }, { status: 400 });
  if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: "La foto es demasiado pesada" }, { status: 400 });
  if ((await kv.hlen(gk(gid, "photos", planId))) >= MAX_PHOTOS_PER_PLAN) {
    return NextResponse.json({ error: `Cada plan puede tener hasta ${MAX_PHOTOS_PER_PLAN} fotos` }, { status: 400 });
  }

  const id = `ph${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const blob = await put(`fotos/${gid}/${planId}/${id}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true, // la URL no se puede adivinar
    contentType: file.type,
  });
  const photo = {
    id,
    url: blob.url,
    by: person,
    at: new Date().toISOString(),
    w: Math.min(Number(form.get("w")) || 0, 10000) || null,
    h: Math.min(Number(form.get("h")) || 0, 10000) || null,
  };
  await kv.hset(gk(gid, "photos", planId), { [id]: photo });
  return NextResponse.json({ photos: await loadPhotos(gid, planId) });
}

// DELETE { planId, photoId, person } -> borra una foto (archivo incluido).
export async function DELETE(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const { planId, photoId } = await readJson(request);
  if (!isId(planId)) return NextResponse.json({ error: "Esa foto ya no existe" }, { status: 404 });
  const photo = (await loadPhotos(auth.gid, planId)).find((p) => p.id === photoId);
  if (!photo) return NextResponse.json({ error: "Esa foto ya no existe" }, { status: 404 });
  if (photosConfigured()) {
    await del(photo.url).catch((err) => console.error("[fotos] no se pudo borrar el archivo:", err?.message));
  }
  await kv.hdel(gk(auth.gid, "photos", planId), photoId);
  return NextResponse.json({ photos: await loadPhotos(auth.gid, planId) });
}
