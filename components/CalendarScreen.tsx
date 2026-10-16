"use client";

import { useState } from "react";
import type { Plan, PlanVotes } from "./types";
import { Button, Icon } from "./ui";
import { categoryTitle, stepEmoji, longDate, parseDate, rootSteps, shortDayUpper, stepResult, terminalStep, toDateStr, todayStr } from "./planUtils";

type Entry = { plan: Plan; votes: PlanVotes; active: boolean };

function statusText(plan: Plan, votes: PlanVotes, stepId: string) {
  const step = plan.steps.find((s) => s.id === stepId)!;
  const final = terminalStep(plan, step);
  const r = stepResult(final, votes[final.id]);
  if (step.kind === "comida-tipo" && final === step && r.allVoted) return `${r.winners.map((o) => o.name).join(" o ")} · falta el restaurante`;
  if (!r.allVoted) return "Votación en curso";
  if (r.tie) return `Empate: ${r.winners.map((o) => o.name).join(" o ")}`;
  return r.winners[0].name;
}

// `embedded`: va dentro de Historial (sin titulo de pagina y con el dia
// elegido como tarjeta).
export default function CalendarScreen({ entries, onCreateForDate, onOpenActive, onOpenMemory, embedded = false }: {
  entries: Entry[];
  embedded?: boolean;
  onCreateForDate: (date: string) => void;
  onOpenActive: () => void;
  onOpenMemory: (planId: string) => void;
}) {
  const today = todayStr();
  const [selected, setSelected] = useState(today);
  const start = parseDate(today);
  const [monthIndex, setMonthIndex] = useState(start.getFullYear() * 12 + start.getMonth());

  const monthDate = new Date(Math.floor(monthIndex / 12), monthIndex % 12, 1);
  const monthLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(monthDate);
  const title = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const firstWeekday = (monthDate.getDay() + 6) % 7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const days = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const planDates = new Set(entries.map((e) => e.plan.weekend));
  const dayEntries = entries.filter((e) => e.plan.weekend === selected);
  const categoryCount = dayEntries.reduce((n, e) => n + rootSteps(e.plan).length, 0);
  const Wrapper = embedded ? "section" : "main";

  return (
    <Wrapper className={embedded ? "calendar-embed" : "page calendar-page"}>
      {!embedded && <span className="eyebrow">NUESTRO TIEMPO</span>}
      <div className="title-row">
        {embedded ? <h2>{title}</h2> : <h1>{title}</h1>}
        <div>
          <button className="round-button" aria-label="Mes anterior" onClick={() => setMonthIndex(monthIndex - 1)}>‹</button>
          <button className="round-button" aria-label="Mes siguiente" onClick={() => setMonthIndex(monthIndex + 1)}>›</button>
        </div>
      </div>
      <div className="calendar">
        <div className="weekdays">{["L", "M", "X", "J", "V", "S", "D"].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="calendar-grid">
          {days.map((n, i) => {
            if (!n) return <span key={`empty-${i}`} />;
            const str = toDateStr(new Date(monthDate.getFullYear(), monthDate.getMonth(), n));
            const hasPlan = planDates.has(str);
            return (
              <button key={str} onClick={() => setSelected(str)} className={`calendar-day ${selected === str ? "selected" : ""} ${hasPlan ? "has-plan" : ""}`}>
                <span>{n}</span>{hasPlan && <i />}
              </button>
            );
          })}
        </div>
      </div>
      <section className={embedded ? "selected-date embedded" : "selected-date"}>
        {!embedded && <div className="sheet-handle" />}
        <div className="date-label">
          <div><span>{shortDayUpper(selected)}</span><strong>{parseDate(selected).getDate()}</strong></div>
          <div>
            <h2>{longDate(selected)}</h2>
            <p>{categoryCount > 0 ? `${categoryCount} ${categoryCount === 1 ? "decisión" : "decisiones"} para este día` : "Sin planes todavía"}</p>
          </div>
        </div>
        {dayEntries.length > 0 ? (
          <>
            <div className="mini-agenda">
              {dayEntries.flatMap((e) =>
                rootSteps(e.plan).map((s) => (
                  <div key={s.id}>
                    <span>{stepEmoji(s)}</span>
                    <p><strong>{categoryTitle(s)}</strong>{statusText(e.plan, e.votes, s.id)}</p>
                  </div>
                ))
              )}
            </div>
            {dayEntries.some((e) => e.active) ? (
              <Button variant="secondary" className="full" onClick={onOpenActive}>Ver en el finde <Icon name="chevron" size={16} /></Button>
            ) : (
              <Button variant="secondary" className="full" onClick={() => onOpenMemory(dayEntries[0].plan.id)}>Ver recuerdo <Icon name="chevron" size={16} /></Button>
            )}
          </>
        ) : selected >= today ? (
          <Button variant="secondary" className="full" onClick={() => onCreateForDate(selected)}><Icon name="plus" size={17} /> Agregar algo</Button>
        ) : null}
      </section>
    </Wrapper>
  );
}
