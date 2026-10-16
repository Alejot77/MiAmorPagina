"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { Photo, RecapEntry, RecapList } from "./types";
import { api } from "./api";
import { AvatarStack, Button, Icon } from "./ui";
import { getMembers, memberName } from "./members";
import { PhotoViewer } from "./Photos";
import { memoryTitle, optionEmoji, stepEmoji, parseDate, rootSteps, stepResult, terminalStep, weekdayUpper } from "./planUtils";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const SLIDE_MS = 6500;

export const monthLabel = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1];
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const shortDay = (date: string) => `${weekdayUpper(date).slice(0, 3)} ${parseDate(date).getDate()}`;

type Pick = { id: string; category: string; emoji: string; name: string; date: string };

// Convierte los planes del mes en lo que cuentan las historias.
function buildRecap(entries: RecapEntry[]) {
  const picks: Pick[] = [];
  let decided = 0;
  let ties = 0;
  for (const { plan, votes } of entries) {
    for (const s of rootSteps(plan)) {
      const final = terminalStep(plan, s);
      const r = stepResult(final, votes[final.id]);
      if (!r.allVoted) continue;
      if (r.tie) {
        ties++;
        continue;
      }
      decided++;
      let emoji = stepEmoji(s);
      if (s.kind === "comida-tipo") {
        const type = stepResult(s, votes[s.id]);
        if (type.winners.length === 1) emoji = optionEmoji(s, type.winners[0]) || emoji;
      }
      picks.push({ id: `${plan.id}-${s.id}`, category: s.category, emoji, name: r.winners[0].name, date: plan.weekend });
    }
  }

  const photos = entries.flatMap((e) => e.photos.map((p) => ({ ...p, date: e.plan.weekend })));
  const creatorIds = [...new Set(entries.map((e) => e.plan.createdBy))];
  const creators = creatorIds.map((id) => ({ person: id, count: entries.filter((e) => e.plan.createdBy === id).length }))
    .sort((a, b) => b.count - a.count);
  const counts: Record<string, { pick: Pick; n: number }> = {};
  for (const p of picks) {
    const key = p.name.trim().toLowerCase();
    counts[key] = counts[key] ? { ...counts[key], n: counts[key].n + 1 } : { pick: p, n: 1 };
  }
  const repeated = Object.values(counts).filter((c) => c.n > 1).sort((a, b) => b.n - a.n)[0] || null;
  const favorite = entries.find((e) => e.plan.favorite) || entries.find((e) => e.plan.memoryNote) || null;

  return {
    outings: entries.length,
    decided,
    ties,
    agreement: decided + ties > 0 ? Math.round((decided / (decided + ties)) * 100) : null,
    food: picks.filter((p) => p.category === "comida"),
    did: picks.filter((p) => ["actividad", "juego", "lugar"].includes(p.category)),
    drinks: picks.filter((p) => ["bebida", "otro"].includes(p.category)),
    photos,
    creators,
    repeated,
    favorite,
  };
}

type Slide = { key: string; tone: string; ms?: number; body: ReactNode };

function PickList({ items }: { items: Pick[] }) {
  return (
    <ul className="recap-list">
      {items.slice(0, 6).map((p) => (
        <li key={p.id}><span>{p.emoji}</span><strong>{p.name}</strong><small>{shortDay(p.date)}</small></li>
      ))}
      {items.length > 6 && <li className="more">y {items.length - 6} más…</li>}
    </ul>
  );
}

function Polaroids({ photos }: { photos: Photo[] }) {
  return (
    <div className="recap-polaroids">
      {photos.slice(0, 3).map((p, i) => <img key={p.id} src={p.url} alt="" className={`p${i}`} />)}
    </div>
  );
}

