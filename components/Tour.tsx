"use client";

import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { Button } from "./ui";

// Visita guiada: oscurece la pantalla, ilumina una parte real de la app y
// explica que hace. Se puede saltar en cualquier paso (boton o tecla Esc).

type Step = { target?: string; emoji: string; title: string; text: string };

const pad = 8;

function findTarget(selector?: string) {
  if (!selector) return null;
  for (const sel of selector.split("|")) {
    const el = document.querySelector(sel.trim());
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return r;
    }
  }
  return null;
}

export default function Tour({ groupName, onSkip, onDone, onInvite, onCreate }: {
  groupName: string;
  onSkip: () => void;
  onDone: () => void;
  onInvite: () => void;
  onCreate: () => void;
}) {
  const steps: Step[] = [
    { emoji: "👋", title: `¡Bienvenido a «${groupName}»!`, text: "Te muestro en un minuto todo lo que pueden hacer aquí. Puedes saltar la visita cuando quieras." },
    { target: ".group-switch", emoji: "🏠", title: "Tus salas", text: "Aquí ves en qué sala estás. Tócalo para cambiar de sala, crear otra o unirte con un código." },
    { target: ".create-button", emoji: "➕", title: "Armar un plan", text: "Eliges el día y qué quieren decidir: comida (desayuno, almuerzo o cena), actividad, bebida, a dónde ir… y las opciones para votar." },
    { target: ".hero | .empty-page | .page h1", emoji: "🗳️", title: "Votar en secreto", text: "En Finde están los planes activos. Nadie ve los votos hasta que votan todos; gana la opción con más votos." },
    { target: ".roulette-fab", emoji: "🎡", title: "La ruleta", text: "¿No se deciden o hay empate? La ruleta elige por ustedes." },
    { target: ".bottom-nav .nav-item:nth-of-type(2)", emoji: "📍", title: "Sitios", text: "Guarden sus restaurantes y lugares favoritos para usarlos rápido en las votaciones." },
    { target: ".bottom-nav .nav-item:nth-last-of-type(2)", emoji: "📸", title: "Historial", text: "Los planes que ya pasaron, el calendario, las fotos de cada salida y el resumen de cada mes." },
    { target: ".bottom-nav .nav-item:last-of-type", emoji: "🏆", title: "Cuenta", text: "Invita a la sala con un código o enlace, mira el ranking de puntos y el premio, y ajusta tu tema y tus avisos." },
    { emoji: "🎉", title: "¡Listo!", text: "Ya conoces lo principal. ¿Empezamos?" },
  ];
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  // Posicion del elemento iluminado (y al girar el celular / cambiar tamaño).
  useLayoutEffect(() => {
    const update = () => setRect(findTarget(step.target));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      if (e.key === "ArrowRight" && !last) setIndex((i) => i + 1);
      if (e.key === "ArrowLeft" && index > 0) setIndex((i) => i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, last]);

  // La tarjeta va debajo del elemento si esta arriba en la pantalla, y
  // encima si esta abajo (barra de navegacion, ruleta).
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardStyle: CSSProperties = !rect
    ? {}
    : rect.top + rect.height / 2 < vh / 2
      ? { top: Math.min(rect.bottom + pad + 12, vh - 260) }
      : { bottom: Math.max(vh - rect.top + pad + 12, 16) };

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Visita guiada">
      {rect ? (
        <div
          className="tour-spot"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div className={`tour-card ${rect ? "anchored" : "centered"}`} style={cardStyle}>
        <div className="tour-top">
          <span className="tour-count">{index + 1} de {steps.length}</span>
          {!last && <button className="tour-skip" onClick={onSkip}>Saltar visita</button>}
        </div>
        <span className="tour-emoji">{step.emoji}</span>
        <strong>{step.title}</strong>
        <p>{step.text}</p>
        <div className="tour-dots">{steps.map((_, i) => <i key={i} className={i === index ? "on" : ""} />)}</div>
        {last ? (
          <div className="tour-actions final">
            <Button onClick={onInvite}>💌 Invitar a alguien</Button>
            <Button variant="secondary" onClick={onCreate}>➕ Armar el primer plan</Button>
            <Button variant="ghost" onClick={onDone}>Ahora no</Button>
          </div>
        ) : (
          <div className="tour-actions">
            {index > 0 ? <Button variant="ghost" onClick={() => setIndex(index - 1)}>Atrás</Button> : <span />}
            <Button onClick={() => setIndex(index + 1)}>{index === 0 ? "Empezar" : "Siguiente"}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
