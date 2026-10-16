"use client";

import { useState } from "react";
import { PEOPLE, foodTypeInfo } from "@/config";
import type { Place, Plan, Step, StepVotes } from "./types";
import { Avatar, Button, Icon, Modal, SheetHeader } from "./ui";
import { OTHER_PERSON, categoryTitle, dayMonthUpper, optionEmoji, placeEmoji, stepResult, weekdayUpper, stepEmoji } from "./planUtils";

function eyebrowFor(plan: Plan, step: Step) {
  const label = step.kind === "comida-lugar" ? `${categoryTitle(step).toUpperCase()} · RESTAURANTE` : categoryTitle(step).toUpperCase();
  return `${label} · ${weekdayUpper(plan.weekend)} ${dayMonthUpper(plan.weekend).split(" ")[0]}`;
}

export function VoteSheet({ plan, step, votes, person, close, submit, roulette }: {
  plan: Plan;
  step: Step;
  votes: StepVotes;
  person: string;
  close: () => void;
  submit: (optionId: string) => Promise<void>;
  roulette: (options: string[]) => void;
}) {
  const r = stepResult(step, votes, person);
  const other = OTHER_PERSON(person);
  const [choice, setChoice] = useState(r.myVote || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      await submit(choice);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  const partnerText = r.allVoted
    ? { title: "Los dos ya votaron", body: "Puedes cambiar tu voto si quieres." }
    : r.otherVoted
      ? { title: `${other} ya votó`, body: "Su elección se revelará cuando votes." }
      : { title: `${other} aún no vota`, body: "Tu voto queda oculto hasta que vote." };

  return (
    <Modal close={close}>
      <SheetHeader eyebrow={eyebrowFor(plan, step)} title={step.question} close={close} />
      <div className="partner-voted">
        <Avatar person={other} />
        <p><strong>{partnerText.title}</strong>{partnerText.body}</p>
        {r.otherVoted && <Icon name="check" />}
      </div>
      <div className="poll-options">
        {step.options.map((o) => (
          <button key={o.id} className={choice === o.id ? "poll-option selected" : "poll-option"} onClick={() => setChoice(o.id)}>
            <span>{`${optionEmoji(step, o)} ${o.name}`.trim()}</span>
            <i>{choice === o.id && <Icon name="check" size={15} />}</i>
          </button>
        ))}
      </div>
      <p className="privacy-note"><Icon name="heart" size={14} /> No verán el voto del otro hasta que ambos elijan.</p>
      {error && <p className="form-error">{error}</p>}
      <Button className="full" disabled={!choice || busy || choice === r.myVote} onClick={save}>
        {busy ? "Guardando..." : r.myVote ? "Cambiar mi voto" : "Guardar mi voto"}
      </Button>
      <Button variant="ghost" className="full" onClick={() => roulette(step.options.map((o) => o.name))}>
        No nos ponemos de acuerdo · Usar ruleta
      </Button>
    </Modal>
  );
}

export function ResultSheet({ plan, step, votes, places, close, chooseRestaurants, changeVote, roulette }: {
  plan: Plan;
  step: Step;
  votes: StepVotes;
  places: Place[];
  close: () => void;
  chooseRestaurants: () => void;
  changeVote: () => void;
  roulette: (options: string[]) => void;
}) {
  const r = stepResult(step, votes);
  const isFoodType = step.kind === "comida-tipo";
  const label = categoryTitle(step).toUpperCase();

  if (r.tie) {
    return (
      <Modal close={close}>
        <SheetHeader eyebrow={`${label} · VOTACIÓN TERMINADA`} title="Quedaron empatados" close={close} />
        <div className="match-result">
          <div className="confetti">✦ <span>♥</span> ✦</div>
          <h3>Empate</h3>
          <p>Cada uno eligió algo distinto.</p>
          <div className="both-votes">
            {PEOPLE.map((p) => {
              const o = step.options.find((opt) => opt.id === votes[p]);
              return <span key={p}><Avatar person={p} small /> {`${optionEmoji(step, o)} ${o?.name || ""}`.trim()}</span>;
            })}
          </div>
        </div>
        {isFoodType && (
          <>
            <div className="next-step"><div className="number">2</div><div><strong>También pueden seguir así</strong><p>Pongan restaurantes de los dos tipos en la votación.</p></div></div>
            <Button className="full" onClick={chooseRestaurants}><Icon name="pin" size={18} /> Elegir restaurantes</Button>
          </>
        )}
        <Button variant={isFoodType ? "secondary" : "primary"} className="full" onClick={() => roulette(r.winners.map((o) => o.name))}>
          <Icon name="roulette" size={18} /> Desempatar con ruleta
        </Button>
        <Button variant="ghost" className="full" onClick={changeVote}>Cambiar mi voto</Button>
      </Modal>
    );
  }

  const winner = r.winners[0];
  const typeKey = winner?.id;
  const savedForType = isFoodType ? places.filter((p) => p.group === "comida" && p.category === typeKey).length : 0;
  const place = winner?.placeId ? places.find((p) => p.id === winner.placeId) : undefined;
  const emoji = place ? placeEmoji(place) : optionEmoji(step, winner) || stepEmoji(step);

  return (
    <Modal close={close}>
      <SheetHeader eyebrow={`${label} DECIDIDA`} title="¡Tenemos un match!" close={close} />
      <div className="match-result">
        <div className="confetti">✦ <span>♥</span> ✦</div>
        <span className="result-emoji">{emoji}</span>
        <h3>{winner?.name}</h3>
        <p>Los dos eligieron lo mismo.</p>
        <div className="both-votes">{PEOPLE.map((p) => <span key={p}><Avatar person={p} small /> {p}</span>)}</div>
      </div>
      {isFoodType ? (
        <>
          <div className="next-step">
            <div className="number">2</div>
            <div>
              <strong>Ahora elijan dónde comer</strong>
              <p>{savedForType > 0
                ? `Tienen ${savedForType} ${savedForType === 1 ? "sitio guardado" : "sitios guardados"} de ${foodTypeInfo(typeKey).label.toLowerCase()}.`
                : "Pueden elegir de sus Sitios o escribir restaurantes nuevos."}</p>
            </div>
          </div>
          <Button className="full" onClick={chooseRestaurants}><Icon name="pin" size={18} /> Elegir restaurantes</Button>
          <Button variant="ghost" className="full" onClick={close}>Ahora no</Button>
        </>
      ) : (
        <Button className="full" onClick={close}>Listo</Button>
      )}
    </Modal>
  );
}

type Pick = { name: string; link?: string; placeId?: string; save?: boolean };

export function FoodRestaurantSetup({ plan, typeStep, decidedTypes, places, existing, close, submit }: {
  plan: Plan;
  typeStep: Step;
  decidedTypes: string[]; // claves (o "custom:...") de los tipos que ganaron
  places: Place[];
  existing: Pick[]; // restaurantes ya elegidos (si estan cambiando la lista)
  close: () => void;
  submit: (restaurants: Pick[]) => Promise<void>;
}) {
  const foodPlaces = places.filter((p) => p.group === "comida");
  const recommended = foodPlaces.filter((p) => decidedTypes.includes(p.category));
  const [showAll, setShowAll] = useState(recommended.length === 0);
  const [manual, setManual] = useState<Pick[]>(existing.filter((e) => !e.placeId));
  const [selected, setSelected] = useState<string[]>(existing.map((e) => e.placeId || e.name));
  const [showManual, setShowManual] = useState(false);
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [save, setSave] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const shown = showAll ? foodPlaces : recommended;
  const typeLabel = typeStep.options.filter((o) => decidedTypes.includes(o.id)).map((o) => o.name).join(" o ");
  const toggle = (key: string) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  function addManual() {
    const clean = name.trim();
    if (!clean) return;
    setManual((prev) => [...prev.filter((m) => m.name !== clean), { name: clean, link: link.trim(), save }]);
    setSelected((prev) => [...new Set([...prev, clean])]);
    setName("");
    setLink("");
    setShowManual(false);
  }

  async function create() {
    const picks: Pick[] = [
      ...foodPlaces.filter((p) => selected.includes(p.id)).map((p) => ({ name: p.name, link: p.link, placeId: p.id })),
      ...manual.filter((m) => selected.includes(m.name)),
    ];
    setBusy(true);
    setError("");
    try {
      await submit(picks);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal close={close}>
      <SheetHeader eyebrow="COMIDA · SEGUNDO PASO" title="¿Dónde comemos? 🍽️" subtitle="Elijan los restaurantes que quieren poner a votación." close={close} />
      <div className="restaurant-suggestions">
        <span className="section-label">{showAll ? "TODOS SUS SITIOS DE COMIDA" : `RECOMENDADOS PARA ${typeLabel.toUpperCase()}`}</span>
        {shown.length === 0 && manual.length === 0 && (
          <p className="muted">No tienen sitios guardados {showAll ? "de comida" : "de este tipo"}. Agreguen uno abajo.</p>
        )}
        {shown.map((p) => (
          <button key={p.id} className={selected.includes(p.id) ? "restaurant-choice selected" : "restaurant-choice"} onClick={() => toggle(p.id)}>
            <i>{selected.includes(p.id) && <Icon name="check" size={14} />}</i>
            <span>{placeEmoji(p)}</span>
            <span><strong>{p.name}</strong><small>{[foodTypeInfo(p.category).label, p.area, p.favorite ? "Favorito" : ""].filter(Boolean).join(" · ")}</small></span>
          </button>
        ))}
        {manual.map((m) => (
          <button key={m.name} className={selected.includes(m.name) ? "restaurant-choice selected" : "restaurant-choice"} onClick={() => toggle(m.name)}>
            <i>{selected.includes(m.name) && <Icon name="check" size={14} />}</i>
            <span>🍴</span>
            <span><strong>{m.name}</strong><small>{m.save ? "Se guardará en Sitios" : "Agregado manualmente"}</small></span>
          </button>
        ))}
      </div>
      {(recommended.length > 0 || showAll) && (
        <button className="sheet-action" onClick={() => setShowAll(!showAll)}>
          <Icon name="pin" size={17} /> {showAll ? "Ver solo los recomendados" : "Añadir desde todos sus Sitios"}<Icon name="chevron" size={16} />
        </button>
      )}
      <button className="sheet-action" onClick={() => setShowManual(!showManual)}><Icon name="plus" size={17} /> Agregar otro restaurante<Icon name="chevron" size={16} /></button>
      {showManual && (
        <div className="manual-place-form sheet-manual-form">
          <label><span>Nombre del sitio *</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Burger House" /></label>
          <label><span>Link opcional</span><input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Maps, menú, Instagram, reserva..." /></label>
          <label className="save-place-check">
            <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
            <i>{save && <Icon name="check" size={13} />}</i>
            <span>Guardar también en Sitios</span>
          </label>
          <Button variant="secondary" disabled={!name.trim()} onClick={addManual}>Agregar restaurante</Button>
        </div>
      )}
      {error && <p className="form-error" style={{ marginTop: 10 }}>{error}</p>}
      <div className="sheet-selection-footer">
        <span>{selected.length} seleccionados</span>
        <Button disabled={selected.length < 2 || busy} onClick={create}>{busy ? "Creando..." : "Crear votación"}</Button>
      </div>
    </Modal>
  );
}