export function RecapStories({ month, close }: { month: string; close: () => void }) {
  const [entries, setEntries] = useState<RecapEntry[] | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const pressAt = useRef(0);

  useEffect(() => {
    api<{ entries: RecapEntry[] }>(`/api/recap?month=${month}`)
      .then((j) => setEntries(j.entries))
      .catch((err) => setError(err.message));
  }, [month]);

  const name = monthLabel(month);
  const year = month.slice(0, 4);
  const nextName = monthLabel(`${month.slice(0, 5)}${String((Number(month.slice(5, 7)) % 12) + 1).padStart(2, "0")}`);

  const slides: Slide[] = [];
  // Se calcula una sola vez por mes (no en cada pausa o cambio de historia).
  const recap = useMemo(() => (entries ? buildRecap(entries) : null), [entries]);
  if (recap) {
    const r = recap;
    slides.push({
      key: "cover",
      tone: "cover",
      body: (
        <>
          {r.photos.length > 0 && <Polaroids photos={r.photos} />}
          <span className="recap-eyebrow">SU RESUMEN DE</span>
          <h1 className="recap-month">{capital(name)}</h1>
          <span className="recap-year">{year}</span>
          <div className="recap-pair"><AvatarStack ids={getMembers().map((m) => m.id)} max={6} /></div>
          <p className="recap-tap">Toca para empezar →</p>
        </>
      ),
    });
    slides.push({
      key: "numbers",
      tone: "numbers",
      body: (
        <>
          <span className="recap-eyebrow">{name.toUpperCase()} EN NÚMEROS</span>
          <div className="recap-big"><strong>{r.outings}</strong><span>{r.outings === 1 ? "salida juntos" : "salidas juntos"}</span></div>
          <div className="recap-stats">
            <span><strong>{r.decided}</strong>{r.decided === 1 ? "decisión" : "decisiones"}</span>
            {r.agreement !== null && <span><strong>{r.agreement}%</strong>de acuerdo</span>}
            {r.photos.length > 0 && <span><strong>{r.photos.length}</strong>{r.photos.length === 1 ? "foto" : "fotos"}</span>}
          </div>
          {r.ties > 0 && <p className="recap-foot">Y {plural(r.ties, "empate", "empates")} que tocó resolver 😅</p>}
        </>
      ),
    });
    if (r.food.length > 0) {
      slides.push({
        key: "food",
        tone: "food",
        body: (
          <>
            <span className="recap-emoji">🍽️</span>
            <span className="recap-eyebrow">DÓNDE COMIERON</span>
            <h2>{r.food.length === 1 ? "Un antojo que valió la pena" : `${r.food.length} antojos cumplidos`}</h2>
            <PickList items={r.food} />
          </>
        ),
      });
    }
    if (r.did.length > 0) {
      slides.push({
        key: "did",
        tone: "did",
        body: (
          <>
            <span className="recap-emoji">🎯</span>
            <span className="recap-eyebrow">QUÉ HICIERON</span>
            <h2>{r.did.length === 1 ? "Un plan para recordar" : "Planes para recordar"}</h2>
            <PickList items={r.did} />
          </>
        ),
      });
    }
    if (r.drinks.length > 0) {
      slides.push({
        key: "drinks",
        tone: "drinks",
        body: (
          <>
            <span className="recap-emoji">🥂</span>
            <span className="recap-eyebrow">Y PARA BRINDAR</span>
            <h2>Lo que acompañó el mes</h2>
            <PickList items={r.drinks} />
          </>
        ),
      });
    }
    if (r.favorite) {
      const fav = r.favorite;
      const favPhoto = fav.photos[0];
      slides.push({
        key: "favorite",
        tone: "favorite",
        body: (
          <>
            <span className="recap-eyebrow">{fav.plan.favorite ? "SU FAVORITO DEL MES" : "UN RECUERDO DEL MES"}</span>
            {favPhoto ? <img className="recap-fav-photo" src={favPhoto.url} alt="" /> : <span className="recap-emoji">💜</span>}
            <h2>{memoryTitle(fav.plan, fav.votes)}</h2>
            <p className="recap-date">{capital(weekdayUpper(fav.plan.weekend).toLowerCase())} {parseDate(fav.plan.weekend).getDate()} de {name}</p>
            {fav.plan.memoryNote && <blockquote>“{fav.plan.memoryNote}”</blockquote>}
          </>
        ),
      });
    }
    if (r.photos.length > 0) {
      const shown = r.photos.slice(0, 9);
      slides.push({
        key: "photos",
        tone: "photos",
        ms: 9000,
        body: (
          <>
            <span className="recap-eyebrow">PHOTODUMP</span>
            <h2>{capital(name)} en fotos</h2>
            <div className={`recap-dump n${Math.min(shown.length, 9)}`}>
              {shown.map((p, i) => (
                <div key={p.id}>
                  <img src={p.url} alt="" draggable={false} />
                  {i === shown.length - 1 && r.photos.length > shown.length && <span>+{r.photos.length - shown.length}</span>}
                </div>
              ))}
            </div>
            <button
              className="recap-see-photos"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => { setPaused(true); setViewing(0); }}
            >
              <Icon name="camera" size={16} /> Ver {r.photos.length === 1 ? "la foto" : `las ${r.photos.length} fotos`} en grande
            </button>
          </>
        ),
      });
    }
    const facts: string[] = [];
    const top = r.creators[0];
    if (top && top.count > 0 && top.count !== r.creators[1]?.count) facts.push(`${memberName(top.person)} propuso ${top.count} de ${r.outings} ${r.outings === 1 ? "plan" : "planes"} 🙋`);
    else if (top && top.count > 0) facts.push(`${r.creators.length === 2 ? "Los dos propusieron" : "Varios propusieron"} la misma cantidad de planes 🤝`);
    if (r.repeated) facts.push(`${r.repeated.pick.emoji} ${r.repeated.pick.name} se repitió ${r.repeated.n} veces`);
    if (r.agreement === 100 && r.decided > 1) facts.push("Coincidieron en todo. Cero empates 💘");
    if (facts.length > 0) {
      slides.push({
        key: "facts",
        tone: "facts",
        body: (
          <>
            <span className="recap-emoji">✨</span>
            <span className="recap-eyebrow">DATOS CURIOSOS</span>
            <ul className="recap-facts">{facts.map((f) => <li key={f}>{f}</li>)}</ul>
          </>
        ),
      });
    }
    slides.push({
      key: "end",
      tone: "end",
      body: (
        <>
          <div className="recap-pair"><AvatarStack ids={getMembers().map((m) => m.id)} max={6} /></div>
          <h2>Gracias por {name} 💜</h2>
          <p className="recap-date">Nos vemos en {nextName}.</p>
          <div className="recap-actions" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <Button onClick={() => setIndex(0)}><Icon name="sparkles" size={17} /> Ver otra vez</Button>
            <Button variant="ghost" onClick={close}>Cerrar</Button>
          </div>
        </>
      ),
    });
  }

  const slide = slides[index];
  const last = index === slides.length - 1;
  const go = (i: number) => setIndex(Math.max(0, Math.min(slides.length - 1, i)));

  // Tocar a la izquierda vuelve, a la derecha avanza; mantener presionado pausa.
  const onDown = () => { pressAt.current = Date.now(); setPaused(true); };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    setPaused(false);
    if (Date.now() - pressAt.current > 300) return;
    const rect = e.currentTarget.getBoundingClientRect();
    go(e.clientX - rect.left < rect.width / 3 ? index - 1 : index + 1);
  };

  const allPhotos = recap?.photos || [];

  return (
    <div className="recap-screen">
      {!entries ? (
        <div className="recap-slide tone-cover">
          <button className="recap-close" onClick={close} aria-label="Cerrar"><Icon name="close" /></button>
          <div className="recap-body"><p className="recap-tap">{error || "Armando su resumen…"}</p></div>
        </div>
      ) : (
        <div className={`recap-slide tone-${slide.tone}`} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => setPaused(false)}>
          <div className="recap-bars">
            {slides.map((s, i) => (
              <span key={s.key}>
                <i
                  key={`${s.key}-${index}`}
                  className={i < index ? "done" : i === index ? "run" : ""}
                  style={i === index ? { animationDuration: `${s.ms || SLIDE_MS}ms`, animationPlayState: paused || viewing !== null ? "paused" : "running" } : undefined}
                  onAnimationEnd={() => !last && go(index + 1)}
                />
              </span>
            ))}
          </div>
          <button className="recap-close" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={close} aria-label="Cerrar"><Icon name="close" /></button>
          <div className="recap-body" key={slide.key}>{slide.body}</div>
        </div>
      )}
      {viewing !== null && (
        <PhotoViewer photos={allPhotos} index={viewing} onIndex={setViewing} close={() => { setViewing(null); setPaused(false); }} />
      )}
    </div>
  );
}

