"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, FOOD_TYPES, MEALS, PEOPLE, categoryInfo, foodTypeInfo, mealInfo } from "@/config";
import type { Place, Plan, Step } from "./types";
import { api } from "./api";
import { Avatar, Button, Icon, Pill } from "./ui";
import { addDays, dayMonthUpper, longDate, parseDate, placeEmoji, rootSteps, shortDayUpper, toDateStr, todayStr, upcomingSaturday, weekdayUpper } from "./planUtils";
import { holidayOn, holidaysBetween } from "./holidays";

type Mode = "create" | "edit" | "add";
type Restaurant = { name: string; link?: string; placeId?: string; save?: boolean };
type GenericOption = { name: string; link: string };

// Estado del asistente armado a partir de un plan existente (para editarlo o
// para "repetir" un plan del historial).
function draftFromPlan(plan: Plan) {
  const categories: string[] = [];
  const stepIdByKey: Record<string, string> = {};
  const options: Record<string, GenericOption[]> = {};
  let foodSeparate = true;
  let foodSelections: string[] = [];
  let restaurants: Restaurant[] = [];
  let otherName = "";
  let meal = "";
  const extraSteps: Step[] = []; // categorias repetidas que el asistente no sabe mostrar

  for (const step of rootSteps(plan)) {
    if (categories.includes(step.category)) {
      extraSteps.push(step);
      continue;
    }
    categories.push(step.category);
    stepIdByKey[step.category] = step.id;
    if (step.category === "comida") {
      meal = step.meal || "";
      foodSeparate = step.kind === "comida-tipo";
      if (foodSeparate) foodSelections = step.options.map((o) => (o.id.startsWith("custom:") ? o.name : o.id));
      else restaurants = step.options.map((o) => ({ name: o.name, link: o.link, placeId: o.placeId }));
    } else {
      options[step.category] = step.options.map((o) => ({ name: o.name, link: o.link || "" }));
      if (step.category === "otro") otherName = step.question;
    }
  }
  return { categories, stepIdByKey, options, foodSeparate, foodSelections, restaurants, otherName, meal, extraSteps };
}

// Un paso existente tal cual, en el formato que espera /api/plan.
function stepToPayload(step: Step) {
  if (step.kind === "comida-tipo") {
    return {
      id: step.id,
      category: step.category,
      question: step.question,
      twoPhase: true,
      ...(step.meal ? { meal: step.meal } : {}),
      ...(step.generatedStepId ? { generatedStepId: step.generatedStepId } : {}),
      selectedTypes: step.options.map((o) => (o.id.startsWith("custom:") ? o.name : o.id)),
    };
  }
  return {
    id: step.id,
    category: step.category,
    question: step.question,
    ...(step.kind ? { kind: step.kind } : {}),
    ...(step.generatedFrom ? { generatedFrom: step.generatedFrom } : {}),
    ...(step.meal ? { meal: step.meal } : {}),
    options: step.options.map((o) => ({ name: o.name, link: o.link, placeId: o.placeId })),
  };
}

const FOOD_CHOICES = FOOD_TYPES.filter((f) => f.key !== "otro");

