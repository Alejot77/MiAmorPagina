import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { CATEGORIES, categoryInfo, mealInfo, FOOD_TYPES } from "@/config";
import { gk, groupSettings } from "@/lib/groups";
import { getUser } from "@/lib/users";
import { notifyGroup } from "@/lib/push";
import { deletePlanPhotos } from "@/lib/photos";
import { loadActivePlans } from "@/lib/planWindow";
import { requireMember } from "@/lib/session";
import { LIMITS, cleanText, isDateStr, isId, readJson, safeLink } from "@/lib/validate";

export const dynamic = "force-dynamic";

const NEEDS_OPTIONS = "Cada categoría necesita al menos 2 opciones";

// Convierte los "steps" que manda el cliente en la forma que guardamos.
// Devuelve null si algo es invalido (categoria sin al menos 2 opciones, etc).
function normalizeSteps(rawSteps) {
  if (!Array.isArray(rawSteps) || rawSteps.length === 0 || rawSteps.length > LIMITS.steps * 2) return null;

  const steps = [];
  for (let i = 0; i < rawSteps.length; i++) {
    const s = rawSteps[i] || {};
    const category = CATEGORIES.some((c) => c.key === s.category) ? s.category : "otro";
    const question = cleanText(s.question, LIMITS.question) || categoryInfo(category).question;

    // Id estable: se mantiene si ya existia (para no perder los votos de ese
    // paso), y se crea uno nuevo solo para pasos agregados.
    const id = isId(s.id) ? s.id : `step${Date.now()}${i}`;

    // Comida en 2 pasos: primero se vota el tipo de comida; el paso de
    // restaurante lo crean despues a mano (/api/plan/restaurants).
    const twoPhase = category === "comida" && Boolean(s.twoPhase);

    let options;
    let kind;

    if (twoPhase) {
      // Cada tipo es una clave de FOOD_TYPES o un texto libre ("Otro").
      const seen = new Set();
      options = [];
      for (const raw of Array.isArray(s.selectedTypes) ? s.selectedTypes.slice(0, LIMITS.options) : []) {
        const known = FOOD_TYPES.find((f) => f.key === raw);
        const text = cleanText(raw, LIMITS.name);
        if (!known && !text) continue;
        const option = known ? { id: known.key, name: known.label } : { id: `custom:${text.toLowerCase()}`, name: text };
        if (seen.has(option.id)) continue;
        seen.add(option.id);
        options.push(option);
      }
      if (options.length < 2) return null;
      kind = "comida-tipo";
    } else {
      const cleanOptions = (Array.isArray(s.options) ? s.options.slice(0, LIMITS.options) : [])
        .map((o) => ({
          name: cleanText(o?.name, LIMITS.name),
          link: safeLink(o?.link),
          placeId: isId(o?.placeId) ? o.placeId : "",
        }))
        .filter((o) => o.name);
      if (cleanOptions.length < 2) return null;

      options = cleanOptions.map((o, j) => ({
        id: `opt${j}`,
        name: o.name,
        ...(o.link ? { link: o.link } : {}),
        ...(o.placeId ? { placeId: o.placeId } : {}),
      }));
      // "comida-lugar" es el paso de restaurante: se conserva si el cliente
      // lo reenvia tal cual (edicion sin tocar el modo de comida).
      if (s.kind === "comida-lugar") kind = s.kind;
    }

    const step = { id, category, question, options };
    if (kind) step.kind = kind;
    if (twoPhase) step.twoPhase = true;
    if (category === "comida" && mealInfo(s.meal)) step.meal = s.meal;
    if (isId(s.generatedStepId)) step.generatedStepId = s.generatedStepId;
    if (isId(s.generatedFrom)) step.generatedFrom = s.generatedFrom;
    steps.push(step);
  }

  // El limite cuenta categorias (los pasos de restaurante no cuentan).
  if (steps.filter((st) => !st.generatedFrom).length > LIMITS.steps) return null;
  return steps;
}

// Categorias que cuentan para puntos (el paso de restaurante no es nueva).
const countCategories = (steps) => steps.filter((st) => !st.generatedFrom).length;

export async function GET(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  return NextResponse.json(await loadActivePlans(auth.gid, auth.members));
}

