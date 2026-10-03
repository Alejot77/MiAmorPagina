import { kv } from "@/lib/kv";

// Colombia no tiene horario de verano, asi que un offset fijo alcanza.
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

export function todayStrBogota() {
  return new Date(Date.now() + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

// Un plan se queda visible como "activo" hasta el martes siguiente a su
// fecha (asi un finde de sabado+domingo+lunes festivo se ve completo hasta
// ese martes, sin importar cuantos planes nuevos se creen mientras tanto).
export function cutoffDateStr(weekendStr) {
  const [y, m, d] = weekendStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0=domingo ... 2=martes ... 6=sabado
  let diff = (2 - day + 7) % 7;
  if (diff === 0) diff = 7;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function isPlanActive(plan) {
  return todayStrBogota() < cutoffDateStr(plan.weekend);
}

export async function loadVotes(planId, plan) {
  if (!plan) return {};
  const entries = await Promise.all(
    plan.steps.map(async (s) => [s.id, (await kv.hgetall(`votes:${planId}:${s.id}`)) || {}])
  );
  return Object.fromEntries(entries);
}

// Todos los planes activos (ninguno paso todavia su martes de corte),
// ordenados por fecha. Puede haber varios a la vez (sabado, domingo,
// lunes festivo...).
export async function loadActivePlans() {
  const ids = await kv.lrange("plans", 0, -1);
  if (!ids || ids.length === 0) return { plans: [], votes: {} };

  const all = await Promise.all(ids.map((id) => kv.get(`plan:${id}`)));
  const active = all.filter((p) => p && isPlanActive(p));
  active.sort((a, b) => (a.weekend < b.weekend ? -1 : a.weekend > b.weekend ? 1 : 0));

  const votesEntries = await Promise.all(active.map(async (p) => [p.id, await loadVotes(p.id, p)]));

  return { plans: active, votes: Object.fromEntries(votesEntries) };
}
