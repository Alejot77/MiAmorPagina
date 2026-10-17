"use client";

import { UPDATES } from "@/config";
import { Button, Modal } from "./ui";

type Update = (typeof UPDATES)[number];

// Mensaje de novedades despues de una actualizacion.
export default function WhatsNew({ update, name, close, onSeeGroups }: {
  update: Update;
  name: string;
  close: () => void;
  onSeeGroups: () => void;
}) {
  return (
    <Modal close={close}>
      <div className="whats-new">
        <span className="whats-new-badge">✨ NOVEDADES</span>
        <h2>Hola, {name} 💜</h2>
        <strong className="whats-new-title">{update.title}</strong>
        <p className="whats-new-intro">{update.intro}</p>
        <ul className="whats-new-list">
          {update.items.map((item) => (
            <li key={item.title}>
              <span>{item.emoji}</span>
              <div><strong>{item.title}</strong><small>{item.text}</small></div>
            </li>
          ))}
        </ul>
        <Button className="full" onClick={close}>¡Entendido!</Button>
        <Button variant="ghost" className="full" onClick={onSeeGroups}>Ver mis salas</Button>
      </div>
    </Modal>
  );
}
