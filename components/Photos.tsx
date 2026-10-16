"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import type { Photo } from "./types";
import { api, checkSession, groupHeaders } from "./api";
import { memberName } from "./members";
import { ConfirmDialog, Icon } from "./ui";

const MAX_SIDE = 1600;
const QUALITY = 0.82;

// Reduce la foto en el celular antes de subirla (lado mayor 1600px, JPEG):
// pasa de varios MB a unos cientos de KB y no se nota en pantalla.
async function compressImage(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file);
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No se pudo leer la foto"));
      img.src = URL.createObjectURL(file);
    });
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(source, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("No se pudo procesar la foto");
  return { blob, w, h };
}

async function uploadPhoto(planId: string, person: string, file: File): Promise<Photo[]> {
  const { blob, w, h } = await compressImage(file);
  const form = new FormData();
  form.append("planId", planId);
  form.append("person", person);
  form.append("w", String(w));
  form.append("h", String(h));
  form.append("file", blob, "foto.jpg");
  const res = await fetch("/api/photos", { method: "POST", body: form, headers: groupHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) checkSession(res, json);
  if (!res.ok) throw new Error(json.error || "No se pudo subir la foto");
  return json.photos;
}

// Visor a pantalla completa (deslizar con las flechas, borrar).
export function PhotoViewer({ photos, index, onIndex, close, onDelete }: {
  photos: Photo[];
  index: number;
  onIndex: (i: number) => void;
  close: () => void;
  onDelete?: (photo: Photo) => void;
}) {
  const photo = photos[index];
  if (!photo) return null;
  return (
    <div className="photo-viewer" onClick={close}>
      <div className="photo-viewer-top" onClick={(e) => e.stopPropagation()}>
        <span>{index + 1} / {photos.length} · {memberName(photo.by)}</span>
        <button className="icon-button" onClick={close} aria-label="Cerrar"><Icon name="close" /></button>
      </div>
      <img src={photo.url} alt="" onClick={(e) => e.stopPropagation()} />
      <div className="photo-viewer-bottom" onClick={(e) => e.stopPropagation()}>
        <button className="icon-button" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label="Anterior"><Icon name="arrow" /></button>
        {onDelete && <button className="photo-delete" onClick={() => onDelete(photo)}><Icon name="trash" size={16} /> Eliminar</button>}
        <button className="icon-button flip" disabled={index === photos.length - 1} onClick={() => onIndex(index + 1)} aria-label="Siguiente"><Icon name="arrow" /></button>
      </div>
    </div>
  );
}

// Fotos de un plan: cuadricula, subir varias a la vez, ver y borrar.
export function PhotosSection({ planId, person, hint }: { planId: string; person: string; hint?: string }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ photos: Photo[] }>(`/api/photos?planId=${encodeURIComponent(planId)}`)
      .then((j) => setPhotos(j.photos))
      .catch(() => setPhotos([]));
  }, [planId]);

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (files.length === 0) return;
    setError("");
    setProgress({ done: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      try {
        setPhotos(await uploadPhoto(planId, person, files[i]));
      } catch (err: any) {
        setError(err.message);
        break;
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
  }

  async function remove() {
    if (!toDelete) return;
    setBusy(true);
    try {
      const j = await api<{ photos: Photo[] }>("/api/photos", "DELETE", { planId, photoId: toDelete.id, person });
      setPhotos(j.photos);
      setViewing(j.photos.length ? Math.min(viewing ?? 0, j.photos.length - 1) : null);
      setToDelete(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="photos-section">
      <div className="photos-head">
        <strong><Icon name="camera" size={17} /> Fotos</strong>
        {photos && photos.length > 0 && <small>{photos.length}</small>}
      </div>
      {hint && photos?.length === 0 && <p className="photos-hint">{hint}</p>}
      <div className="photo-grid">
        {(photos || []).map((p, i) => (
          <button key={p.id} className="photo-thumb" onClick={() => setViewing(i)} aria-label={`Ver foto ${i + 1}`}>
            <img src={p.url} alt="" loading="lazy" />
          </button>
        ))}
        <label className={`photo-add ${progress ? "busy" : ""}`}>
          <input type="file" accept="image/*" multiple onChange={onFiles} disabled={Boolean(progress)} />
          {progress ? <span>{progress.done}/{progress.total}</span> : <><Icon name="plus" size={20} /><span>Agregar</span></>}
        </label>
      </div>
      {progress && <p className="photos-hint">Subiendo {Math.min(progress.done + 1, progress.total)} de {progress.total}…</p>}
      {error && <p className="form-error" style={{ margin: "8px 0 0" }}>{error}</p>}
      {viewing !== null && photos && (
        <PhotoViewer photos={photos} index={viewing} onIndex={setViewing} close={() => setViewing(null)} onDelete={setToDelete} />
      )}
      {toDelete && (
        <ConfirmDialog
          title="¿Eliminar esta foto?"
          message="Se borra para los dos. No se puede deshacer."
          confirmLabel="Eliminar"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setToDelete(null)}
        />
      )}
    </section>
  );
}
