"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const QUOTES = [
  "Las flores amarillas te quedan bien, como te queda bien mi cariño.",
  "Hoy el universo se llenó de flores amarillas solo para ti.",
  "Cada pétalo amarillo es un motivo más para quererte.",
  "No hace falta un jardín entero: contigo cualquier día florece.",
  "21 de septiembre: el día perfecto para recordarte cuánto te quiero.",
  "Si las estrellas fueran flores, todas serían amarillas por ti.",
  "Gracias por llenar mis días de color, incluso los grises.",
  "Un ramo no alcanza para decirte todo lo que siento.",
  "Contigo hasta las cosas simples se sienten especiales.",
  "Eres mi lugar favorito en cualquier universo.",
  "Cada día contigo es un motivo más para sembrar flores amarillas.",
  "Te quiero en cada estación, no solo en primavera.",
  "Eres la razón por la que sonrío sin darme cuenta.",
  "Mi corazón encontró su jardín en ti.",
  "Contigo, hasta el cielo se llena de flores.",
  "Eres mi persona favorita en todas las galaxias.",
  "Quiero seguir llenando tu vida de flores amarillas por mucho tiempo.",
  "Tu risa es mi flor favorita de todo el universo.",
  "Gracias por elegirnos, un día a la vez.",
  "Eres el sol que hace florecer todo a tu paso.",
  "No importa el día, siempre voy a encontrar una razón para quererte.",
  "Contigo aprendí que el amor también se cultiva.",
  "Eres mi calma en medio de cualquier tormenta.",
  "Que este 21 de septiembre sea el primero de muchos más.",
];

// Frases cortas que acompañan algunos racimos de flores.
const LABELS = [
  "Te Amo",
  "Eres mi sol",
  "Eres preciosa",
  "Me encantas",
  "Siempre juntos",
  "Amor de mi vida",
  "Eres único",
  "Mi persona favorita",
  "Eres mi hogar",
  "Contigo todo es mejor",
  "Mi razón de sonreír",
  "Te elijo cada día",
  "Eres mi calma",
  "Mi lugar favorito eres tú",
  "Gracias por existir",
  "Eres mi persona",
  "Contigo hasta el fin",
  "Mi mejor equipo",
  "Eres mi paz",
  "Te quiero así, tal cual eres",
];

// Puntos repartidos por toda la pantalla donde crece cada racimo de flores.
const ANCHORS = [
  { left: "4%", top: "5%" },
  { left: "13%", top: "3%" },
  { left: "24%", top: "7%" },
  { left: "34%", top: "3%" },
  { left: "58%", top: "4%" },
  { left: "68%", top: "8%" },
  { left: "78%", top: "3%" },
  { left: "88%", top: "7%" },
  { left: "96%", top: "13%" },
  { left: "2%", top: "18%" },
  { left: "10%", top: "26%" },
  { left: "3%", top: "36%" },
  { left: "94%", top: "22%" },
  { left: "90%", top: "32%" },
  { left: "97%", top: "42%" },
  { left: "5%", top: "46%" },
  { left: "8%", top: "56%" },
  { left: "2%", top: "66%" },
  { left: "92%", top: "52%" },
  { left: "88%", top: "62%" },
  { left: "96%", top: "72%" },
  { left: "4%", top: "76%" },
  { left: "12%", top: "86%" },
  { left: "6%", top: "93%" },
  { left: "22%", top: "94%" },
  { left: "34%", top: "90%" },
  { left: "46%", top: "94%" },
  { left: "58%", top: "90%" },
  { left: "70%", top: "94%" },
  { left: "82%", top: "90%" },
  { left: "92%", top: "85%" },
  { left: "98%", top: "91%" },
  { left: "20%", top: "15%" },
  { left: "76%", top: "17%" },
  { left: "16%", top: "68%" },
  { left: "80%", top: "70%" },
  { left: "44%", top: "6%" },
  { left: "50%", top: "94%" },
  { left: "1%", top: "50%" },
  { left: "99%", top: "48%" },
];

// Genera muchos racimos de flores a partir de los puntos de arriba,
// variando tamaño, cantidad de flores y frase de forma determinista.
const CLUSTERS = ANCHORS.map((a, i) => {
  const flowerCount = (i % 3) + 1;
  const baseSize = 16 + ((i * 7) % 20);
  const flowers = Array.from({ length: flowerCount }, (_, j) => ({
    dx: j === 0 ? 0 : (j % 2 === 0 ? 1 : -1) * (10 + j * 5),
    dy: j === 0 ? 0 : 6 + j * 5,
    size: Math.max(12, baseSize - j * 6),
    rotate: ((i * 29 + j * 41) % 40) - 20,
  }));

  return {
    left: a.left,
    top: a.top,
    label: i % 2 === 0 ? LABELS[i % LABELS.length] : null,
    delay: `${(i % 10) * 0.3}s`,
    duration: `${7 + (i % 5)}s`,
    flowers,
  };
});

