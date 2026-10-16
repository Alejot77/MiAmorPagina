"use client";

import { useState, type ReactNode } from "react";
import type { HistoryEntry, Plan, PlanVotes, RecapList } from "./types";
import { PhotosSection } from "./Photos";
import { RecapCards } from "./Recap";
import { api } from "./api";
import { Button, ConfirmDialog, Icon, Modal, Pill } from "./ui";
import { categoryTitle, stepEmoji, dayMonthUpper, memoryTitle, monthUpper, parseDate, rootSteps, stepResult, terminalStep, weekdayUpper } from "./planUtils";

function decisions(plan: Plan, votes: PlanVotes) {
  return rootSteps(plan).map((s) => {
    const final = terminalStep(plan, s);
    const r = stepResult(final, votes[final.id]);
    const text = !r.allVoted ? "Sin decidir" : r.tie ? `Empate: ${r.winners.map((o) => o.name).join(" o ")}` : r.winners[0].name;
    return { id: s.id, emoji: stepEmoji(s), label: categoryTitle(s), text, decided: r.allVoted && !r.tie };
  });
}

export function History({ entries, onOpen, recap, onOpenRecap, calendar }: {
  entries: HistoryEntry[];
  calendar?: ReactNode;
  onOpen: (planId: string) => void;
  recap: RecapList | null;
  onOpenRecap: (month: string) => void;
}) {
  const sorted = [...entries].sort((a, b) => (a.plan.weekend < b.plan.weekend ? 1 : -1));
  const months: { key: string; label: string; items: HistoryEntry[] }[] = [];
  for (const e of sorted) {
    const key = e.plan.weekend.slice(0, 7);
    let group = months.find((m) => m.key === key);
    if (!group) {
      group = { key, label: monthUpper(e.plan.weekend), items: [] };
      months.push(group);
    }
    group.items.push(e);
  }

  return (
    <main className="page history-page">
      <span className="eyebrow">NUESTRA HISTORIA</span>
      <h1>Fines para recordar</h1>
      <p className="lead">Los planes pasan. Los recuerdos se quedan.</p>
      {calendar}
      <RecapCards list={recap} onOpen={onOpenRecap} />
      {months.length === 0 && (
        <div className="empty-history">
          <strong>Todavía no hay recuerdos</strong>
          Cada plan pasa aquí el martes después de su fecha.
        </div>
      )}
      {months.map((m) => (
        <div key={m.key}>
          <div className="memory-month"><span>{m.label}</span><i /></div>
          {m.items.map(({ plan, votes }) =>
            plan.favorite ? (
              <button key={plan.id} className="featured-memory" onClick={() => onOpen(plan.id)} style={{ marginBottom: 12 }}>
                <div className="memory-photo">
                  <span>{parseDate(plan.weekend).getDate()}</span>
                  <small>{weekdayUpper(plan.weekend)}</small>
                  <div className="photo-shapes"><i /><i /><i /></div>
                </div>
                <div className="memory-copy">
                  <Pill tone="pink">FAVORITO</Pill>
                  <h2>{memoryTitle(plan, votes)}</h2>
                  <div className="memory-icons">
                    {decisions(plan, votes).filter((d) => d.decided).slice(0, 3).map((d) => <span key={d.id}>{d.emoji} {d.text}</span>)}
                  </div>
                  {plan.memoryNote && <blockquote>“{plan.memoryNote}”</blockquote>}
                  <span className="text-link">Ver recuerdo <Icon name="chevron" size={16} /></span>
                </div>
              </button>
            ) : (
              <button key={plan.id} className="memory-row" onClick={() => onOpen(plan.id)}>
                <div className="date-tile"><strong>{parseDate(plan.weekend).getDate()}</strong><span>{dayMonthUpper(plan.weekend).split(" ")[1]}</span></div>
                <div>
                  <strong>{memoryTitle(plan, votes)}</strong>
                  <p>{rootSteps(plan).map((s) => stepEmoji(s)).join(" ")} · {rootSteps(plan).length} {rootSteps(plan).length === 1 ? "decisión" : "decisiones"}</p>
                </div>
                <Icon name="chevron" />
              </button>
            )
          )}
        </div>
      ))}
    </main>
  );
}

export function MemoryDetail({ entry, person, close, onRepeat, onChanged, onDeleted }: {
  entry: HistoryEntry;
  person: string;
  close: () => void;
  onRepeat: (plan: Plan) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { plan, votes } = entry;
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(plan.memoryNote || "");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const items = decisions(plan, votes);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await api("/api/memory", "PATCH", { planId: plan.id, person, ...body });
      setEditing(false);
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api("/api/plan", "DELETE", { planId: plan.id, person });
      onDeleted();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <Modal close={close} full>
      <div className="memory-detail">
        <div className="memory-detail-art">
          <button className="icon-button floating" onClick={close} aria-label="Volver"><Icon name="arrow" /></button>
          <div className="memory-date-big">
            <span>{weekdayUpper(plan.weekend)}</span>
            <strong>{parseDate(plan.weekend).getDate()}</strong>
            <small>{monthUpper(plan.weekend)}</small>
          </div>
          <span className="art-emoji">{items.map((i) => i.emoji).slice(0, 3).join(" ")}</span>
        </div>
        <div className="memory-detail-copy">
          <Pill tone="pink">{plan.favorite ? "UN CLÁSICO DE USTEDES" : "UN PLAN DE USTEDES"}</Pill>
          <h1>{memoryTitle(plan, votes)}</h1>
          {items.map((i) => (
            <div className="memory-plan" key={i.id}><span>{i.emoji}</span><p><strong>{i.text}</strong>{i.label}</p></div>
          ))}
          {editing ? (
            <div className="memory-note-editor">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="¿Qué quieren recordar de este día?" autoFocus />
              <Button onClick={() => patch({ note })} disabled={busy}>{busy ? "Guardando..." : "Guardar nota"}</Button>
              <Button variant="ghost" onClick={() => { setNote(plan.memoryNote || ""); setEditing(false); }}>Cancelar</Button>
            </div>
          ) : (
            plan.memoryNote && <blockquote>“{plan.memoryNote}”</blockquote>
          )}
          <PhotosSection planId={plan.id} person={person} hint="Suban las fotos de este día: aparecen en el resumen del mes." />
          {error && <p className="form-error">{error}</p>}
          <Button className="full" onClick={() => onRepeat(plan)}><Icon name="sparkles" size={18} /> Repetir este finde</Button>
          {!editing && (
            <Button variant="secondary" className="full" onClick={() => setEditing(true)}>
              <Icon name="note" size={18} /> {plan.memoryNote ? "Editar la nota" : "Agregar una nota"}
            </Button>
          )}
          <Button variant="ghost" className="full" onClick={() => patch({ favorite: !plan.favorite })} disabled={busy}>
            <Icon name="heart" size={18} /> {plan.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
          </Button>
          <button className="destructive-link" onClick={() => setConfirm(true)}>Eliminar del historial</button>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          title="¿Eliminar este recuerdo?"
          message="Se borran el plan, sus votos y sus fotos. No se puede deshacer."
          confirmLabel="Eliminar"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirm(false)}
        />
      )}
    </Modal>
  );
}
