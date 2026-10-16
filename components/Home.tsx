"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Option, Place, Plan, PlanVotes, Step, StepVotes, VotesByPlan } from "./types";
import { Avatar, AvatarStack, Button, Icon, Pill } from "./ui";
import { memberName, namesList } from "./members";
import {
  categoryTitle, stepEmoji, dayMonthUpper, generatedStep, isPlanComplete, optionEmoji, rangeLabel,
  rootSteps, stepResult, terminalStep, todayStr, upcomingSaturday, weekdayUpper, addDays,
} from "./planUtils";

export type HomeActions = {
  vote: (plan: Plan, step: Step) => void;
  chooseRestaurants: (plan: Plan, typeStep: Step) => void;
  planActions: (plan: Plan) => void;
  addCategory: (plan: Plan) => void;
  openPlace: (placeId: string) => void;
  roulette: (options: string[]) => void;
  photos: (plan: Plan) => void;
  closeVote: (plan: Plan, step: Step) => void;
  canClose: (plan: Plan) => boolean; // quien creo el plan o un admin
};

// Quien voto y quien falta. Con 2 personas, nombre por nombre; con mas,
// los avatares (los que faltan, apagados) y "3 de 5 votaron".
function VoteStatus({ step, votes, person }: { step: Step; votes: StepVotes; person: string }) {
  const r = stepResult(step, votes, person);
  if (r.voters.length <= 2) {
    return (
      <div className="vote-status">
        {r.voters.map((id) => {
          const voted = Boolean(votes[id]);
          const me = id === person;
          const text = me ? (voted ? "Ya votaste" : "Falta tu voto") : voted ? `${memberName(id)} votó` : `Falta ${memberName(id)}`;
          return <span key={id} className={voted ? "voted" : "waiting"}><Avatar id={id} small /> {text}</span>;
        })}
      </div>
    );
  }
  return (
    <div className="vote-status many">
      <span className="vote-avatars">
        {r.voters.map((id) => <span key={id} className={votes[id] ? "voted" : "waiting"}><Avatar id={id} small /></span>)}
      </span>
      <span>{r.votedCount} de {r.voters.length} votaron{r.canVote && !r.myVote ? " · falta tu voto" : ""}</span>
    </div>
  );
}

// Quien eligio al ganador: "por los dos", "por todos" o "por mayoria".
function DecidedBy({ step, votes, verb = "Elegido" }: { step: Step; votes: StepVotes; verb?: string }) {
  const r = stepResult(step, votes);
  const winner = r.winners[0]?.id;
  const chose = r.voters.filter((id) => votes[id] === winner);
  const label = r.unanimous
    ? `${verb} por ${r.voters.length === 2 ? "los dos" : "todos"}`
    : `Ganó por mayoría${r.closed ? " · votación cerrada" : ""}`;
  return (
    <div className="decided-by">
      <AvatarStack ids={chose} small /> {label}
    </div>
  );
}

function OptionNames({ step, options }: { step: Step; options: Option[] }) {
  return <>{options.map((o) => `${optionEmoji(step, o)} ${o.name}`.trim()).join(" o ")}</>;
}

function PlanCategory({ emoji, title, children, last = false }: { emoji: string; title: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={`timeline-item ${last ? "last" : ""}`}>
      <div className="timeline-track"><span /></div>
      <div className="timeline-content">
        <div className="item-title"><span className="category-emoji">{emoji}</span><strong>{title}</strong></div>
        {children}
      </div>
    </div>
  );
}