export async function POST(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const { gid, uid: person, group, members } = auth;
  const { weekend, steps } = await readJson(request);

  if (!isDateStr(weekend)) {
    return NextResponse.json({ error: "Falta la fecha del finde" }, { status: 400 });
  }
  const normalized = normalizeSteps(steps);
  if (!normalized) return NextResponse.json({ error: NEEDS_OPTIONS }, { status: 400 });

  const { pointsPerCategory } = groupSettings(group);
  const id = Date.now().toString();
  const categoryCount = countCategories(normalized);
  const pointsEarned = categoryCount * pointsPerCategory;
  const plan = {
    id,
    weekend,
    steps: normalized,
    createdBy: person,
    createdAt: new Date().toISOString(),
    pointsAwardedFor: categoryCount,
    voters: members, // quienes votan: los miembros de la sala al crearlo
  };

  await kv.set(gk(gid, "plan", id), plan);
  await Promise.all([kv.lpush(gk(gid, "plans"), id), kv.incrby(gk(gid, "points", person), pointsEarned)]);

  const me = await getUser(person);
  await notifyGroup(group, members, person, { title: "🎉 Nuevo plan", body: `${me?.name || "Alguien"} creó un plan. ¡Ve a votar!` });

  return NextResponse.json({ ...(await loadActivePlans(auth.gid, auth.members)), pointsEarned });
}

export async function PATCH(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const { gid, uid: person, group, members } = auth;
  const { planId, weekend, steps } = await readJson(request);

  if (!isId(planId)) {
    return NextResponse.json({ error: "Falta el plan a editar" }, { status: 400 });
  }
  if (weekend !== undefined && !isDateStr(weekend)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const existing = await kv.get(gk(gid, "plan", planId));
  if (!existing) {
    return NextResponse.json({ error: "Ese plan no existe" }, { status: 404 });
  }
  const normalized = normalizeSteps(steps);
  if (!normalized) return NextResponse.json({ error: NEEDS_OPTIONS }, { status: 400 });
  // Las votaciones que ya se cerraron siguen cerradas.
  for (const st of normalized) if (existing.steps.find((o) => o.id === st.id)?.closed) st.closed = true;

  // Puntos: solo se premian categorias nuevas por encima del maximo ya
  // premiado para este plan, para no repetir puntos al solo editar texto.
  const { pointsPerCategory } = groupSettings(group);
  const prevAwarded = existing.pointsAwardedFor || 0;
  const newCount = countCategories(normalized);
  const pointsEarned = Math.max(0, newCount - prevAwarded) * pointsPerCategory;

  const updated = {
    ...existing,
    weekend: weekend || existing.weekend,
    steps: normalized,
    updatedBy: person,
    updatedAt: new Date().toISOString(),
    pointsAwardedFor: Math.max(prevAwarded, newCount),
  };
  await kv.set(gk(gid, "plan", planId), updated);
  if (pointsEarned > 0) await kv.incrby(gk(gid, "points", person), pointsEarned);

  // Se borran los votos de categorias que ya no existen y los que apuntan a
  // una opcion que ya no existe en su categoria.
  const newStepIds = new Set(normalized.map((s) => s.id));
  const removed = existing.steps.filter((s) => !newStepIds.has(s.id));
  const currentVotes = await Promise.all(normalized.map((s) => kv.hgetall(gk(gid, "votes", planId, s.id))));
  await Promise.all([
    ...removed.map((s) => kv.del(gk(gid, "votes", planId, s.id))),
    ...normalized.map((step, i) => {
      const validIds = new Set(step.options.map((o) => o.id));
      const orphans = Object.entries(currentVotes[i] || {}).filter(([, v]) => !validIds.has(v)).map(([voter]) => voter);
      return orphans.length > 0 ? kv.hdel(gk(gid, "votes", planId, step.id), ...orphans) : null;
    }),
  ]);

  const name = (await getUser(person))?.name || "Alguien";
  const oldStepIds = new Set(existing.steps.map((s) => s.id));
  const added = normalized.filter((s) => !oldStepIds.has(s.id));
  await notifyGroup(
    group,
    members,
    person,
    added.length > 0
      ? {
          title: "➕ Nueva pregunta en el plan",
          body: added.length === 1 ? `${name} agregó "${added[0].question}". ¡Ve a votar!` : `${name} agregó ${added.length} preguntas al plan. ¡Ve a votar!`,
        }
      : { title: "✏️ Plan editado", body: `${name} hizo cambios en el plan. ¡Échale un ojo!` }
  );

  return NextResponse.json({ ...(await loadActivePlans(auth.gid, auth.members)), pointsEarned });
}

export async function DELETE(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const { planId } = await readJson(request);
  if (!isId(planId)) {
    return NextResponse.json({ error: "Falta el plan a eliminar" }, { status: 400 });
  }

  const gid = auth.gid;
  const plan = await kv.get(gk(gid, "plan", planId));
  await Promise.all([
    kv.lrem(gk(gid, "plans"), 0, planId),
    kv.del(gk(gid, "plan", planId)),
    ...(plan?.steps || []).map((step) => kv.del(gk(gid, "votes", planId, step.id))),
    deletePlanPhotos(gid, planId),
  ]);

  return NextResponse.json(await loadActivePlans(auth.gid, auth.members));
}
