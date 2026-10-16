import { FOOD_TYPES, categoryInfo, mealInfo, placeGroupInfo, foodTypeInfo } from "@/config";
import type { Option, Place, Plan, PlanVotes, Step, StepVotes } from "./types";

// Resultado de una categoria. Los votos se ven cuando votaron todos los que
// votan en ese plan (step.voters) o cuando se cerro la votacion; gana la
// opcion con mas votos y si varias empatan, es empate.
export function stepResult(step: Step, votes: StepVotes = {}, person?: string) {
  const voters = step.voters || [];
  const counted = voters.filter((id) => votes[id]);
  const allVoted = Boolean(step.closed && counted.length > 0) || (voters.length > 0 && counted.length === voters.length);
  const counts: Record<string, number> = {};
  counted.forEach((id) => (counts[votes[id]] = (counts[votes[id]] || 0) + 1));
  const max = Math.max(0, ...Object.values(counts));
  const winners = allVoted ? step.options.filter((o) => max > 0 && counts[o.id] === max) : [];
  return {
    allVoted,
    winners,
    tie: winners.length > 1,
    myVote: person ? votes[person] : undefined,
    canVote: person ? voters.includes(person) : false,
    voters,
    votedCount: counted.length,
    missing: voters.filter((id) => !votes[id]),
    closed: Boolean(step.closed),
    // Todos eligieron lo mismo (sin cerrar antes).
    unanimous: allVoted && !step.closed && winners.length === 1 && counts[winners[0].id] === voters.length,
  };
}

// Las categorias "raiz" de un plan: el paso generado de "¿Dónde comemos?" se
// muestra dentro de su paso de tipo de comida, no como categoria aparte.
export function rootSteps(plan: Plan) {
  const ids = new Set(plan.steps.map((s) => s.id));
  return plan.steps.filter((s) => !(s.generatedFrom && ids.has(s.generatedFrom)));
}

export function generatedStep(plan: Plan, step: Step) {
  return step.generatedStepId ? plan.steps.find((s) => s.id === step.generatedStepId) : undefined;
}

// El paso que define el resultado final de una categoria (el de restaurante,
// si la comida ya llego a esa segunda votacion).
export function terminalStep(plan: Plan, step: Step) {
  return generatedStep(plan, step) || step;
}

export function isStepDecided(plan: Plan, step: Step, votes: PlanVotes) {
  const final = terminalStep(plan, step);
  if (step.kind === "comida-tipo" && final === step) return false;
  return stepResult(final, votes[final.id]).allVoted;
}

export function isPlanComplete(plan: Plan, votes: PlanVotes) {
  return rootSteps(plan).every((s) => isStepDecided(plan, s, votes));
}

export function optionEmoji(step: Step, option?: Option) {
  if (!option) return categoryInfo(step.category).emoji;
  if (step.kind === "comida-tipo") {
    return FOOD_TYPES.some((f) => f.key === option.id) ? foodTypeInfo(option.id).emoji : "✨";
  }
  return "";
}

// Emoji de una categoria (en comida, el de desayuno/almuerzo/cena si lo eligieron).
export function stepEmoji(step: Step) {
  return (step.category === "comida" && mealInfo(step.meal)?.emoji) || categoryInfo(step.category).emoji;
}

export function categoryTitle(step: Step) {
  if (step.category === "comida" && mealInfo(step.meal)) return mealInfo(step.meal).label;
  return step.category === "otro" ? step.question : categoryInfo(step.category).label;
}

export function placeEmoji(place?: Place) {
  if (!place) return "🍴";
  if (place.group === "comida") return foodTypeInfo(place.category).emoji;
  return placeGroupInfo(place.group).emoji;
}

export function placeColor(place?: Place) {
  return placeGroupInfo(place?.group || "comida").color;
}

// ---------- Fechas (las fechas de los planes son yyyy-mm-dd sin hora) ----------

export function parseDate(str: string) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-ES", opts).format(d).replace(".", "");

export function weekdayUpper(str: string) {
  return fmt(parseDate(str), { weekday: "long" }).toUpperCase();
}

export function shortDayUpper(str: string) {
  return fmt(parseDate(str), { weekday: "short" }).toUpperCase().slice(0, 3);
}

export function dayMonthUpper(str: string) {
  const d = parseDate(str);
  return `${d.getDate()} ${fmt(d, { month: "short" }).toUpperCase()}`;
}

export function longDate(str: string) {
  const text = fmt(parseDate(str), { weekday: "long", day: "numeric", month: "long" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function monthUpper(str: string) {
  return fmt(parseDate(str), { month: "long" }).toUpperCase();
}

// "10 — 11 DE OCTUBRE" (o "31 OCT — 1 NOV" si cambia de mes).
export function rangeLabel(dates: string[]) {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort();
  const first = parseDate(sorted[0]);
  const last = parseDate(sorted[sorted.length - 1]);
  const month = (d: Date) => fmt(d, { month: "long" }).toUpperCase();
  if (sorted[0] === sorted[sorted.length - 1]) return `${first.getDate()} DE ${month(first)}`;
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} — ${last.getDate()} DE ${month(first)}`;
  }
  return `${dayMonthUpper(sorted[0])} — ${dayMonthUpper(sorted[sorted.length - 1])}`;
}

// Proximo sabado (si hoy es sabado, el de hoy).
export function upcomingSaturday() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return toDateStr(d);
}

export function addDays(str: string, days: number) {
  const d = parseDate(str);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

// Titulo de un recuerdo del historial con lo que gano en cada categoria.
export function memoryTitle(plan: Plan, votes: PlanVotes) {
  const names = rootSteps(plan)
    .map((s) => {
      const final = terminalStep(plan, s);
      const r = stepResult(final, votes[final.id]);
      return r.winners.length === 1 ? r.winners[0].name : null;
    })
    .filter(Boolean) as string[];
  if (names.length === 0) return `Plan del ${weekdayUpper(plan.weekend).toLowerCase()}`;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}
