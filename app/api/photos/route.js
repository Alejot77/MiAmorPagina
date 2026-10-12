import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { kv } from "@/lib/kv";
import { PEOPLE } from "@/config";
import { MAX_PHOTOS_PER_PLAN, MAX_PHOTO_BYTES, PHOTO_TYPES, loadPhotos, photosConfigured } from "@/lib/photos";

export const dynamic = "force-dynamic";

const NOT_CONFIGURED = "Falta conectar el almacenamiento de fotos (Vercel Blob) en Vercel.";

// GET ?planId= -> fotos de ese plan.
export async function GET(request) {
  const planId = new URL(request.url).searchParams.get("planId");
  if (!planId) return NextResponse.json({ error: "Falta el plan" }, { status: 400 });
  return NextResponse.json({ photos: await loadPhotos(planId), configured: photosConfigured() });
}

// POST (multipart: planId, person, file, w, h) -> sube una foto.
export async function POST(request) {
  if (!photosConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  const form = await request.formData();
  const person = form.get("person");
  const planId = form.get("planId");
  const file = form.get("file");

  if (!PEOPLE.includes(person)) return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  if (!planId || !(await kv.get(`plan:${planId}`))) return NextResponse.json({ error: "Ese plan ya no existe" }, { status: 404 });
  if (!file || typeof file === "string") return NextResponse.json({ error: "Falta la foto" }, { status: 400 });
  const ext = PHOTO_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Ese archivo no es una foto (JPG, PNG o WebP)" }, { status: 400 });
  if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: "La foto es demasiado pesada" }, { status: 400 });
  if ((await kv.hlen(`photos:${planId}`)) >= MAX_PHOTOS_PER_PLAN) {
    return NextResponse.json({ error: `Cada plan puede tener hasta ${MAX_PHOTOS_PER_PLAN} fotos` }, { status: 400 });
  }

  const id = `ph${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const blob = await put(`fotos/${planId}/${id}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true, // la URL no se puede adivinar
    contentType: file.type,
  });
  const photo = {
    id,
    url: blob.url,
    by: person,
    at: new Date().toISOString(),
    w: Number(form.get("w")) || null,
    h: Number(form.get("h")) || null,
  };
  await kv.hset(`photos:${planId}`, { [id]: photo });
  return NextResponse.json({ photos: await loadPhotos(planId) });
}

// DELETE { planId, photoId, person } -> borra una foto (archivo incluido).
export async function DELETE(request) {
  const { planId, photoId, person } = (await request.json()) || {};
  if (!PEOPLE.includes(person)) return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  const photo = (await loadPhotos(planId)).find((p) => p.id === photoId);
  if (!photo) return NextResponse.json({ error: "Esa foto ya no existe" }, { status: 404 });
  if (photosConfigured()) {
    await del(photo.url).catch((err) => console.error("[fotos] no se pudo borrar el archivo:", err?.message));
  }
  await kv.hdel(`photos:${planId}`, photoId);
  return NextResponse.json({ photos: await loadPhotos(planId) });
}
