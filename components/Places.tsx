"use client";

import { useState, type FormEvent } from "react";
import { FOOD_TYPES, PLACE_GROUPS, foodTypeInfo, placeGroupInfo } from "@/config";
import type { Place } from "./types";
import { api } from "./api";
import { Button, ConfirmDialog, Icon, Modal, SheetHeader } from "./ui";
import { placeColor, placeEmoji } from "./planUtils";

const FILTERS = ["Todos", ...PLACE_GROUPS.map((g) => g.label), "Favoritos"];

function visitsText(visits: number) {
  if (visits === 0) return "Aún sin visitar";
  return `Visitado ${visits} ${visits === 1 ? "vez" : "veces"}`;
}

export function Places({ places, onOpen, onAdd }: { places: Place[]; onOpen: (id: string) => void; onAdd: () => void }) {
  const [filter, setFilter] = useState("Todos");
  const visible = places.filter((p) => {
    if (filter === "Todos") return true;
    if (filter === "Favoritos") return p.favorite;
    return placeGroupInfo(p.group).label === filter;
  });
  return (
    <main className="page places-page">
      <span className="eyebrow">GUARDADOS POR LOS DOS</span>
      <div className="title-row">
        <div><h1>Nuestros sitios</h1><p>Lugares que queremos volver a vivir.</p></div>
        <button className="round-button filled" onClick={onAdd} aria-label="Agregar sitio"><Icon name="plus" /></button>
      </div>
      <div className="filter-scroll">
        {FILTERS.map((f) => <button key={f} className={filter === f ? "filter active" : "filter"} onClick={() => setFilter(f)}>{f}</button>)}
      </div>
      <div className="place-list">
        {visible.length === 0 && (
          <p className="places-empty">{places.length === 0 ? "Todavía no guardaron sitios. Toquen + para agregar el primero." : "No hay sitios en este filtro."}</p>
        )}
        {visible.map((p) => (
          <button key={p.id} className="place-card" onClick={() => onOpen(p.id)}>
            <span className={`place-art ${placeColor(p)}`}>{placeEmoji(p)}</span>
            <span className="place-info">
              <span className="place-top"><strong>{p.name}</strong>{p.favorite && <Icon name="heart" size={17} />}</span>
              <span className="meta"><Icon name="pin" size={14} />{p.area || "Sin ubicación"}</span>
              <span className="place-bottom">
                <span>{p.group === "comida" ? foodTypeInfo(p.category).label : placeGroupInfo(p.group).label}</span>
                <span>{visitsText(p.visits)}</span>
              </span>
            </span>
            <Icon name="chevron" size={18} />
          </button>
        ))}
      </div>
    </main>
  );
}

export function PlaceDetail({ place, person, close, onEdit, onChanged, onDeleted }: {
  place: Place;
  person: string;
  close: () => void;
  onEdit: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggleFavorite() {
    try {
      await api("/api/places", "PATCH", { placeId: place.id, person, favorite: !place.favorite });
      onChanged();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api("/api/places", "DELETE", { placeId: place.id, person });
      onDeleted();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
      setConfirm(false);
    }
  }

  const typeLabel = place.group === "comida" ? foodTypeInfo(place.category).label : placeGroupInfo(place.group).label;
  return (
    <Modal close={close} full>
      <div className="place-detail">
        <div className="place-detail-hero">
          <button className="icon-button floating" onClick={close} aria-label="Volver"><Icon name="arrow" /></button>
          <button className="icon-button floating right" onClick={toggleFavorite} aria-label={place.favorite ? "Quitar de favoritos" : "Marcar como favorito"}>
            <Icon name="heart" />
          </button>
          <span>{placeEmoji(place)}</span>
          <div className="hero-shape one" /><div className="hero-shape two" />
        </div>
        <div className="place-detail-body">
          <span className="eyebrow">{typeLabel.toUpperCase()}</span>
          <h1>{place.name}</h1>
          <p className="meta"><Icon name="pin" size={16} /> {place.area || "Sin ubicación"}</p>
          {place.favorite && <div className="rating-line"><span>Favorito de los dos</span></div>}
          <div className="detail-stats two">
            <span><strong>{place.visits}</strong>{place.visits === 1 ? "visita" : "visitas"}</span>
            <span><strong>{place.favorite ? "♥" : "—"}</strong>{place.favorite ? "favorito" : "sin marcar"}</span>
          </div>
          <section><h3>Su nota</h3><p>{place.note ? `“${place.note}”` : "Todavía no tienen una nota para este sitio."}</p></section>
          {error && <p className="form-error">{error}</p>}
          {place.link && (
            <a className="btn btn-primary full" href={place.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <Icon name="map" size={18} /> Abrir link
            </a>
          )}
          <Button variant="secondary" className="full" onClick={onEdit}><Icon name="edit" size={18} /> Editar sitio</Button>
          <button className="destructive-link" onClick={() => setConfirm(true)}>Eliminar sitio</button>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          title={`¿Eliminar ${place.name}?`}
          message="Se borra de sus Sitios. Los planes donde ya votaron no cambian."
          confirmLabel="Eliminar"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirm(false)}
        />
      )}
    </Modal>
  );
}

export function PlaceForm({ place, person, close, onSaved }: { place?: Place; person: string; close: () => void; onSaved: () => void }) {
  const [name, setName] = useState(place?.name || "");
  const [group, setGroup] = useState(place?.group || "comida");
  const [category, setCategory] = useState(place?.category || "hamburguesa");
  const [area, setArea] = useState(place?.area || "");
  const [link, setLink] = useState(place?.link || "");
  const [note, setNote] = useState(place?.note || "");
  const [favorite, setFavorite] = useState(Boolean(place?.favorite));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = { name, group, category, area, link, note, favorite, person };
    try {
      if (place) await api("/api/places", "PATCH", { ...body, placeId: place.id });
      else await api("/api/places", "POST", body);
      onSaved();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal close={close}>
      <SheetHeader eyebrow={place ? "EDITAR SITIO" : "NUEVO FAVORITO"} title={place ? place.name : "Guardar un sitio"} close={close} />
      <form onSubmit={submit}>
        <div className="form-fields">
          <label><span>Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Café bonito" required /></label>
          <label>
            <span>Categoría</span>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {PLACE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.emoji} {g.label}</option>)}
            </select>
          </label>
          {group === "comida" && (
            <label>
              <span>Tipo de comida</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {FOOD_TYPES.map((f) => <option key={f.key} value={f.key}>{f.emoji} {f.label}</option>)}
              </select>
            </label>
          )}
          <label><span>Barrio o ubicación</span><input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ej. Laureles" /></label>
          <label><span>Link opcional</span><input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Maps, menú, Instagram..." /></label>
          <label><span>Una nota para ustedes</span><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="¿Qué quieren recordar?" /></label>
          <label className="check-row"><input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} /><span>Favorito de los dos</span></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" className="full" disabled={busy || !name.trim()}>{busy ? "Guardando..." : "Guardar sitio"}</Button>
      </form>
    </Modal>
  );
}
