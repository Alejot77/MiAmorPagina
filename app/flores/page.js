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
];

// Racimos de flores repartidos por el universo, algunos con una frase al lado.
const CLUSTERS = [
  {
    left: "8%",
    top: "14%",
    label: "Te Amo",
    delay: "0s",
    duration: "8s",
    flowers: [
      { dx: 0, dy: 0, size: 30, rotate: -8 },
      { dx: 16, dy: 8, size: 22, rotate: 10 },
      { dx: -10, dy: 14, size: 18, rotate: 4 },
    ],
  },
  {
    left: "80%",
    top: "10%",
    label: "Eres mi sol",
    delay: "1.1s",
    duration: "9s",
    flowers: [
      { dx: 0, dy: 0, size: 26, rotate: 6 },
      { dx: -14, dy: 10, size: 18, rotate: -12 },
    ],
  },
  {
    left: "4%",
    top: "52%",
    label: null,
    delay: "0.5s",
    duration: "7s",
    flowers: [
      { dx: 0, dy: 0, size: 22, rotate: 0 },
      { dx: 12, dy: 10, size: 16, rotate: 14 },
    ],
  },
  {
    left: "86%",
    top: "46%",
    label: "Eres preciosa",
    delay: "1.6s",
    duration: "8.5s",
    flowers: [
      { dx: 0, dy: 0, size: 28, rotate: -6 },
      { dx: 15, dy: 9, size: 20, rotate: 8 },
      { dx: -8, dy: 16, size: 16, rotate: -4 },
    ],
  },
  {
    left: "12%",
    top: "80%",
    label: "Siempre juntos",
    delay: "0.8s",
    duration: "9.5s",
    flowers: [
      { dx: 0, dy: 0, size: 24, rotate: 4 },
      { dx: 14, dy: 8, size: 18, rotate: -8 },
    ],
  },
  {
    left: "82%",
    top: "78%",
    label: "Me encantas",
    delay: "1.9s",
    duration: "7.5s",
    flowers: [
      { dx: 0, dy: 0, size: 30, rotate: -4 },
      { dx: -16, dy: 9, size: 20, rotate: 10 },
      { dx: 10, dy: 15, size: 16, rotate: 4 },
    ],
  },
  {
    left: "46%",
    top: "88%",
    label: "Amor de mi vida",
    delay: "1.3s",
    duration: "8.2s",
    flowers: [
      { dx: 0, dy: 0, size: 22, rotate: 6 },
      { dx: 14, dy: 6, size: 16, rotate: -6 },
    ],
  },
  {
    left: "62%",
    top: "18%",
    label: "Eres único",
    delay: "0.3s",
    duration: "9.2s",
    flowers: [
      { dx: 0, dy: 0, size: 20, rotate: -10 },
      { dx: 12, dy: 8, size: 14, rotate: 6 },
    ],
  },
  {
    left: "30%",
    top: "6%",
    label: null,
    delay: "2.1s",
    duration: "6.8s",
    flowers: [{ dx: 0, dy: 0, size: 18, rotate: 0 }],
  },
  {
    left: "95%",
    top: "62%",
    label: null,
    delay: "0.9s",
    duration: "7.8s",
    flowers: [{ dx: 0, dy: 0, size: 16, rotate: 10 }],
  },
  {
    left: "2%",
    top: "30%",
    label: null,
    delay: "1.5s",
    duration: "8.8s",
    flowers: [{ dx: 0, dy: 0, size: 16, rotate: -6 }],
  },
];

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

const WREATH_COUNT = 30;
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
