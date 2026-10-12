import { todayStrBogota } from "@/lib/planWindow";
export { loadAllPlans } from "@/lib/planWindow";

export const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "2026-10" (mes en curso en Bogota).
export function currentMonth() {
  return todayStrBogota().slice(0, 7);
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function monthName(month) {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1];
}