export default function CreateFlow({ mode, person, plan, repeatFrom, presetDate, activePlans, places, close, save }: {
  mode: Mode;
  person: string;
  plan?: Plan; // edit / add
  repeatFrom?: Plan; // "repetir" un plan del historial
  presetDate?: string; // desde el calendario
  activePlans: Plan[];
  places: Place[];
  close: () => void;
  save: (args: { targetPlan?: Plan; weekend: string; steps: any[]; labels: string[] }) => Promise<void>; // labels: "🌙 Cena", "🎯 Actividad"...
}) {
  const base = useMemo(() => {
    if (mode === "edit" && plan) return draftFromPlan(plan);
    if (repeatFrom) return { ...draftFromPlan(repeatFrom), stepIdByKey: {}, extraSteps: [] as Step[] };
    return null;
  }, [mode, plan, repeatFrom]);

  const labels = mode === "add" ? ["Categorías", "Opciones", "Revisar"] : ["Cuándo", "Categorías", "Opciones", "Revisar"];
  const [stepIndex, setStepIndex] = useState(0);
  const current = labels[stepIndex];

  const saturday = upcomingSaturday();
  const [date, setDate] = useState(plan?.weekend || presetDate || saturday);
  const [datePicker, setDatePicker] = useState(false);
  const pickerStart = parseDate(date);
  const [monthIndex, setMonthIndex] = useState(pickerStart.getFullYear() * 12 + pickerStart.getMonth());

  const existingCategories = mode === "add" && plan ? rootSteps(plan).map((s) => s.category) : [];
  const [categories, setCategories] = useState<string[]>(base?.categories || (mode === "add" ? [] : ["comida", "actividad"]));
  const [editingCategory, setEditingCategory] = useState(categories[0] || "comida");
  const [foodSeparate, setFoodSeparate] = useState(base?.foodSeparate ?? true);
  const [foodSelections, setFoodSelections] = useState<string[]>(base?.foodSelections || []);
  const [customFoods, setCustomFoods] = useState<string[]>(
    (base?.foodSelections || []).filter((f) => !FOOD_TYPES.some((t) => t.key === f))
  );
  const [customFoodActive, setCustomFoodActive] = useState(false);
  const [customFood, setCustomFood] = useState("");
  const [restaurants, setRestaurants] = useState<Restaurant[]>(base?.restaurants || []);
  const [options, setOptions] = useState<Record<string, GenericOption[]>>(base?.options || {});
  const [openLinks, setOpenLinks] = useState<string[]>([]);
  const [otherName, setOtherName] = useState(base?.otherName || "");
  const [meal, setMeal] = useState(base?.meal || "");
  const [sitePicker, setSitePicker] = useState(false);
  const [pickedSites, setPickedSites] = useState<string[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualLink, setManualLink] = useState("");
  const [manualSave, setManualSave] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const today = toDateStr(new Date());
  const activeCategory = categories.includes(editingCategory) ? editingCategory : categories[0];
  const planForDate = mode === "create" ? activePlans.find((p) => p.weekend === date) : undefined;
  const removedCategories = mode === "edit" && base ? base.categories.filter((c) => !categories.includes(c)) : [];
  const foodPlaces = places.filter((p) => p.group === "comida");

  const optionsFor = (key: string): GenericOption[] => options[key] || [{ name: "", link: "" }, { name: "", link: "" }];
  const validCount = (key: string) => {
    if (key === "comida") return foodSeparate ? foodSelections.length : restaurants.length;
    return optionsFor(key).filter((o) => o.name.trim()).length;
  };
  const allValid = categories.every((c) => validCount(c) >= 2);

  const toggleCategory = (key: string) =>
    setCategories((prev) => {
      if (prev.includes(key)) return prev.filter((c) => c !== key);
      setEditingCategory(key);
      return [...prev, key];
    });
  const setOptionList = (key: string, list: GenericOption[]) => setOptions((prev) => ({ ...prev, [key]: list }));
  const toggleFood = (food: string) => setFoodSelections((prev) => (prev.includes(food) ? prev.filter((f) => f !== food) : [...prev, food]));

  // Calendario del selector de fecha.
  const monthDate = new Date(Math.floor(monthIndex / 12), monthIndex % 12, 1);
  const monthName = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" }).format(monthDate);
  const firstWeekday = (monthDate.getDay() + 6) % 7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const pickerDays = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const currentMonthIndex = new Date().getFullYear() * 12 + new Date().getMonth();

  // Sabado y domingo siempre; "Festivo" solo si de verdad hay uno (Colombia)
  // entre hoy y el lunes despues del sabado.
  const sunday = addDays(saturday, 1);
  const withHoliday = (date: string, text: string) => (holidayOn(date) ? `${text} · ${holidayOn(date)!.name}` : text);
  const quickDays = [
    { date: saturday, tag: "SÁB", title: `Sábado ${parseDate(saturday).getDate()}`, sub: withHoliday(saturday, "Este sábado") },
    { date: sunday, tag: "DOM", title: `Domingo ${parseDate(sunday).getDate()}`, sub: withHoliday(sunday, "Este domingo") },
    ...holidaysBetween(todayStr(), addDays(saturday, 2))
      .filter((h) => h.date !== saturday && h.date !== sunday)
      .map((h) => ({ date: h.date, tag: weekdayUpper(h.date).slice(0, 3), title: "Festivo ✨", sub: `${longDate(h.date)} · ${h.name}` })),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));
  const isQuick = quickDays.some((d) => d.date === date);

  function questionFor(key: string) {
    if (key === "comida") {
      const m = mealInfo(meal);
      if (m) return foodSeparate ? m.what : m.where;
      return foodSeparate ? "¿Qué comemos?" : "¿Dónde comemos?";
    }
    if (key === "otro") return otherName.trim() || "¿Qué más?";
    return categoryInfo(key).question;
  }

  function addSites() {
    const chosen = foodPlaces.filter((p) => pickedSites.includes(p.id));
    setRestaurants((prev) => [...prev, ...chosen.filter((p) => !prev.some((r) => r.placeId === p.id)).map((p) => ({ name: p.name, link: p.link, placeId: p.id }))]);
    setPickedSites([]);
    setSitePicker(false);
  }

  function addManualRestaurant() {
    const name = manualName.trim();
    if (!name) return;
    setRestaurants((prev) => [...prev.filter((r) => r.name !== name), { name, link: manualLink.trim(), save: manualSave }]);
    setManualName("");
    setManualLink("");
    setShowManual(false);
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      // Los restaurantes escritos a mano con "Guardar en Sitios" se crean primero.
      let finalRestaurants = restaurants;
      if (categories.includes("comida") && !foodSeparate) {
        finalRestaurants = [];
        for (const r of restaurants) {
          if (!r.placeId && r.save) {
            const json = await api<{ place: Place }>("/api/places", "POST", { name: r.name, link: r.link, group: "comida", person });
            finalRestaurants.push({ ...r, placeId: json.place.id });
          } else finalRestaurants.push(r);
        }
      }

      const ids = base?.stepIdByKey || {};
      const originalFood = mode === "edit" && plan ? plan.steps.find((s) => s.id === ids.comida) : undefined;
      const sameFoodMode = originalFood && (originalFood.kind === "comida-tipo") === foodSeparate;

      const newSteps = categories.map((key) => {
        const keepId = key === "comida" ? (sameFoodMode ? ids.comida : undefined) : ids[key];
        const idPart = keepId ? { id: keepId } : {};
        if (key === "comida" && foodSeparate) {
          return {
            ...idPart,
            category: "comida",
            question: questionFor("comida"),
            ...(meal ? { meal } : {}),
            twoPhase: true,
            ...(sameFoodMode && originalFood?.generatedStepId ? { generatedStepId: originalFood.generatedStepId } : {}),
            selectedTypes: foodSelections,
          };
        }
        if (key === "comida") {
          return { ...idPart, category: "comida", question: questionFor("comida"), ...(meal ? { meal } : {}), options: finalRestaurants.map((r) => ({ name: r.name, link: r.link, placeId: r.placeId })) };
        }
        return { ...idPart, category: key, question: questionFor(key), options: optionsFor(key).filter((o) => o.name.trim()) };
      });

      let targetPlan: Plan | undefined;
      let steps: any[];
      if (mode === "edit" && plan) {
        targetPlan = plan;
        // Se conservan el paso de restaurante ya creado (si la comida sigue en
        // 2 pasos) y las categorias repetidas que el asistente no muestra.
        const keptGen = sameFoodMode && originalFood?.generatedStepId && categories.includes("comida") && foodSeparate
          ? plan.steps.filter((s) => s.id === originalFood.generatedStepId)
          : [];
        const genPayload = keptGen.map((s) => {
          const { meal: _old, ...rest } = stepToPayload(s) as any;
          return { ...rest, ...(meal ? { meal } : {}), question: mealInfo(meal)?.where || "¿Dónde comemos?" };
        });
        steps = [...newSteps, ...genPayload, ...(base?.extraSteps || []).map(stepToPayload)];
      } else {
        targetPlan = mode === "add" ? plan : planForDate;
        steps = [...(targetPlan ? targetPlan.steps.map(stepToPayload) : []), ...newSteps];
      }

      const labels = categories.map((c) =>
        c === "comida" && mealInfo(meal) ? `${mealInfo(meal).emoji} ${mealInfo(meal).label}` : `${categoryInfo(c).emoji} ${c === "otro" ? questionFor("otro") : categoryInfo(c).label}`
      );
      await save({ targetPlan, weekend: date, steps, labels });
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  const title = mode === "edit" ? "Editar el plan" : mode === "add" ? "Agregar categorías" : "Crear un plan";
  const lastStep = stepIndex === labels.length - 1;
  const canContinue =
    (current === "Categorías" && categories.length > 0) || (current === "Opciones" && allValid) || current === "Cuándo" || current === "Revisar";

  return (
    <div className="flow-screen">
      <header className="flow-header">
        <button className="icon-button" onClick={datePicker ? () => setDatePicker(false) : stepIndex === 0 ? close : () => setStepIndex(stepIndex - 1)}>
          <Icon name={datePicker || stepIndex > 0 ? "arrow" : "close"} />
        </button>
        <div><span>PASO {stepIndex + 1} DE {labels.length}</span><strong>{datePicker ? "Elegir fecha" : title}</strong></div>
        <button className="text-button" onClick={close}>Salir</button>
      </header>
      {!datePicker && (
        <div className="stepper" style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}>
          {labels.map((label, i) => <div key={label} className={i <= stepIndex ? "complete" : ""}><i /><span>{label}</span></div>)}
        </div>
      )}
      <main className="flow-content">
        {datePicker && (
          <section className="flow-step date-picker-step">
            <span className="step-emoji">📅</span>
            <h1>Elijan una fecha</h1>
            <p>Pueden navegar y seleccionar cualquier fecha futura.</p>
            <div className="create-calendar">
              <div className="create-calendar-header">
                <button disabled={monthIndex <= currentMonthIndex} onClick={() => setMonthIndex(monthIndex - 1)} aria-label="Mes anterior">‹</button>
                <strong>{monthName}</strong>
                <button onClick={() => setMonthIndex(monthIndex + 1)} aria-label="Mes siguiente">›</button>
              </div>
              <div className="weekdays">{["L", "M", "X", "J", "V", "S", "D"].map((d) => <span key={d}>{d}</span>)}</div>
              <div className="calendar-grid">
                {pickerDays.map((n, i) => {
                  if (!n) return <span key={`blank-${i}`} />;
                  const str = toDateStr(new Date(monthDate.getFullYear(), monthDate.getMonth(), n));
                  const past = str < today;
                  return (
                    <button key={n} disabled={past} className={`calendar-day ${past ? "past" : ""} ${str === date ? "selected" : ""}`} onClick={() => { setDate(str); setDatePicker(false); }}>
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {!datePicker && current === "Cuándo" && (
          <section className="flow-step">
            <span className="step-emoji">📅</span>
            <h1>¿Cuándo?</h1>
            <p>Elijan el día. Los detalles pueden venir después.</p>
            <div className="day-options">
              {quickDays.map((d) => (
                <button key={d.date} onClick={() => setDate(d.date)} className={date === d.date ? "day-option selected" : "day-option"}>
                  <span><b>{d.tag}</b><strong>{parseDate(d.date).getDate()}</strong></span>
                  <div><strong>{d.title}</strong><small>{d.sub}</small></div>
                  {date === d.date && <i><Icon name="check" size={15} /></i>}
                </button>
              ))}
              <button onClick={() => setDatePicker(true)} className={!isQuick ? "day-option selected" : "day-option"}>
                <span><b>···</b></span>
                <div><strong>{!isQuick ? longDate(date) : "Otra fecha"}</strong><small>Elegir en calendario</small></div>
                {!isQuick && <i><Icon name="check" size={15} /></i>}
              </button>
            </div>
            {planForDate && <p className="date-warning">Ya tienen un plan para ese día: lo que elijan ahora se agrega a ese plan.</p>}
          </section>
        )}

        {!datePicker && current === "Categorías" && (
          <section className="flow-step">
            <span className="step-emoji">✨</span>
            <h1>¿Qué quieren decidir?</h1>
            <p>{mode === "add" ? "Elijan las categorías que quieren sumar a este día." : "Elijan una o varias categorías. Solo aparecerán las que agreguen."}</p>
            <div className="category-grid">
              {CATEGORIES.filter((c) => !existingCategories.includes(c.key)).map((c) => (
                <button key={c.key} onClick={() => toggleCategory(c.key)} className={categories.includes(c.key) ? "category-option selected" : "category-option"}>
                  <span>{c.emoji}</span><strong>{c.label}</strong>
                  {categories.includes(c.key) && <i><Icon name="check" size={13} /></i>}
                </button>
              ))}
            </div>
            {categories.includes("comida") && (
              <div className="meal-picker">
                <span>¿Para qué comida? <small>(opcional)</small></span>
                <div className="food-chips">
                  {MEALS.map((m) => (
                    <button key={m.key} type="button" className={meal === m.key ? "food-chip selected" : "food-chip"} onClick={() => setMeal(meal === m.key ? "" : m.key)} aria-pressed={meal === m.key}>
                      {m.emoji} {m.label}{meal === m.key && <Icon name="check" size={13} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {categories.includes("comida") && (
              <label className={`switch-row category-setting ${foodSeparate ? "on" : "off"}`}>
                <span><strong>Elegir restaurante después</strong><small>Primero decidimos qué comer y después dónde.</small></span>
                <input type="checkbox" checked={foodSeparate} onChange={(e) => setFoodSeparate(e.target.checked)} />
                <i />
              </label>
            )}
            {removedCategories.length > 0 && (
              <p className="date-warning">Quitar {removedCategories.map((c) => categoryInfo(c).label).join(", ")} borra sus votos.</p>
            )}
            <div className="selection-note">
              <span className="mini-pair">{PEOPLE.map((p) => <Avatar key={p} person={p} small />)}</span>
              <p><strong>{categories.length || "Ninguna"} {categories.length === 1 ? "decisión seleccionada" : "decisiones seleccionadas"}</strong>El finde se adapta a ustedes, no al revés.</p>
            </div>
          </section>
        )}

        {!datePicker && current === "Opciones" && activeCategory && (
          <section className="flow-step options-step">
            <div className="category-tabs">
              {categories.map((c) => (
                <button key={c} onClick={() => setEditingCategory(c)} className={activeCategory === c ? "active" : ""}>
                  {categoryInfo(c).emoji} {categoryInfo(c).label}
                </button>
              ))}
            </div>
            <span className="step-emoji">{categoryInfo(activeCategory).emoji}</span>
            {activeCategory === "otro" && (
              <label className="custom-category-name">
                <span>Nombre de la categoría</span>
                <input value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Ej. Plan sorpresa" />
              </label>
            )}
            <h1>{questionFor(activeCategory)}</h1>
            <p>
              {activeCategory === "comida"
                ? foodSeparate ? "Elige mínimo 2 opciones para votar." : "Elige mínimo 2 restaurantes para la votación."
                : categoryInfo(activeCategory).description}
            </p>

            {activeCategory === "comida" && (
              <div className="food-mode-note">
                <Icon name={foodSeparate ? "check" : "pin"} size={17} />
                <span>
                  <strong>{foodSeparate ? "Primero tipo de comida" : "Votación directa de restaurantes"}</strong>
                  {foodSeparate ? "Después elegirán el restaurante." : "Usen sus Sitios o agreguen uno nuevo."}
                </span>
              </div>
            )}

            {activeCategory === "comida" && foodSeparate && (
              <div className="food-chip-area">
                <div className="food-chips">
                  {[...FOOD_CHOICES.map((f) => [f.emoji, f.key, f.label]), ...customFoods.map((f) => ["✨", f, f])].map(([emoji, key, label]) => (
                    <button key={key} className={foodSelections.includes(key) ? "food-chip selected" : "food-chip"} onClick={() => toggleFood(key)}>
                      {emoji} {label}{foodSelections.includes(key) && <Icon name="check" size={13} />}
                    </button>
                  ))}
                  <button className={customFoodActive ? "food-chip selected" : "food-chip"} onClick={() => setCustomFoodActive(!customFoodActive)}>✨ Otro</button>
                </div>
                {customFoodActive && (
                  <label className="custom-food-input">
                    <span>Escribe otro tipo de comida</span>
                    <div>
                      <input value={customFood} onChange={(e) => setCustomFood(e.target.value)} placeholder="Ej. Tailandesa" />
                      <button
                        disabled={!customFood.trim()}
                        onClick={() => {
                          const food = customFood.trim();
                          setCustomFoods((prev) => [...new Set([...prev, food])]);
                          setFoodSelections((prev) => [...new Set([...prev, food])]);
                          setCustomFood("");
                          setCustomFoodActive(false);
                        }}
                      >
                        <Icon name="plus" size={17} /> Agregar
                      </button>
                    </div>
                  </label>
                )}
                <span className={`selection-count ${foodSelections.length >= 2 ? "ready" : ""}`}>
                  {foodSelections.length >= 2 ? <><Icon name="check" size={14} /> Listo para continuar</> : `${foodSelections.length} de 2 seleccionadas`}
                </span>
              </div>
            )}

            {activeCategory === "comida" && !foodSeparate && (
              <div className="direct-restaurant-area">
                {restaurants.length > 0 && (
                  <div className="selected-restaurant-options">
                    {restaurants.map((r) => {
                      const place = r.placeId ? places.find((p) => p.id === r.placeId) : undefined;
                      return (
                        <div key={r.placeId || r.name}>
                          <span>{placeEmoji(place)}</span>
                          <span><strong>{r.name}</strong><small>{place?.area || (r.save ? "Se guardará en Sitios" : "Agregado manualmente")}</small></span>
                          <button onClick={() => setRestaurants((prev) => prev.filter((x) => x !== r))}><Icon name="close" size={16} /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <button className="add-option sites-option" onClick={() => setSitePicker(true)}><Icon name="pin" size={17} /> Añadir desde Sitios</button>
                <button className="add-option" onClick={() => setShowManual(!showManual)}><Icon name="plus" size={17} /> Agregar otro restaurante</button>
                {showManual && (
                  <div className="manual-place-form">
                    <label><span>Nombre del sitio *</span><input type="text" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Ej. Burger House" /></label>
                    <label><span>Link opcional</span><input type="url" value={manualLink} onChange={(e) => setManualLink(e.target.value)} placeholder="Maps, menú, Instagram, reserva..." /></label>
                    <label className="save-place-check">
                      <input type="checkbox" checked={manualSave} onChange={(e) => setManualSave(e.target.checked)} />
                      <i>{manualSave && <Icon name="check" size={13} />}</i>
                      <span>Guardar también en Sitios</span>
                    </label>
                    <Button variant="secondary" disabled={!manualName.trim()} onClick={addManualRestaurant}>Agregar restaurante</Button>
                  </div>
                )}
                <span className={`selection-count ${restaurants.length >= 2 ? "ready" : ""}`}>
                  {restaurants.length >= 2 ? <><Icon name="check" size={14} /> {restaurants.length} restaurantes seleccionados</> : `${restaurants.length} de 2 seleccionados`}
                </span>
              </div>
            )}

            {activeCategory !== "comida" && (
              <div className="option-editor generic-options">
                {optionsFor(activeCategory).map((option, i) => {
                  const list = optionsFor(activeCategory);
                  const linkKey = `${activeCategory}-${i}`;
                  return (
                    <div className="generic-option-card" key={linkKey}>
                      <div className="editable-option">
                        <span className="drag">⠿</span>
                        <input
                          value={option.name}
                          placeholder={i === 1 ? "Escribe otra opción..." : "Escribe una opción..."}
                          onChange={(e) => setOptionList(activeCategory, list.map((o, idx) => (idx === i ? { ...o, name: e.target.value } : o)))}
                        />
                        <button onClick={() => setOptionList(activeCategory, list.filter((_, idx) => idx !== i))}><Icon name="close" size={17} /></button>
                      </div>
                      {openLinks.includes(linkKey) || option.link ? (
                        <label className="option-link-field">
                          <Icon name="map" size={15} />
                          <input type="url" value={option.link} onChange={(e) => setOptionList(activeCategory, list.map((o, idx) => (idx === i ? { ...o, link: e.target.value } : o)))} placeholder="Pega un link opcional" />
                        </label>
                      ) : (
                        <button className="add-link-button" onClick={() => setOpenLinks((prev) => [...prev, linkKey])}>🔗 Añadir link</button>
                      )}
                    </div>
                  );
                })}
                <button className="add-option" onClick={() => setOptionList(activeCategory, [...optionsFor(activeCategory), { name: "", link: "" }])}>
                  <Icon name="plus" size={17} /> Agregar otra opción
                </button>
                <span className={`selection-count ${validCount(activeCategory) >= 2 ? "ready" : ""}`}>
                  {validCount(activeCategory) >= 2 ? <><Icon name="check" size={14} /> Listo para continuar</> : `${validCount(activeCategory)} de 2 opciones completas`}
                </span>
              </div>
            )}
            {categories.length > 1 && <p className="category-helper">Configura cada categoría usando las pestañas de arriba.</p>}
          </section>
        )}

        {!datePicker && current === "Revisar" && (
          <section className="flow-step review-step">
            <span className="step-emoji">💜</span>
            <h1>Así queda su plan</h1>
            <p>{mode === "add" ? "Estas categorías se suman al día." : "Solo las decisiones que eligieron para este día."}</p>
            <div className="review-card">
              <div className="review-date"><span>{shortDayUpper(date)}</span><strong>{parseDate(date).getDate()}</strong><small>{dayMonthUpper(date).split(" ")[1]}</small></div>
              <div>
                <span className="eyebrow">NUESTRO PLAN</span>
                <h2>{longDate(date)}</h2>
                <div className="review-categories">
                  {categories.map((c) => <span key={c}>{c === "comida" && mealInfo(meal) ? `${mealInfo(meal).emoji} ${mealInfo(meal).label}` : `${categoryInfo(c).emoji} ${c === "otro" ? questionFor("otro") : categoryInfo(c).label}`}</span>)}
                </div>
              </div>
            </div>
            <div className="review-polls">
              {categories.map((c) => {
                const names =
                  c === "comida"
                    ? foodSeparate ? foodSelections.map((f) => (FOOD_TYPES.some((t) => t.key === f) ? `${foodTypeInfo(f).emoji} ${foodTypeInfo(f).label}` : `✨ ${f}`)) : restaurants.map((r) => r.name)
                    : optionsFor(c).filter((o) => o.name.trim()).map((o) => o.name);
                return (
                  <div className="preview-poll" key={c}>
                    <div><span>{c === "comida" && mealInfo(meal) ? mealInfo(meal).emoji : categoryInfo(c).emoji}</span><strong>{questionFor(c)}</strong><Pill tone="amber">{names.length} opciones</Pill></div>
                    {names.slice(0, 4).map((n) => <span key={n}>{n}</span>)}
                    {c === "comida" && foodSeparate && <small>Después decidirán el restaurante</small>}
                  </div>
                );
              })}
            </div>
            <div className="delight"><Icon name="sparkles" /><p><strong>¡Que empiece el finde!</strong>Les avisaremos cuando ambos hayan votado.</p></div>
            {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
          </section>
        )}
      </main>

      {!datePicker && (
        <footer className="flow-footer">
          <Button onClick={() => (lastStep ? submit() : setStepIndex(stepIndex + 1))} disabled={!canContinue || busy}>
            {lastStep ? (busy ? "Guardando..." : mode === "edit" ? "Guardar cambios" : mode === "add" ? "Agregar al plan" : "Crear plan") : "Continuar"}
            {!lastStep && <span>→</span>}
          </Button>
        </footer>
      )}

      {sitePicker && (
        <div className="modal-backdrop create-sites-backdrop">
          <section className="bottom-sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <div><span className="eyebrow">REUTILIZAR SUS FAVORITOS</span><h2>Seleccionar de Sitios</h2></div>
              <button className="icon-button" onClick={() => setSitePicker(false)}><Icon name="close" /></button>
            </div>
            <div className="site-selection-list">
              {foodPlaces.length === 0 && <p className="muted">Todavía no tienen sitios de comida guardados.</p>}
              {foodPlaces.map((p) => (
                <button
                  key={p.id}
                  className={pickedSites.includes(p.id) ? "site-select selected" : "site-select"}
                  onClick={() => setPickedSites((prev) => (prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]))}
                >
                  <i>{pickedSites.includes(p.id) && <Icon name="check" size={14} />}</i>
                  <span className="place-art peach">{placeEmoji(p)}</span>
                  <span><strong>{p.name}</strong><small>{[foodTypeInfo(p.category).label, p.area, p.favorite ? "Favorito" : ""].filter(Boolean).join(" · ")}</small></span>
                </button>
              ))}
            </div>
            <Button className="full" disabled={pickedSites.length === 0} onClick={addSites}>
              Agregar {pickedSites.length || ""} a la votación
            </Button>
          </section>
        </div>
      )}
    </div>
  );
}
