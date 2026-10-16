import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { FOOD_TYPES, mealInfo } from "@/config";
import { gk } from "@/lib/groups";
import { getUser } from "@/lib/users";
import { notifyGroup } from "@/lib/push";
import { isPlanActive, loadActivePlans, planVoters, stepOutcome } from "@/lib/planWindow";
import { requireMember } from "@/lib/session";
import { LIMITS, cleanText, isId, readJson, safeLink } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Paso 2 de "comida en 2 pasos": cuando los dos ya votaron el tipo de comida,
// eligen a mano que restaurantes entran a la votacion de "¿Dónde comemos?".
// Los que agregan escritos a mano se pueden guardar tambien en Sitios.
export async function POST(request) {
  const auth = await requireMember(request);
  if (auth.error) return auth.error;
  const { gid, uid: person, group, members } = auth;
  const { planId, stepId, restaurants } = await readJson(request);
  if (!isId(planId) || !isId(stepId)) {
    return NextResponse.json({ error: "Este plan ya no está activo" }, { status: 400 });
  }

  const plan = await kv.get(gk(gid, "plan", planId));
  if (!plan || !isPlanActive(plan)) {
    return NextResponse.json({ error: "Este plan ya no está activo" }, { status: 400 });
  }

  const typeStep = plan.steps.find((s) => s.id === stepId);
  if (!typeStep || typeStep.kind !== "comida-tipo") {
    return NextResponse.json({ error: "Esa categoría no es de comida en 2 pasos" }, { status: 400 });
  }

  const typeVotes = (await kv.hgetall(gk(gid, "votes", planId, stepId))) || {};
  const typeOutcome = stepOutcome(typeStep, typeVotes, planVoters(plan, members));
  if (!typeOutcome.allVoted) {
    return NextResponse.json({ error: "Primero tiene que decidirse el tipo de comida" }, { status: 400 });
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
    const genVotes = (await kv.hgetall(gk(gid, "votes", planId, existingGen.id))) || {};
    if (Object.keys(genVotes).length > 0) {
      return NextResponse.json(
        { error: "Ya empezaron a votar el restaurante; no se puede cambiar la lista" },
        { status: 400 }
      );
    }
  }

  // Los restaurantes nuevos se guardan con el tipo de comida que gano.
  const winnerId = typeOutcome.winners[0]?.id;
  const foodType = FOOD_TYPES.some((f) => f.key === winnerId) ? winnerId : "otro";

  const now = Date.now();
  await Promise.all(
    clean.map((r, i) => {
      if (r.placeId || !r.save) return null;
      const id = `place${now}${i}`;
      r.placeId = id;
      return Promise.all([
        kv.set(gk(gid, "place", id), {
          id,
          name: r.name,
          group: "comida",
          category: foodType,
          ...(r.link ? { link: r.link } : {}),
          createdBy: person,
          createdAt: new Date().toISOString(),
        }),
        kv.lpush(gk(gid, "places"), id),
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

  await kv.set(gk(gid, "plan", planId), { ...plan, steps });

  const name = (await getUser(person))?.name || "Alguien";
  await notifyGroup(group, members, person, {
    title: `🍽️ ${mealInfo(typeStep.meal)?.where || "¿Dónde comemos?"}`,
    body: `${name} eligió los restaurantes. ¡Ve a votar!`,
  });

  return NextResponse.json(await loadActivePlans(gid, members));
}
