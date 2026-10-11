"use client";

import { useState } from "react";
import { FOOD_TYPES, PLACE_GROUPS, placeGroupInfo } from "@/config";
import type { Place } from "./types";
import { Button, Icon, Modal } from "./ui";
import { placeEmoji } from "./planUtils";

type Mode = "food" | "places" | "custom";
const FOOD_CHOICES = FOOD_TYPES.filter((f) => f.key !== "otro");

export default function Roulette({ places, initialOptions, close }: { places: Place[]; initialOptions?: string[]; close: () => void }) {
  const [stage, setStage] = useState<"choose" | "options" | "wheel" | "result">(initialOptions ? "wheel" : "choose");
  const [mode, setMode] = useState<Mode | null>(initialOptions ? "custom" : null);
  const [foodOptions, setFoodOptions] = useState<string[]>([]);
  const [customFoods, setCustomFoods] = useState<string[]>([]);
  const [otherFood, setOtherFood] = useState("");
  const [showOtherFood, setShowOtherFood] = useState(false);
  const [placeOptions, setPlaceOptions] = useState<string[]>([]);
  const [showPlaces, setShowPlaces] = useState(false);
  const [placeFilter, setPlaceFilter] = useState("Todos");
  const [showManualPlace, setShowManualPlace] = useState(false);
  const [manualPlace, setManualPlace] = useState("");
  const [customOptions, setCustomOptions] = useState<string[]>(initialOptions || ["", ""]);
  const [winner, setWinner] = useState("");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const modeOptions = mode === "food" ? foodOptions : mode === "places" ? placeOptions : customOptions.filter((o) => o.trim());
  const contextLabel = mode === "food" ? "TIPOS DE COMIDA" : mode === "places" ? "SITIOS" : "PERSONALIZADO";
  const filteredPlaces = places.filter((p) => placeFilter === "Todos" || placeGroupInfo(p.group).label === placeFilter);
  const emojiFor = (option: string) =>
    FOOD_TYPES.find((f) => f.label === option)?.emoji || (places.find((p) => p.name === option) ? placeEmoji(places.find((p) => p.name === option)) : mode === "places" ? "📍" : "✨");

  const choose = (next: Mode) => { setMode(next); setStage("options"); };
  const back = () => {
    if (stage === "choose") close();
    else if (stage === "options") setStage("choose");
    else setStage(initialOptions ? "options" : "options");
  };

  function spin() {
    const picked = modeOptions[Math.floor(Math.random() * modeOptions.length)];
    setSpinning(true);
    setRotation((r) => r + 1440 + Math.floor(Math.random() * 360));
    window.setTimeout(() => {
      setWinner(picked);
      setSpinning(false);
      setStage("result");
    }, 1400);
  }

  return (
    <Modal close={close} full>
      <div className="roulette-screen">
        <div className="sheet-header">
          <button className="icon-button" onClick={back} aria-label="Volver"><Icon name="arrow" /></button>
          <span className="eyebrow">{stage === "choose" ? "RULETA DE DOS" : contextLabel}</span>
          <button className="icon-button roulette-close" onClick={close} aria-label="Cerrar"><Icon name="close" /></button>
        </div>

        {stage === "choose" && (
          <div className="roulette-chooser">
            <span className="step-emoji">🎡</span>
            <h2>¿Qué quieren dejar a la suerte?</h2>
            <p>Elijan qué tipo de decisión quieren resolver juntos.</p>
            <div className="roulette-mode-list">
              <button onClick={() => choose("food")}><span>🍔</span><span><strong>Tipos de comida</strong><small>Elijan entre categorías de comida.</small></span><Icon name="chevron" /></button>
              <button onClick={() => choose("places")}><span>📍</span><span><strong>Sitios</strong><small>Restaurantes y lugares guardados.</small></span><Icon name="chevron" /></button>
              <button onClick={() => choose("custom")}><span>✨</span><span><strong>Personalizado</strong><small>Escriban cualquier opción.</small></span><Icon name="chevron" /></button>
            </div>
          </div>
        )}

        {stage === "options" && mode === "food" && (
          <div className="roulette-options-screen">
            <h2>Tipos de comida</h2>
            <p>Elijan mínimo 2 opciones para la ruleta.</p>
            <div className="food-chips roulette-food-chips">
              {[...FOOD_CHOICES.map((f) => [f.emoji, f.label]), ...customFoods.map((f) => ["✨", f])].map(([emoji, food]) => (
                <button key={food} className={foodOptions.includes(food) ? "food-chip selected" : "food-chip"} onClick={() => setFoodOptions((prev) => (prev.includes(food) ? prev.filter((x) => x !== food) : [...prev, food]))}>
                  {emoji} {food}{foodOptions.includes(food) && <Icon name="check" size={13} />}
                </button>
              ))}
              <button className={showOtherFood ? "food-chip selected" : "food-chip"} onClick={() => setShowOtherFood(!showOtherFood)}>✨ Otro</button>
            </div>
            {showOtherFood && (
              <div className="manual-add-row roulette-manual">
                <input value={otherFood} onChange={(e) => setOtherFood(e.target.value)} placeholder="Otro tipo de comida" />
                <button
                  disabled={!otherFood.trim()}
                  onClick={() => {
                    const food = otherFood.trim();
                    setCustomFoods((prev) => [...new Set([...prev, food])]);
                    setFoodOptions((prev) => [...new Set([...prev, food])]);
                    setOtherFood("");
                    setShowOtherFood(false);
                  }}
                >
                  <Icon name="plus" size={16} />
                </button>
              </div>
            )}
            <Button className="full roulette-continue" disabled={foodOptions.length < 2} onClick={() => setStage("wheel")}>Continuar a la ruleta</Button>
          </div>
        )}

        {stage === "options" && mode === "places" && (
          <div className="roulette-options-screen">
            <h2>Elegir sitios</h2>
            <p>Agreguen mínimo 2 lugares. Nada se selecciona automáticamente.</p>
            {placeOptions.length > 0 && (
              <div className="roulette-selected-places">
                {placeOptions.map((name) => (
                  <span key={name}>{emojiFor(name)} {name}<button onClick={() => setPlaceOptions((prev) => prev.filter((x) => x !== name))}><Icon name="close" size={13} /></button></span>
                ))}
              </div>
            )}
            <button className="sheet-action" onClick={() => setShowPlaces(!showPlaces)}><Icon name="pin" size={17} /> Añadir desde Sitios<Icon name="chevron" size={16} /></button>
            {showPlaces && (
              <>
                <div className="roulette-filters">
                  {["Todos", ...PLACE_GROUPS.map((g) => g.label)].map((f) => <button key={f} className={placeFilter === f ? "active" : ""} onClick={() => setPlaceFilter(f)}>{f}</button>)}
                </div>
                <div className="roulette-place-list">
                  {filteredPlaces.length === 0 && <p className="muted">No hay sitios guardados aquí.</p>}
                  {filteredPlaces.map((p) => (
                    <button key={p.id} className={placeOptions.includes(p.name) ? "selected" : ""} onClick={() => setPlaceOptions((prev) => (prev.includes(p.name) ? prev.filter((x) => x !== p.name) : [...prev, p.name]))}>
                      <i>{placeOptions.includes(p.name) && <Icon name="check" size={13} />}</i>
                      <span>{placeEmoji(p)}</span>
                      <span><strong>{p.name}</strong><small>{[placeGroupInfo(p.group).label, p.area].filter(Boolean).join(" · ")}</small></span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <button className="sheet-action" onClick={() => setShowManualPlace(!showManualPlace)}><Icon name="plus" size={17} /> Agregar manualmente<Icon name="chevron" size={16} /></button>
            {showManualPlace && (
              <div className="manual-add-row roulette-manual">
                <input value={manualPlace} onChange={(e) => setManualPlace(e.target.value)} placeholder="Nombre del sitio" />
                <button disabled={!manualPlace.trim()} onClick={() => { setPlaceOptions((prev) => [...new Set([...prev, manualPlace.trim()])]); setManualPlace(""); setShowManualPlace(false); }}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
            )}
            <Button className="full roulette-continue" disabled={placeOptions.length < 2} onClick={() => setStage("wheel")}>Continuar a la ruleta</Button>
          </div>
        )}

        {stage === "options" && mode === "custom" && (
          <div className="roulette-options-screen">
            <h2>Opciones personalizadas</h2>
            <p>Escriban mínimo 2 opciones para decidir cualquier cosa.</p>
            <div className="option-editor generic-options">
              {customOptions.map((option, i) => (
                <div className="editable-option" key={i}>
                  <span className="drag">⠿</span>
                  <input value={option} onChange={(e) => setCustomOptions((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder={i === 1 ? "Escribe otra opción..." : "Escribe una opción..."} />
                  <button onClick={() => setCustomOptions((prev) => prev.filter((_, idx) => idx !== i))}><Icon name="close" size={16} /></button>
                </div>
              ))}
              <button className="add-option" onClick={() => setCustomOptions((prev) => [...prev, ""])}><Icon name="plus" size={16} /> Agregar otra opción</button>
            </div>
            <Button className="full roulette-continue" disabled={customOptions.filter((o) => o.trim()).length < 2} onClick={() => setStage("wheel")}>Continuar a la ruleta</Button>
          </div>
        )}

        {stage === "wheel" && (
          <>
            <div className="roulette-copy">
              <span className="eyebrow">{contextLabel}</span>
              <h2>Que decida la suerte</h2>
              <p>{modeOptions.length} opciones listas para girar.</p>
            </div>
            <div className="wheel-wrap">
              <div className="wheel-pointer">▼</div>
              <div className="wheel" style={{ transform: `rotate(${rotation}deg)`, transition: "transform 1.35s cubic-bezier(.2,.8,.2,1)" }}>
                {modeOptions.slice(0, 4).map((o, i) => <span key={o} className={`slice-label ${["one", "two", "three", "four"][i]}`}>{o}</span>)}
                <i>♥</i>
              </div>
            </div>
            <div className="roulette-tags">{modeOptions.map((o) => <span key={o}>{emojiFor(o)} {o}</span>)}</div>
            <Button onClick={spin} disabled={spinning || modeOptions.length < 2}><Icon name="sparkles" /> {spinning ? "Girando..." : "Girar ruleta"}</Button>
            <Button variant="ghost" onClick={() => setStage("options")} disabled={spinning}>Editar opciones</Button>
          </>
        )}

        {stage === "result" && (
          <div className="winner">
            <div className="confetti-wide">✦ · ♥ · ✦ · ● · ✦</div>
            <span>🎉 SALIÓ:</span>
            <div className="winner-emoji">{emojiFor(winner)}</div>
            <h2>{winner}</h2>
            <p>La suerte habló. Ustedes deciden si hacerle caso.</p>
            <Button onClick={close}>Listo</Button>
            <Button variant="ghost" onClick={() => setStage("wheel")}>Volver a girar</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