function FlowerIcon({ size, rotate = 0 }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <ellipse
          key={angle}
          cx="32"
          cy="18"
          rx="10"
          ry="16"
          fill="#f4c430"
          opacity="0.92"
          transform={`rotate(${angle} 32 32)`}
        />
      ))}
      <circle cx="32" cy="32" r="8" fill="#8a5a1f" />
    </svg>
  );
}

// Puntos de un corazón parametrico, usados para tejer la corona de flores.
function heartPoint(t, { cx = 100, cy = 72, scale = 4.3 } = {}) {
  const x = cx + scale * 16 * Math.pow(Math.sin(t), 3);
  const raw =
    13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  const y = cy - scale * raw;
  return { x, y };
}

const WREATH_COUNT = 42;
const wreathPoints = Array.from({ length: WREATH_COUNT }, (_, i) =>
  heartPoint((i / WREATH_COUNT) * Math.PI * 2)
);

const BOUQUET_FLOWERS = [
  { x: 100, y: 168, size: 44, rotate: 0 },
  { x: 80, y: 176, size: 34, rotate: -18 },
  { x: 120, y: 176, size: 34, rotate: 18 },
  { x: 68, y: 160, size: 26, rotate: -28 },
  { x: 132, y: 160, size: 26, rotate: 28 },
  { x: 90, y: 148, size: 24, rotate: -8 },
  { x: 110, y: 148, size: 24, rotate: 8 },
  { x: 58, y: 174, size: 20, rotate: -34 },
  { x: 142, y: 174, size: 20, rotate: 34 },
  { x: 100, y: 140, size: 20, rotate: 0 },
];

function FlowerG({ x, y, size, rotate = 0 }) {
  const s = size / 64;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}>
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <ellipse
          key={angle}
          cx="0"
          cy="-14"
          rx="10"
          ry="16"
          fill="#f4c430"
          opacity="0.92"
          transform={`rotate(${angle})`}
        />
      ))}
      <circle r="8" fill="#8a5a1f" />
    </g>
  );
}

function LeafG({ x, y, rotate = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <path d="M0 -9 C 6 -6, 6 6, 0 9 C -6 6, -6 -6, 0 -9 Z" fill="#7fae56" />
    </g>
  );
}

export default function FloresPage() {
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % QUOTES.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="flores-universe">
      <Link href="/" className="flores-back">
        ← Volver a las encuestas
      </Link>

      {CLUSTERS.map((c, i) => (
        <div
          key={i}
          className="flores-cluster"
          style={{ left: c.left, top: c.top, animationDelay: c.delay, animationDuration: c.duration }}
        >
          <div className="flores-cluster-flowers">
            {c.flowers.map((f, j) => (
              <span
                key={j}
                className="flores-cluster-flower"
                style={{ left: f.dx, top: f.dy }}
              >
                <FlowerIcon size={f.size} rotate={f.rotate} />
              </span>
            ))}
          </div>
          {c.label && <span className="flores-label">{c.label} 🤍</span>}
        </div>
      ))}

      <div className="flores-content">
        <p className="flores-eyebrow">21 de septiembre</p>

        <div className="flores-hero">
          <div className="flores-hero-glow" />
          <svg viewBox="0 0 200 220" className="flores-hero-svg">
            {wreathPoints.map((p, i) =>
              i % 2 === 0 ? (
                <FlowerG key={i} x={p.x} y={p.y} size={12} rotate={(i * 37) % 360} />
              ) : (
                <LeafG key={i} x={p.x} y={p.y} rotate={(i * 53) % 360} />
              )
            )}
            {BOUQUET_FLOWERS.map((f, i) => (
              <FlowerG key={i} x={f.x} y={f.y} size={f.size} rotate={f.rotate} />
            ))}
            <path d="M92 190 C 96 200, 104 200, 108 190 Z" fill="#e2b33c" />
          </svg>
        </div>

        <p className="flores-center-text">Mi Amor</p>

        <p key={quoteIndex} className="flores-quote">
          {QUOTES[quoteIndex]}
        </p>
      </div>
    </main>
  );
}
