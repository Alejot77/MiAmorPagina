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

const FLOWERS = [
  { left: "6%", top: "12%", size: 34, delay: "0s", duration: "7s" },
  { left: "18%", top: "68%", size: 22, delay: "1.2s", duration: "9s" },
  { left: "28%", top: "30%", size: 44, delay: "0.4s", duration: "8s" },
  { left: "40%", top: "80%", size: 18, delay: "2s", duration: "6s" },
  { left: "50%", top: "15%", size: 30, delay: "0.8s", duration: "10s" },
  { left: "60%", top: "55%", size: 26, delay: "1.6s", duration: "7.5s" },
  { left: "70%", top: "20%", size: 40, delay: "0.2s", duration: "9s" },
  { left: "80%", top: "70%", size: 20, delay: "2.4s", duration: "8.5s" },
  { left: "88%", top: "35%", size: 32, delay: "1s", duration: "6.5s" },
  { left: "10%", top: "45%", size: 24, delay: "1.8s", duration: "8s" },
  { left: "35%", top: "58%", size: 16, delay: "0.6s", duration: "7s" },
  { left: "55%", top: "85%", size: 28, delay: "2.2s", duration: "9.5s" },
  { left: "75%", top: "48%", size: 22, delay: "1.4s", duration: "7s" },
  { left: "92%", top: "10%", size: 26, delay: "0.3s", duration: "8s" },
  { left: "22%", top: "8%", size: 20, delay: "1.1s", duration: "6.8s" },
  { left: "45%", top: "40%", size: 36, delay: "0.9s", duration: "9.2s" },
];

function Flower({ size }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} fill="none">
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <ellipse
          key={angle}
          cx="32"
          cy="18"
          rx="10"
          ry="16"
          fill="#f4c430"
          opacity="0.9"
          transform={`rotate(${angle} 32 32)`}
        />
      ))}
      <circle cx="32" cy="32" r="8" fill="#8a5a1f" />
    </svg>
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

      {FLOWERS.map((f, i) => (
        <span
          key={i}
          className="flores-flower"
          style={{
            left: f.left,
            top: f.top,
            animationDelay: f.delay,
            animationDuration: f.duration,
          }}
        >
          <Flower size={f.size} />
        </span>
      ))}

      <div className="flores-content">
        <p className="flores-eyebrow">21 de septiembre 🌼</p>
        <h1 className="flores-title">Tu universo de flores amarillas</h1>
        <p key={quoteIndex} className="flores-quote">
          {QUOTES[quoteIndex]}
        </p>
      </div>
    </main>
  );
}
