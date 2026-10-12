// Festivos de Colombia (Ley 51 de 1983, "Ley Emiliani"). Fechas "yyyy-mm-dd".

export type Holiday = { date: string; name: string };

const pad = (n: number) => String(n).padStart(2, "0");
const str = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const plus = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);

// Si no cae lunes, se corre al lunes siguiente.
function nextMonday(d: Date) {
  const day = d.getUTCDay(); // 0 domingo ... 1 lunes
  return day === 1 ? d : plus(d, (8 - day) % 7);
}

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano).
function easter(y: number) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(y, month, day);
}

const cache = new Map<number, Holiday[]>();

export function colombianHolidays(year: number): Holiday[] {
  if (cache.has(year)) return cache.get(year)!;
  const e = easter(year);
  const list: [Date, string][] = [
    // Fijos
    [utc(year, 1, 1), "Año Nuevo"],
    [utc(year, 5, 1), "Día del Trabajo"],
    [utc(year, 7, 20), "Día de la Independencia"],
    [utc(year, 8, 7), "Batalla de Boyacá"],
    [utc(year, 12, 8), "Inmaculada Concepción"],
    [utc(year, 12, 25), "Navidad"],
    // Se corren al lunes
    [nextMonday(utc(year, 1, 6)), "Reyes Magos"],
    [nextMonday(utc(year, 3, 19)), "San José"],
    [nextMonday(utc(year, 6, 29)), "San Pedro y San Pablo"],
    [nextMonday(utc(year, 8, 15)), "Asunción de la Virgen"],
    [nextMonday(utc(year, 10, 12)), "Día de la Raza"],
    [nextMonday(utc(year, 11, 1)), "Todos los Santos"],
    [nextMonday(utc(year, 11, 11)), "Independencia de Cartagena"],
    // Dependen de la Semana Santa
    [plus(e, -3), "Jueves Santo"],
    [plus(e, -2), "Viernes Santo"],
    [nextMonday(plus(e, 39)), "Ascensión del Señor"],
    [nextMonday(plus(e, 60)), "Corpus Christi"],
    [nextMonday(plus(e, 68)), "Sagrado Corazón"],
  ];
  // Dos festivos pueden caer el mismo lunes (ej. 30 de junio de 2025).
  const byDate = new Map<string, string>();
  for (const [d, name] of list) byDate.set(str(d), byDate.has(str(d)) ? `${byDate.get(str(d))} y ${name}` : name);
  const holidays = [...byDate].map(([date, name]) => ({ date, name })).sort((a, b) => (a.date < b.date ? -1 : 1));
  cache.set(year, holidays);
  return holidays;
}

export function holidayOn(date: string): Holiday | undefined {
  return colombianHolidays(Number(date.slice(0, 4))).find((h) => h.date === date);
}

// Festivos entre dos fechas (ambas incluidas).
export function holidaysBetween(from: string, to: string): Holiday[] {
  const years = new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))]);
  return [...years].flatMap(colombianHolidays).filter((h) => h.date >= from && h.date <= to);
}
