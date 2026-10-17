"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "./ui";

// Visita guiada: oscurece la pantalla, ilumina una parte real de la app y
// explica que hace. Se puede saltar en cualquier paso (boton o tecla Esc).

type Step = { target?: string; emoji: string; title: string; text: string };

type Box = { top: number; left: number; width: number; height: number };

const pad = 8;
const gap = 12;

function findTarget(selector?: string) {
  if (!selector) return null;
  for (const sel of selector.split("|")) {
    const el = document.querySelector(sel.trim());
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || Boolean(a && b && Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1);

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
    { target: ".hero | .empty-page h1 | .page h1", emoji: "🗳️", title: "Votar en secreto", text: "En Finde están los planes activos. Nadie ve los votos hasta que votan todos; gana la opción con más votos." },
    { target: ".roulette-fab", emoji: "🎡", title: "La ruleta", text: "¿No se deciden o hay empate? La ruleta elige por ustedes." },
    { target: ".bottom-nav .nav-item:nth-of-type(2)", emoji: "📍", title: "Sitios", text: "Guarden sus restaurantes y lugares favoritos para usarlos rápido en las votaciones." },
    { target: ".bottom-nav .nav-item:nth-last-of-type(2)", emoji: "📸", title: "Historial", text: "Los planes que ya pasaron, el calendario, las fotos de cada salida y el resumen de cada mes." },
    { target: ".bottom-nav .nav-item:last-of-type", emoji: "🏆", title: "Cuenta", text: "Invita a la sala con un código o enlace, mira el ranking de puntos y el premio, y ajusta tu tema y tus avisos." },
    { emoji: "🎉", title: "¡Listo!", text: "Ya conoces lo principal. ¿Empezamos?" },
  ];
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Box | null>(null);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});
  const cardRef = useRef<HTMLDivElement>(null);
  const safeRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  // Si el elemento no se ve completo, se lleva a la pantalla.
  useLayoutEffect(() => {
    const el = findTarget(step.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center" });
  }, [index]);

  // Ubica la luz y la tarjeta. Se vuelve a medir mientras la visita esta
  // abierta: la pagina puede moverse (carga de datos, teclado, giro, barra
  // del navegador del celular).
  useLayoutEffect(() => {
    let prevRect: Box | null = null;
    let prevCard = "";
    const update = () => {
      const el = findTarget(step.target);
      const r = el ? el.getBoundingClientRect() : null;
      const next = r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      if (!sameBox(prevRect, next)) { prevRect = next; setRect(next); }

      // Zona segura (sin la muesca ni la barra de inicio del iPhone).
      const safe = safeRef.current?.getBoundingClientRect();
      const minTop = (safe?.top ?? 0) + 12;
      const maxBottom = (safe?.bottom ?? window.innerHeight) - 12;
      const cardH = cardRef.current?.offsetHeight ?? 220;
      let style: CSSProperties = {};
      if (next) {
        const above = next.top - pad - gap - minTop;
        const below = maxBottom - (next.top + next.height + pad + gap);
        let top: number;
        if (below >= cardH) top = next.top + next.height + pad + gap;
        else if (above >= cardH) top = next.top - pad - gap - cardH;
        else top = below >= above ? maxBottom - cardH : minTop; // no cabe: encima del elemento, pero visible
        style = { top: Math.max(minTop, Math.min(top, maxBottom - cardH)) };
      }
      const key = JSON.stringify(style);
      if (key !== prevCard) { prevCard = key; setCardStyle(style); }
    };
    update();
    const timer = window.setInterval(update, 250);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
    };
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

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Visita guiada">
      <div className="tour-safe" ref={safeRef} aria-hidden="true" />
      {rect ? (
        <div
          className="tour-spot"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div ref={cardRef} className={`tour-card ${rect ? "anchored" : "centered"}`} style={rect ? cardStyle : undefined}>
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