// Tarjetas del Historial: el ultimo resumen listo, los anteriores y el que viene.
export function RecapCards({ list, onOpen }: { list: RecapList | null; onOpen: (month: string) => void }) {
  if (!list || (list.months.length === 0 && !list.upcoming)) return null;
  const [latest, ...older] = list.months;
  return (
    <div className="recap-cards">
      {latest && (
        <button className="recap-card" onClick={() => onOpen(latest.month)}>
          <span className="recap-card-emoji">🎁</span>
          <span>
            <small>RESUMEN DEL MES</small>
            <strong>{capital(monthLabel(latest.month))} {latest.month.slice(0, 4)}</strong>
            <em>{plural(latest.plans, "salida", "salidas")}{latest.photos > 0 ? ` · ${plural(latest.photos, "foto", "fotos")}` : ""}</em>
          </span>
          <Icon name="chevron" />
        </button>
      )}
      {older.length > 0 && (
        <div className="recap-older">
          {older.map((m) => (
            <button key={m.month} onClick={() => onOpen(m.month)}>{capital(monthLabel(m.month))} {m.month.slice(2, 4) !== latest.month.slice(2, 4) ? `’${m.month.slice(2, 4)}` : ""}</button>
          ))}
        </div>
      )}
      {list.upcoming && (
        <p className="recap-upcoming">
          📅 El resumen de {monthLabel(list.upcoming.month)} se abre el 1 de {monthLabel(list.upcoming.opensOn.slice(0, 7))} · {plural(list.upcoming.plans, "plan", "planes")} hasta ahora
        </p>
      )}
    </div>
  );
}
