"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FOOD_TYPES } from "@/config";

const STORAGE_KEY = "miamor_person";

export default function Lugares() {
  const [person, setPerson] = useState(null);
  const [places, setPlaces] = useState(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(FOOD_TYPES[0].key);
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPerson(saved);
    } catch (e) {
      // se ignora
    }
    loadPlaces();
  }, []);

  function loadPlaces() {
    fetch("/api/places")
      .then((r) => r.json())
      .then((d) => setPlaces(d.places))
      .catch(() => setError("No se pudieron cargar los sitios."));
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setCategory(FOOD_TYPES[0].key);
    setLink("");
  }

  function startEdit(place) {
    setEditingId(place.id);
    setName(place.name);
    setCategory(place.category);
    setLink(place.link || "");
  }

  async function submit(e) {
    e.preventDefault();
    if (!person) return;
    setError("");
    setSaving(true);
    try {
      const isEditing = Boolean(editingId);
      const res = await fetch("/api/places", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEditing
            ? { placeId: editingId, name, category, link, person }
            : { name, category, link, person }
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al guardar el sitio");
        return;
      }
      resetForm();
      loadPlaces();
    } catch (e) {
      setError("Error al guardar el sitio");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlace(placeId) {
    if (!person) return;
    if (!window.confirm("¿Eliminar este sitio del catálogo?")) return;
    setError("");
    setDeletingId(placeId);
    try {
      const res = await fetch("/api/places", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, person }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al eliminar");
        return;
      }
      if (editingId === placeId) resetForm();
      loadPlaces();
    } catch (e) {
      setError("Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="wrap">
      <header className="topbar">
        <Link href="/">← Volver</Link>
      </header>
      <h1>Sitios de comida 📍</h1>
      <p className="subtitle">
        Guarda aquí los restaurantes o sitios que les gustan, por tipo de comida. Cuando los dos
        elijan el mismo tipo (o tipos distintos) en una encuesta de comida, podrán escoger entre
        estos sitios.
      </p>

      {error && <p className="error">{error}</p>}

      {person && (
        <section className="create-section">
          <h2>{editingId ? "Editar sitio" : "Agregar sitio"}</h2>
          <form onSubmit={submit}>
            <label>
              Nombre
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Papas Quemadas"
                required
              />
            </label>
            <label>
              Tipo de comida
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {FOOD_TYPES.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.emoji} {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Link (opcional)
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Menú, Google Maps..."
              />
            </label>
            <button type="submit" className="big-btn" disabled={saving}>
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Agregar sitio"}
            </button>
            {editingId && (
              <button type="button" className="link-btn" onClick={resetForm}>
                Cancelar edición
              </button>
            )}
          </form>
        </section>
      )}

      {!places ? (
        <p>Cargando...</p>
      ) : places.length === 0 ? (
        <div className="empty-card" style={{ marginTop: 16 }}>
          Todavía no hay sitios guardados.
        </div>
      ) : (
        FOOD_TYPES.map((f) => {
          const group = places.filter((p) => p.category === f.key);
          if (group.length === 0) return null;
          return (
            <section key={f.key} className="places-group">
              <h2>
                {f.emoji} {f.label}
              </h2>
              <ul className="places-list">
                {group.map((place) => (
                  <li key={place.id} className="place-item">
                    <span className="place-name">
                      {place.name}
                      {place.link && (
                        <a
                          href={place.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="option-link"
                        >
                          🔗 Ver
                        </a>
                      )}
                    </span>
                    {person && (
                      <span className="poll-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => startEdit(place)}
                          aria-label="Editar sitio"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => deletePlace(place.id)}
                          disabled={deletingId === place.id}
                          aria-label="Eliminar sitio"
                        >
                          🗑️
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}