// Votacion en curso, empate o resultado de un paso "normal" (sin 2 pasos).
function StepBody({ plan, step, votes, person, places, actions, voteLabel = "Votar ahora", pendingPill = "Votación en curso" }: {
  plan: Plan; step: Step; votes: StepVotes; person: string; places: Place[]; actions: HomeActions; voteLabel?: string; pendingPill?: string;
}) {
  const r = stepResult(step, votes, person);
  if (!r.allVoted) {
    return (
      <>
        <Pill tone="amber">{pendingPill}</Pill>
        <p className="poll-question">{step.question}</p>
        <VoteStatus step={step} votes={votes} person={person} />
        {r.canVote ? (
          <Button onClick={() => actions.vote(plan, step)} className="full">{r.myVote ? "Cambiar mi voto" : voteLabel}</Button>
        ) : (
          <p className="tie-note">Este plan se creó antes de que llegaras: podrás votar en los próximos.</p>
        )}
        {r.voters.length > 2 && r.votedCount > 0 && r.missing.length > 0 && actions.canClose(plan) && (
          <button className="text-link close-vote" onClick={() => actions.closeVote(plan, step)}>
            <Icon name="check" size={15} /> Cerrar votación ({r.votedCount} de {r.voters.length})
          </button>
        )}
      </>
    );
  }
  if (r.tie) {
    return (
      <>
        <Pill tone="amber">Empate</Pill>
        <p className="decision-name"><OptionNames step={step} options={r.winners} /></p>
        <p className="tie-note">{r.voters.length === 2 ? "Cada uno eligió algo distinto." : "Hay empate entre las más votadas."}</p>
        <div className="category-actions">
          {!r.closed && r.canVote && <button className="text-link" onClick={() => actions.vote(plan, step)}>Cambiar mi voto <Icon name="chevron" size={16} /></button>}
          <button className="text-link" onClick={() => actions.roulette(r.winners.map((o) => o.name))}>Desempatar con ruleta <Icon name="chevron" size={16} /></button>
        </div>
      </>
    );
  }
  const winner = r.winners[0];
  const place = winner.placeId ? places.find((p) => p.id === winner.placeId) : undefined;
  return (
    <>
      <Pill tone="green"><Icon name="check" size={12} /> Listo</Pill>
      <p className="decision-name">{`${optionEmoji(step, winner)} ${winner.name}`.trim()}</p>
      {place?.area && <p className="meta"><Icon name="pin" size={15} /> {place.area}</p>}
      <DecidedBy step={step} votes={votes} />
      <div className="category-actions">
        {place && <button className="text-link" onClick={() => actions.openPlace(place.id)}>Ver detalles <Icon name="chevron" size={16} /></button>}
        {winner.link && <a className="text-link" href={winner.link} target="_blank" rel="noopener noreferrer">Abrir link <Icon name="chevron" size={16} /></a>}
        <button className="text-link" onClick={() => actions.vote(plan, step)}>Ver votación <Icon name="chevron" size={16} /></button>
      </div>
    </>
  );
}

// Comida en 2 pasos: primero el tipo, despues el restaurante (elegido a mano).
function FoodBody({ plan, step, votes, person, places, actions }: {
  plan: Plan; step: Step; votes: PlanVotes; person: string; places: Place[]; actions: HomeActions;
}) {
  const type = stepResult(step, votes[step.id], person);
  if (!type.allVoted) {
    return <StepBody plan={plan} step={step} votes={votes[step.id] || {}} person={person} places={places} actions={actions} />;
  }
  const gen = generatedStep(plan, step);
  const typeName = <OptionNames step={step} options={type.winners} />;
  if (!gen) {
    return (
      <>
        <Pill tone={type.tie ? "amber" : "green"}>{type.tie ? "Empate" : <><Icon name="check" size={12} /> Decidido</>}</Pill>
        <p className="decision-name">{typeName}</p>
        {type.tie ? <p className="tie-note">Pueden poner restaurantes de los tipos empatados en la votación.</p> : <DecidedBy step={step} votes={votes[step.id] || {}} verb="Decidido" />}
        <div className="next-food-step">
          <span>Ahora falta elegir dónde 👀</span>
          <Button onClick={() => actions.chooseRestaurants(plan, step)}><Icon name="pin" size={17} /> Elegir restaurantes</Button>
        </div>
        {type.tie && type.canVote && <button className="text-link" onClick={() => actions.vote(plan, step)}>Cambiar mi voto <Icon name="chevron" size={16} /></button>}
      </>
    );
  }
  const genVotes = votes[gen.id] || {};
  const genResult = stepResult(gen, genVotes, person);
  if (!genResult.allVoted) {
    return (
      <>
        <p className="decision-name">{typeName}</p>
        <StepBody plan={plan} step={gen} votes={genVotes} person={person} places={places} actions={actions} voteLabel="Votar restaurante" pendingPill="Segunda votación" />
        {Object.keys(genVotes).length === 0 && (
          <button className="text-link" onClick={() => actions.chooseRestaurants(plan, step)}>Cambiar restaurantes <Icon name="chevron" size={16} /></button>
        )}
      </>
    );
  }
  return (
    <>
      <p className="decision-name">{typeName}</p>
      <StepBody plan={plan} step={gen} votes={genVotes} person={person} places={places} actions={actions} />
    </>
  );
}

