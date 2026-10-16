import { kv } from "@/lib/kv";
import { gk } from "@/lib/groups";

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

// Quienes votan en un plan: los miembros que habia al crearlo y siguen en la
// sala (asi alguien que entra despues no deja esperando planes viejos, y
// alguien que se va no los bloquea).
export function planVoters(plan, members) {
  const base = Array.isArray(plan.voters) && plan.voters.length ? plan.voters : members;
  return base.filter((id) => members.includes(id));
}

// Lo que se manda al navegador: cada categoria con sus votantes.
export function hydratePlan(plan, members) {
  const voters = planVoters(plan, members);
  return { ...plan, voters, steps: plan.steps.map((s) => ({ ...s, voters })) };
}

// Ganador de una categoria: se decide cuando votaron todos (o la cerraron);
// gana la opcion con mas votos. Varias empatadas = empate.
export function stepOutcome(step, votes = {}, voters = []) {
  const counted = Object.entries(votes).filter(([id]) => voters.includes(id));
  const allVoted = Boolean(step.closed && counted.length > 0) || (voters.length > 0 && voters.every((id) => votes[id]));
  if (!allVoted) return { allVoted: false, winners: [] };
  const counts = {};
  for (const [, opt] of counted) counts[opt] = (counts[opt] || 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  return { allVoted: true, winners: step.options.filter((o) => max > 0 && counts[o.id] === max) };
}

export async function loadVotes(gid, plan) {
  if (!plan) return {};
  const entries = await Promise.all(
    plan.steps.map(async (s) => [s.id, (await kv.hgetall(gk(gid, "votes", plan.id, s.id))) || {}])
  );
  return Object.fromEntries(entries);
}

// Todos los planes de una sala, en una sola consulta.
export async function loadAllPlans(gid) {
  const ids = (await kv.lrange(gk(gid, "plans"), 0, -1)) || [];
  if (ids.length === 0) return [];
  return ((await kv.mget(...ids.map((id) => gk(gid, "plan", id)))) || []).filter(Boolean);
}

// { planId: votos } de varios planes a la vez (el cliente de Upstash junta
// todas estas consultas en una sola peticion).
export async function loadVotesFor(gid, plans) {
  const entries = await Promise.all(plans.map(async (p) => [p.id, await loadVotes(gid, p)]));
  return Object.fromEntries(entries);
}

const byDate = (a, b) => (a.weekend < b.weekend ? -1 : a.weekend > b.weekend ? 1 : 0);

// Planes activos de la sala (ninguno paso todavia su martes de corte),
// ordenados por fecha y listos para el navegador.
export async function loadActivePlans(gid, members) {
  const active = (await loadAllPlans(gid)).filter(isPlanActive).sort(byDate);
  return { plans: active.map((p) => hydratePlan(p, members)), votes: await loadVotesFor(gid, active) };
}
