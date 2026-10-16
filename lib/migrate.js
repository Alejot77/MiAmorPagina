import { kv } from "@/lib/kv";
import { addMember, createGroup, gk } from "@/lib/groups";
import { claimEmail, newId, saveUser } from "@/lib/users";
import { DEFAULT_GROUP_NAME } from "@/config";

// Paso de "dos personas fijas" (Stefanny y Alejandro, datos globales) a
// cuentas y salas. Corre sola la primera vez que alguien abre la version
// nueva y deja todo en la sala "Plan de dos":
// - una cuenta por persona con su misma clave, correo, tema y avisos;
// - planes, votos, fotos, sitios y puntos copiados bajo g:<sala>:...;
// - las sesiones abiertas siguen sirviendo (legacy-person:<nombre> -> cuenta).
// No borra nada de lo viejo: queda como respaldo.

const LEGACY_PEOPLE = ["Stefanny", "Alejandro"];
const LEGACY_COLORS = { Stefanny: "#ef7096", Alejandro: "#e45757" };
const LEGACY_THEMES = { Stefanny: "lila", Alejandro: "rojo-noche" };
const FLAG = "migration:salas";

let done = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function ensureMigrated() {
  if (done) return;
  if ((await kv.get(FLAG)) === "done") {
    done = true;
    return;
  }
  const legacyAuth = await Promise.all(LEGACY_PEOPLE.map((p) => kv.get(`auth:${p}`)));
  const hasLegacy = legacyAuth.some(Boolean) || (await kv.llen("plans")) > 0;
  if (!hasLegacy) {
    await kv.set(FLAG, "done");
    done = true;
    return;
  }
  // Una sola peticion migra; las demas esperan a que termine.
  if (!(await kv.set(`${FLAG}:lock`, Date.now(), { nx: true, ex: 120 }))) {
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      if ((await kv.get(FLAG)) === "done") {
        done = true;
        return;
      }
    }
    throw new Error("Estamos actualizando la app. Intenta de nuevo en unos segundos.");
  }
  try {
    await migrate(legacyAuth);
    await kv.set(FLAG, "done");
    done = true;
  } finally {
    await kv.del(`${FLAG}:lock`);
  }
}

async function migrate(legacyAuth) {
  const now = new Date().toISOString();
  const gid = newId("g");

  // ---------- Cuentas ----------
  const uids = {};
  for (let i = 0; i < LEGACY_PEOPLE.length; i++) {
    const name = LEGACY_PEOPLE[i];
    const auth = legacyAuth[i];
    if (!auth) continue;
    const uid = newId("u");
    uids[name] = uid;
    const theme = await kv.get(`theme:${name}`);
    const user = {
      id: uid,
      name,
      color: LEGACY_COLORS[name],
      salt: auth.salt,
      hash: auth.hash,
      ...(auth.email ? { email: auth.email } : {}),
      ...(auth.pendingEmail ? { pendingEmail: auth.pendingEmail } : {}),
      theme: typeof theme === "string" ? theme : LEGACY_THEMES[name],
      pinned: [gid],
      lastGroup: gid,
      ...(name === "Stefanny" ? { flowers: true } : {}),
      createdAt: now,
    };
    await saveUser(user);
    if (auth.email) await claimEmail(auth.email, uid);
    if (auth.pendingEmail) await claimEmail(auth.pendingEmail, uid);
    if (!auth.email && !auth.pendingEmail) await claimEmail(name, uid); // sin correo: entra con su nombre
    await kv.set(`legacy-person:${name}`, uid);
    const subs = (await kv.hgetall(`push:${name}`)) || {};
    if (Object.keys(subs).length > 0) await kv.hset(`push:${uid}`, subs);
  }
  const map = (name) => uids[name] || name;
  const members = Object.values(uids);
  if (members.length === 0) return;

  // ---------- Sala ----------
  const [groupName, ppc, threshold] = await Promise.all([
    kv.get("settings:group_name"),
    kv.get("settings:points_per_category"),
    kv.get("settings:dessert_threshold"),
  ]);
  await createGroup({
    name: typeof groupName === "string" && groupName.trim() ? groupName : DEFAULT_GROUP_NAME,
    uid: members[0],
    extra: {
      id: gid,
      admins: members,
      createdAt: "2023-12-01T12:00:00.000Z", // "Planeando juntos desde diciembre de 2023"
      settings: {
        ...(Number.isInteger(ppc) && ppc > 0 ? { pointsPerCategory: ppc } : {}),
        ...(Number.isInteger(threshold) && threshold > 0 ? { dessertThreshold: threshold } : {}),
      },
    },
  });
  for (const uid of members.slice(1)) await addMember(gid, uid);

  // ---------- Planes, votos y fotos ----------
  const planIds = ((await kv.lrange("plans", 0, -1)) || []).map(String);
  const plans = planIds.length ? (await kv.mget(...planIds.map((id) => `plan:${id}`))) || [] : [];
  for (let i = 0; i < planIds.length; i++) {
    const plan = plans[i];
    if (!plan) continue;
    const id = planIds[i];
    const copy = {
      ...plan,
      createdBy: map(plan.createdBy),
      ...(plan.updatedBy ? { updatedBy: map(plan.updatedBy) } : {}),
      voters: members,
    };
    await kv.set(gk(gid, "plan", id), copy);
    await kv.rpush(gk(gid, "plans"), id);
    await Promise.all(
      plan.steps.map(async (step) => {
        const votes = (await kv.hgetall(`votes:${id}:${step.id}`)) || {};
        const mapped = Object.fromEntries(Object.entries(votes).map(([name, opt]) => [map(name), opt]));
        if (Object.keys(mapped).length) await kv.hset(gk(gid, "votes", id, step.id), mapped);
      })
    );
    const photos = (await kv.hgetall(`photos:${id}`)) || {};
    const mappedPhotos = Object.fromEntries(
      Object.entries(photos).map(([pid, p]) => {
        const photo = typeof p === "string" ? JSON.parse(p) : p;
        return [pid, { ...photo, by: map(photo.by) }];
      })
    );
    if (Object.keys(mappedPhotos).length) await kv.hset(gk(gid, "photos", id), mappedPhotos);
  }

  // ---------- Sitios ----------
  const placeIds = ((await kv.lrange("places", 0, -1)) || []).map(String);
  const places = placeIds.length ? (await kv.mget(...placeIds.map((id) => `place:${id}`))) || [] : [];
  for (let i = 0; i < placeIds.length; i++) {
    if (!places[i]) continue;
    await kv.set(gk(gid, "place", placeIds[i]), { ...places[i], createdBy: map(places[i].createdBy) });
    await kv.rpush(gk(gid, "places"), placeIds[i]);
  }

  // ---------- Puntos ----------
  for (const [name, uid] of Object.entries(uids)) {
    const [points, desserts] = await Promise.all([kv.get(`points:${name}`), kv.get(`desserts:${name}`)]);
    if (points !== null) await kv.set(gk(gid, "points", uid), Number(points) || 0);
    if (desserts !== null) await kv.set(gk(gid, "desserts", uid), Number(desserts) || 0);
  }
  console.log(`[migracion] Sala ${gid}: ${members.length} cuentas, ${planIds.length} planes, ${placeIds.length} sitios`);
}
