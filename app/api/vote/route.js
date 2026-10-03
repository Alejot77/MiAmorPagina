import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE, foodTypeInfo } from "@/config";
import { sendPushToPerson, otherPerson } from "@/lib/push";

export const dynamic = "force-dynamic";

async function loadAllVotes(planId, plan) {
  if (!plan) return {};
  const entries = await Promise.all(
    plan.steps.map(async (s) => [s.id, (await kv.hgetall(`votes:${planId}:${s.id}`)) || {}])
  );
  return Object.fromEntries(entries);
}

async function loadPlaces() {
  const ids = await kv.lrange("places", 0, -1);
  if (!ids || ids.length === 0) return [];
  return (await Promise.all(ids.map((id) => kv.get(`place:${id}`)))).filter(Boolean);
}

// Si el paso votado es "tipo de comida" (flujo de 2 pasos) y ya votaron los
// dos, genera (o refresca, si todavia no tiene votos) el paso de "sitio"
// usando el catalogo de lugares que coincidan con el/los tipos elegidos.
async function maybeGenerateLugarStep(planId, plan, step, votes) {
  if (step.kind !== "comida-tipo") return plan;
  if (!PEOPLE.every((p) => Boolean(votes[p]))) return plan;

  const chosenTypes = [...new Set(Object.values(votes))];
  const places = await loadPlaces();
  const matching = places.filter((pl) => chosenTypes.includes(pl.category));
  if (matching.length < 2) return plan;

  const typeLabel = chosenTypes.map((key) => foodTypeInfo(key).label).join(" y ");
  const options = matching.map((pl) => ({
    id: pl.id,
    name: pl.name,
    ...(pl.link ? { link: pl.link } : {}),
  }));

  const existingGenStep = step.generatedStepId
    ? plan.steps.find((s) => s.id === step.generatedStepId)
    : null;

  if (!existingGenStep) {
    const newStep = {
      id: `step${Date.now()}lugar`,
      category: "comida",
      kind: "comida-lugar",
      generatedFrom: step.id,
      question: `¿A cuál vamos? (${typeLabel})`,
      options,
    };
    const updatedPlan = {
      ...plan,
      steps: plan.steps
        .map((s) => (s.id === step.id ? { ...s, generatedStepId: newStep.id } : s))
        .concat(newStep),
    };
    await kv.set(`plan:${planId}`, updatedPlan);
    return updatedPlan;
  }

  const genVotes = (await kv.hgetall(`votes:${planId}:${existingGenStep.id}`)) || {};
  if (Object.keys(genVotes).length > 0) {
    // Ya hay votos en el paso de sitio: no se tocan sus opciones.
    return plan;
  }

  const updatedPlan = {
    ...plan,
    steps: plan.steps.map((s) =>
      s.id === existingGenStep.id ? { ...s, question: `¿A cuál vamos? (${typeLabel})`, options } : s
    ),
  };
  await kv.set(`plan:${planId}`, updatedPlan);
  return updatedPlan;
}

export async function POST(request) {
  const body = await request.json();
  const { planId, stepId, person, optionId } = body || {};

  if (!PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Persona inválida" }, { status: 400 });
  }

  const ids = await kv.lrange("plans", 0, 0);
  if (!ids || ids.length === 0 || String(ids[0]) !== String(planId)) {
    return NextResponse.json({ error: "Este plan ya no está activo" }, { status: 400 });
  }

  const plan = await kv.get(`plan:${planId}`);
  const step = plan?.steps.find((s) => s.id === stepId);
  if (!step || !step.options.some((o) => o.id === optionId)) {
    return NextResponse.json({ error: "Opción inválida" }, { status: 400 });
  }

  // hset sobrescribe el valor de esta persona: siempre queda un solo voto por persona y categoria.
  await kv.hset(`votes:${planId}:${stepId}`, { [person]: optionId });
  const stepVotes = await kv.hgetall(`votes:${planId}:${stepId}`);

  const updatedPlan = await maybeGenerateLugarStep(planId, plan, step, stepVotes);
  const votes = await loadAllVotes(planId, updatedPlan);

  const target = otherPerson(person);
  if (target) {
    await sendPushToPerson(target, {
      title: "✅ Nuevo voto",
      body: `${person} votó en "${step.question}"`,
      url: "/",
    });
  }

  return NextResponse.json({ plan: updatedPlan, votes });
}