function summaryText(plan: Plan, step: Step, votes: PlanVotes) {
  const final = terminalStep(plan, step);
  const r = stepResult(final, votes[final.id]);
  if (step.kind === "comida-tipo" && final === step) {
    const t = stepResult(step, votes[step.id]);
    if (!t.allVoted) return "Votación en curso";
    return `${t.winners.map((o) => o.name).join(" o ")} · Falta elegir restaurante`;
  }
  if (!r.allVoted) {
    return r.missing.length > 0 && r.missing.length <= 2 ? `Falta el voto de ${namesList(r.missing)}` : `${r.votedCount} de ${r.voters.length} votaron`;
  }
  if (r.tie) return `Empate: ${r.winners.map((o) => o.name).join(" o ")}`;
  return `${r.winners[0].name} ✓`;
}

function DayPlan({ plan, votes, person, places, actions }: { plan: Plan; votes: PlanVotes; person: string; places: Place[]; actions: HomeActions }) {
  const complete = isPlanComplete(plan, votes);
  const [collapsed, setCollapsed] = useState(complete);
  useEffect(() => {
    if (complete) setCollapsed(true);
  }, [complete]);
  const steps = rootSteps(plan);

  return (
    <>
      <div className="day-heading-row">
        <button className="day-heading" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
          <span>{weekdayUpper(plan.weekend)}</span>
          <span>· {dayMonthUpper(plan.weekend)}</span>
          <i className={collapsed ? "" : "expanded"}><Icon name="chevron" size={18} /></i>
        </button>
        {plan.weekend <= todayStr() && (
          <button className="day-actions" onClick={() => actions.photos(plan)} aria-label="Fotos del día"><Icon name="camera" /></button>
        )}
        <button className="day-actions" onClick={() => actions.planActions(plan)} aria-label="Opciones del plan"><Icon name="dots" /></button>
      </div>
      <div className={`day-accordion ${collapsed ? "collapsed" : ""}`}>
        <div className="day-accordion-inner">
          {collapsed ? (
            <div className="day-summary">
              {steps.map((s) => (
                <div key={s.id}>
                  <span>{stepEmoji(s)}</span>
                  <p><strong>{categoryTitle(s)}</strong><small>{summaryText(plan, s, votes)}</small></p>
                </div>
              ))}
            </div>
          ) : (
            <>
              {steps.map((s, i) => (
                <PlanCategory key={s.id} emoji={stepEmoji(s)} title={categoryTitle(s)} last={i === steps.length - 1}>
                  {s.kind === "comida-tipo" ? (
                    <FoodBody plan={plan} step={s} votes={votes} person={person} places={places} actions={actions} />
                  ) : (
                    <StepBody plan={plan} step={s} votes={votes[s.id] || {}} person={person} places={places} actions={actions} />
                  )}
                </PlanCategory>
              ))}
              <Button variant="ghost" className="day-add-category" onClick={() => actions.addCategory(plan)}>
                <Icon name="plus" size={17} /> Agregar una categoría
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export function Home({ plans, votes, person, places, actions }: { plans: Plan[]; votes: VotesByPlan; person: string; places: Place[]; actions: HomeActions }) {
  return (
    <main className="page home-page">
      <section className="hero">
        <div>
          <span className="eyebrow">{rangeLabel(plans.map((p) => p.weekend))}</span>
          <h1>Nuestro finde <span className="heart">♥</span></h1>
          <p>Esto es lo que estamos decidiendo juntos.</p>
        </div>
      </section>
      <section className="agenda">
        {plans.map((plan) => (
          <DayPlan key={plan.id} plan={plan} votes={votes[plan.id] || {}} person={person} places={places} actions={actions} />
        ))}
      </section>
    </main>
  );
}

export function EmptyHome({ onCreate, onRepeat, canRepeat }: { onCreate: () => void; onRepeat: () => void; canRepeat: boolean }) {
  const saturday = upcomingSaturday();
  return (
    <main className="page empty-page">
      <span className="eyebrow">PRÓXIMO FINDE · {rangeLabel([saturday, addDays(saturday, 1)])}</span>
      <h1>Nuestro finde <span className="heart">♥</span></h1>
      <div className="big-empty-art"><span>☁️</span><span>☀️</span><div className="blank-card">?</div></div>
      <h2>Este finde todavía está en blanco</h2>
      <p>Empiecen con una idea y decidan el resto juntos.</p>
      <Button onClick={onCreate}><Icon name="sparkles" size={18} /> Crear nuestro finde</Button>
      {canRepeat && <Button variant="ghost" onClick={onRepeat}>Repetir un plan favorito</Button>}
    </main>
  );
}
