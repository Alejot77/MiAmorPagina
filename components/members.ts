import type { Member } from "./types";

// Miembros de la sala abierta. Los votos, puntos y fotos guardan el id de
// la cuenta; de aqui salen el nombre y el color para mostrarlos. Se fija
// antes de pintar la sala (la vista se vuelve a montar al cambiar de sala).
let current: Member[] = [];

export function setMembers(list: Member[]) {
  current = list;
}

export function getMembers() {
  return current;
}

export function member(id: string): Member {
  return current.find((m) => m.id === id) || { id, name: "Alguien que ya no está", color: "#9a8fa6" };
}

export const memberName = (id: string) => member(id).name;

// "Ana", "Ana y Luis", "Ana, Luis y Sofi", "Ana, Luis y 3 más"
export function namesList(ids: string[], max = 3) {
  const names = ids.map(memberName);
  if (names.length <= 1) return names.join("");
  if (names.length <= max) return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  return `${names.slice(0, max - 1).join(", ")} y ${names.length - max + 1} más`;
}
