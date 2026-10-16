import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { PEOPLE, FOOD_TYPES, mealInfo } from "@/config";
import { sendPushToPerson, otherPerson } from "@/lib/push";
import { isPlanActive, loadActivePlans } from "@/lib/planWindow";
import { requireSession } from "@/lib/session";
import { LIMITS, cleanText, isId, readJson, safeLink } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Paso 2 de "comida en 2 pasos": cuando los dos ya votaron el tipo de comida,
// eligen a mano que restaurantes entran a la votacion de "¿Dónde comemos?".
// Los que agregan escritos a mano se pueden guardar tambien en Sitios.
export async function POST(request) {
  const auth = await requireSession(request);
  if (auth.error) return auth.error;
  const person = auth.person;
  const { planId, stepId, restaurants } = await readJson(request);
  if (!isId(planId) || !isId(stepId)) {
    return NextResponse.json({ error: "Este plan ya no está activo" }, { status: 400 });
  }

  const plan = await kv.get(`plan:${planId}`);
  if (!plan || !isPlanActive(plan)) {
    return NextResponse.json({ error: "Este plan ya no está activo" }, { status: 400 });
  }

  const typeStep = plan.steps.find((s) => s.id === stepId);
  if (!typeStep || typeStep.kind !== "comida-tipo") {
    return NextResponse.json({ error: "Esa categoría no es de comida en 2 pasos" }, { status: 400 });
  }

  const typeVotes = (await kv.hgetall(`votes:${planId}:${stepId}`)) || {};
  if (!PEOPLE.every((p) => Boolean(typeVotes[p]))) {
    return NextResponse.json({ error: "Primero tienen que votar los dos el tipo de comida" }, { status: 400 });
  }

  const seen = new Set();
  const clean = [];
  for (const r of Array.isArray(restaurants) ? restaurants.slice(0, LIMITS.options) : []) {
    const name = cleanText(r?.name, LIMITS.name);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    clean.push({
      name,
      link: safeLink(r?.link),
      placeId: isId(r?.placeId) ? r.placeId : "",
      save: Boolean(r?.save),
    });
  }
  if (clean.length < 2) {
    return NextResponse.json({ error: "Elijan al menos 2 restaurantes" }, { status: 400 });
  }

  const existingGen = typeStep.generatedStepId
    ? plan.steps.find((s) => s.id === typeStep.generatedStepId)
    : null;
  if (existingGen) {
    const genVotes = (await kv.hgetall(`votes:${planId}:${existingGen.id}`)) || {};
    if (Object.keys(genVotes).length > 0) {
      return NextResponse.json(
        { error: "Ya empezaron a votar el restaurante; no se puede cambiar la lista" },
        { status: 400 }
      );
    }
  }

  // Los restaurantes nuevos se guardan con el tipo de comida que gano.
  const counts = {};
  Object.values(typeVotes).forEach((id) => (counts[id] = (counts[id] || 0) + 1));
  const winnerId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const foodType = FOOD_TYPES.some((f) => f.key === winnerId) ? winnerId : "otro";

  const now = Date.now();
  await Promise.all(
    clean.map((r, i) => {
      if (r.placeId || !r.save) return null;
      const id = `place${now}${i}`;
      r.placeId = id;
      return Promise.all([
        kv.set(`place:${id}`, {
          id,
          name: r.name,
          group: "comida",
          category: foodType,
          ...(r.link ? { link: r.link } : {}),
          createdBy: person,
          createdAt: new Date().toISOString(),
        }),
        kv.lpush("places", id),
      ]);
    })
  );

  const options = clean.map((r, j) => ({
    id: `opt${j}`,
    name: r.name,
    ...(r.link ? { link: r.link } : {}),
    ...(r.placeId ? { placeId: r.placeId } : {}),
  }));

  // El paso de restaurante hereda desayuno/almuerzo/cena del tipo de comida.
  const meal = mealInfo(typeStep.meal) ? { meal: typeStep.meal } : {};
  let steps;
  if (existingGen) {
    steps = plan.steps.map((s) => (s.id === existingGen.id ? { ...s, options, ...meal } : s));
  } else {
    const newStep = {
      id: `step${Date.now()}lugar`,
      category: "comida",
      kind: "comida-lugar",
      generatedFrom: typeStep.id,
      question: mealInfo(typeStep.meal)?.where || "¿Dónde comemos?",
      options,
      ...meal,
    };
    steps = plan.steps
      .map((s) => (s.id === typeStep.id ? { ...s, generatedStepId: newStep.id } : s))
      .concat(newStep);
  }

  await kv.set(`plan:${planId}`, { ...plan, steps });

  const target = otherPerson(person);
  if (target) {
    await sendPushToPerson(target, {
      title: "🍽️ ¿Dónde comemos?",
      body: `${person} eligió los restaurantes. ¡Ve a votar!`,
      url: "/",
    });
  }

  const { plans, votes } = await loadActivePlans();
  return NextResponse.json({ plans, votes });
}
