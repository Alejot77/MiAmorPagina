"use client";

import type { ReactNode } from "react";
import { initialOf } from "./planUtils";

export type IconName =
  | "home" | "calendar" | "pin" | "clock" | "plus" | "dots" | "chevron" | "check" | "heart"
  | "sparkles" | "sliders" | "flower" | "roulette" | "arrow" | "star" | "close" | "note" | "map"
  | "edit" | "trash" | "logout" | "mail" | "camera";

const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  dots: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  heart: <path d="M20.8 5.7a5.5 5.5 0 0 0-7.8 0L12 6.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z" />,
  sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" /><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 13l.8 2.2L8 16l-2.2.8L5 19l-.8-2.2L2 16l2.2-.8L5 13Z" /></>,
  sliders: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="7" cy="18" r="2" /></>,
  flower: <><circle cx="12" cy="12" r="2" /><circle cx="12" cy="6" r="3" /><circle cx="18" cy="12" r="3" /><circle cx="12" cy="18" r="3" /><circle cx="6" cy="12" r="3" /></>,
  roulette: <><circle cx="12" cy="12" r="8" /><path d="m12 4 3 8-3 8-3-8 3-8Zm-8 8h16" /></>,
  arrow: <path d="m15 18-6-6 6-6" />,
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  note: <><path d="M5 3h11l3 3v15H5Z" /><path d="M15 3v5h4M8 12h8M8 16h6" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15m6-12v15" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13 7 4 4" /></>,
  trash: <><path d="M4 7h16M10 11v6m4-6v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  logout: <><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4Z" /><circle cx="12" cy="13" r="3.5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export function Avatar({ person, small = false }: { person: string; small?: boolean }) {
  const initial = initialOf(person);
  return <span className={`avatar avatar-${initial} ${small ? "avatar-small" : ""}`}>{person[0]}</span>;
}

export function Button({
  children,
  variant = "primary",
  onClick,
  className = "",
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "soft";
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} className={`btn btn-${variant} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Pill({ children, tone = "lavender" }: { children: ReactNode; tone?: "lavender" | "green" | "amber" | "pink" }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function PointsProgress({ points, goal, person }: { points: number; goal: number; person: string }) {
  const active = Math.min(10, Math.floor((points / Math.max(goal, 1)) * 10));
  return (
    <div className={`points-progress points-${initialOf(person)}`} aria-label={`${points} de ${goal} puntos`}>
      {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < active ? "active" : ""} />)}
    </div>
  );
}

export function Modal({ children, close, full = false }: { children: ReactNode; close: () => void; full?: boolean }) {
  return (
    <div className={`modal-backdrop ${full ? "modal-full" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="bottom-sheet">
        <div className="sheet-handle" />
        {children}
      </section>
    </div>
  );
}

export function SheetHeader({ eyebrow, title, subtitle, close }: { eyebrow: string; title: ReactNode; subtitle?: string; close: () => void }) {
  return (
    <div className="sheet-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <button className="icon-button" onClick={close} aria-label="Cerrar"><Icon name="close" /></button>
    </div>
  );
}

// Dialogo de confirmacion con el estilo del diseno (reemplaza window.confirm).
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className="confirm-backdrop">
      <div className="confirm-dialog">
        <span className="menu-icon pink">!</span>
        <h2>{title}</h2>
        <p>{message}</p>
        <div>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Button>
          <button className="confirm-destructive" onClick={onConfirm} disabled={busy}>{busy ? "Un momento..." : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
