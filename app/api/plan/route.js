import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { CATEGORIES, PEOPLE, categoryInfo, FOOD_TYPES } from "@/config";
import { getSettings } from "@/lib/settings";
import { sendPushToPerson, otherPerson } from "@/lib/push";
import { deletePlanPhotos } from "@/lib/photos";
import { loadActivePlans } from "@/lib/planWindow";
import { requireSession } from "@/lib/session";
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
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const { plans, votes } = await loadActivePlans();
  return NextResponse.json({ plans, votes, people: PEOPLE });
}

export async function POST(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const person = auth.person;
  const { weekend, steps } = await readJson(request);

  if (!isDateStr(weekend)) {
    return NextResponse.json({ error: "Falta la fecha del finde" }, { status: 400 });
  }
  const normalized = normalizeSteps(steps);
  if (!normalized) return NextResponse.json({ error: NEEDS_OPTIONS }, { status: 400 });

  const { pointsPerCategory } = await getSettings();
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
  };

  await kv.set(`plan:${id}`, plan);
  await Promise.all([kv.lpush("plans", id), kv.incrby(`points:${person}`, pointsEarned)]);

  const target = otherPerson(person);
  if (target) {
    await sendPushToPerson(target, {
      title: "🎉 Nuevo plan",
      body: `${person} creó un plan para este finde. ¡Ve a votar!`,
      url: "/",
    });
  }

  const { plans, votes } = await loadActivePlans();
  return NextResponse.json({ plans, votes, pointsEarned });
}

export async function PATCH(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const person = auth.person;
  const { planId, weekend, steps } = await readJson(request);

  if (!isId(planId)) {
    return NextResponse.json({ error: "Falta el plan a editar" }, { status: 400 });
  }
  if (weekend !== undefined && !isDateStr(weekend)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const existing = await kv.get(`plan:${planId}`);
  if (!existing) {
    return NextResponse.json({ error: "Ese plan no existe" }, { status: 404 });
  }
  const normalized = normalizeSteps(steps);
  if (!normalized) return NextResponse.json({ error: NEEDS_OPTIONS }, { status: 400 });

  // Puntos: solo se premian categorias nuevas por encima del maximo ya
  // premiado para este plan, para no repetir puntos al solo editar texto.
  const { pointsPerCategory } = await getSettings();
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
  await kv.set(`plan:${planId}`, updated);
  if (pointsEarned > 0) await kv.incrby(`points:${person}`, pointsEarned);

  // Se borran los votos de categorias que ya no existen y los que apuntan a
  // una opcion que ya no existe en su categoria.
  const newStepIds = new Set(normalized.map((s) => s.id));
  const removed = existing.steps.filter((s) => !newStepIds.has(s.id));
  const currentVotes = await Promise.all(normalized.map((s) => kv.hgetall(`votes:${planId}:${s.id}`)));
  await Promise.all([
    ...removed.map((s) => kv.del(`votes:${planId}:${s.id}`)),
    ...normalized.map((step, i) => {
      const validIds = new Set(step.options.map((o) => o.id));
      const orphans = Object.entries(currentVotes[i] || {}).filter(([, v]) => !validIds.has(v)).map(([voter]) => voter);
      return orphans.length > 0 ? kv.hdel(`votes:${planId}:${step.id}`, ...orphans) : null;
    }),
  ]);

  const target = otherPerson(person);
  if (target) {
    const oldStepIds = new Set(existing.steps.map((s) => s.id));
    const added = normalized.filter((s) => !oldStepIds.has(s.id));
    await sendPushToPerson(
      target,
      added.length > 0
        ? {
            title: "➕ Nueva pregunta en el plan",
            body:
              added.length === 1
                ? `${person} agregó "${added[0].question}". ¡Ve a votar!`
                : `${person} agregó ${added.length} preguntas al plan. ¡Ve a votar!`,
            url: "/",
          }
        : {
            title: "✏️ Plan editado",
            body: `${person} hizo cambios en el plan. ¡Échale un ojo!`,
            url: "/",
          }
    );
  }

  const { plans, votes } = await loadActivePlans();
  return NextResponse.json({ plans, votes, pointsEarned });
}

export async function DELETE(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const { planId } = await readJson(request);
  if (!isId(planId)) {
    return NextResponse.json({ error: "Falta el plan a eliminar" }, { status: 400 });
  }

  const plan = await kv.get(`plan:${planId}`);
  await Promise.all([
    kv.lrem("plans", 0, planId),
    kv.del(`plan:${planId}`),
    ...(plan?.steps || []).map((step) => kv.del(`votes:${planId}:${step.id}`)),
    deletePlanPhotos(planId),
  ]);

  const { plans, votes } = await loadActivePlans();
  return NextResponse.json({ plans, votes });
}
