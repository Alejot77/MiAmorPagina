import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE, categoryInfo, FOOD_TYPES, POINTS_PER_CATEGORY } from "@/config";

export const dynamic = "force-dynamic";

// Convierte los "steps" que manda el cliente en la forma que guardamos.
// Devuelve null si algo es invalido (categoria sin al menos 2 opciones, etc).
function normalizeSteps(rawSteps) {
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) return null;

  const steps = [];
  for (let i = 0; i < rawSteps.length; i++) {
    const s = rawSteps[i] || {};
    const category =
      typeof s.category === "string" && s.category.trim() ? s.category.trim() : "otro";
    const question =
      typeof s.question === "string" && s.question.trim()
        ? s.question.trim()
        : categoryInfo(category).question;

    // Id estable: se mantiene si ya existia (para no perder los votos de ese
    // paso), y se crea uno nuevo solo para pasos agregados.
    const id = typeof s.id === "string" && s.id ? s.id : `step${Date.now()}${i}`;

    // Comida en 2 pasos: el "tipo" se vota entre FOOD_TYPES fijos, y el
    // paso de "sitio" lo genera automaticamente /api/vote segun el catalogo.
    const twoPhase = category === "comida" && Boolean(s.twoPhase);

    let options;
    let kind;

    if (twoPhase) {
      options = FOOD_TYPES.map((f) => ({ id: f.key, name: f.label }));
      kind = "comida-tipo";
    } else {
      const cleanOptions = Array.isArray(s.options)
        ? s.options
            .map((o) => ({
              name: typeof o?.name === "string" ? o.name.trim() : "",
              link: typeof o?.link === "string" ? o.link.trim() : "",
            }))
            .filter((o) => o.name)
        : [];

      if (cleanOptions.length < 2) return null;

      options = cleanOptions.map((o, j) => ({
        id: `opt${j}`,
        name: o.name,
        ...(o.link ? { link: o.link } : {}),
      }));
      // "comida-lugar" es el paso generado automaticamente: se conserva ese
      // tipo si el cliente lo reenvia tal cual (edicion sin tocar el toggle).
      if (typeof s.kind === "string" && s.kind) kind = s.kind;
    }

    const step = { id, category, question, options };
    if (kind) step.kind = kind;
    if (twoPhase) step.twoPhase = true;
    if (typeof s.generatedStepId === "string" && s.generatedStepId) {
      step.generatedStepId = s.generatedStepId;
    }
    if (typeof s.generatedFrom === "string" && s.generatedFrom) {
      step.generatedFrom = s.generatedFrom;
    }

    steps.push(step);
  }

  return steps;
}

async function loadVotes(planId, plan) {
  if (!plan) return {};
  const entries = await Promise.all(
    plan.steps.map(async (s) => [s.id, (await kv.hgetall(`votes:${planId}:${s.id}`)) || {}])
  );
  return Object.fromEntries(entries);
}

export async function GET() {
  const ids = await kv.lrange("plans", 0, 0);
  if (!ids || ids.length === 0) {
    return NextResponse.json({ plan: null, votes: {}, people: PEOPLE });
  }

  const id = ids[0];
  const plan = await kv.get(`plan:${id}`);
  const votes = await loadVotes(id, plan);

  return NextResponse.json({ plan, votes, people: PEOPLE });
}

export async function POST(request) {
  const body = await request.json();
  const { weekend, person, steps } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  if (!weekend) {
    return NextResponse.json({ error: "Falta la fecha del finde" }, { status: 400 });
  }

  const normalized = normalizeSteps(steps);
  if (!normalized) {
    return NextResponse.json(
      { error: "Cada categoría necesita al menos 2 opciones" },
      { status: 400 }
    );
  }

  const id = Date.now().toString();
  const pointsEarned = normalized.length * POINTS_PER_CATEGORY;
  const plan = {
    id,
    weekend,
    steps: normalized,
    createdBy: person,
    createdAt: new Date().toISOString(),
    pointsAwardedFor: normalized.length,
  };

  await kv.set(`plan:${id}`, plan);
  await kv.lpush("plans", id);
  await kv.incrby(`points:${person}`, pointsEarned);

  return NextResponse.json({
    plan,
    votes: Object.fromEntries(normalized.map((s) => [s.id, {}])),
    pointsEarned,
  });
}

export async function PATCH(request) {
  const body = await request.json();
  const { planId, weekend, person, steps } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  if (!planId) {
    return NextResponse.json({ error: "Falta el plan a editar" }, { status: 400 });
  }

  const existing = await kv.get(`plan:${planId}`);
  if (!existing) {
    return NextResponse.json({ error: "Ese plan no existe" }, { status: 404 });
  }

  const normalized = normalizeSteps(steps);
  if (!normalized) {
    return NextResponse.json(
      { error: "Cada categoría necesita al menos 2 opciones" },
      { status: 400 }
    );
  }

  // Puntos: solo se premian categorias nuevas por encima del maximo ya
  // premiado para este plan, para no repetir puntos al solo editar texto.
  const prevAwarded = existing.pointsAwardedFor || 0;
  const newCount = normalized.length;
  const pointsEarned = Math.max(0, newCount - prevAwarded) * POINTS_PER_CATEGORY;

  const updated = {
    ...existing,
    weekend: weekend || existing.weekend,
    steps: normalized,
    updatedBy: person,
    updatedAt: new Date().toISOString(),
    pointsAwardedFor: Math.max(prevAwarded, newCount),
  };

  await kv.set(`plan:${planId}`, updated);
  if (pointsEarned > 0) {
    await kv.incrby(`points:${person}`, pointsEarned);
  }

  // Se borran los votos de categorias que ya no existen...
  const newStepIds = new Set(normalized.map((s) => s.id));
  for (const oldStep of existing.steps) {
    if (!newStepIds.has(oldStep.id)) {
      await kv.del(`votes:${planId}:${oldStep.id}`);
    }
  }
  // ...y los votos que apuntan a una opcion que ya no existe en su categoria.
  for (const step of normalized) {
    const votes = (await kv.hgetall(`votes:${planId}:${step.id}`)) || {};
    const validIds = new Set(step.options.map((o) => o.id));
    const orphans = Object.entries(votes)
      .filter(([, v]) => !validIds.has(v))
      .map(([voter]) => voter);
    if (orphans.length > 0) {
      await kv.hdel(`votes:${planId}:${step.id}`, ...orphans);
    }
  }

  const votes = await loadVotes(planId, updated);
  return NextResponse.json({ plan: updated, votes, pointsEarned });
}

export async function DELETE(request) {
  const body = await request.json();
  const { planId, person } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }
  if (!planId) {
    return NextResponse.json({ error: "Falta el plan a eliminar" }, { status: 400 });
  }

  const plan = await kv.get(`plan:${planId}`);

  await kv.lrem("plans", 0, String(planId));
  await kv.del(`plan:${planId}`);
  if (plan?.steps) {
    for (const step of plan.steps) {
      await kv.del(`votes:${planId}:${step.id}`);
    }
  }

  return NextResponse.json({ ok: true });
}
