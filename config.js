// Nombres de las dos personas que pueden votar.
// Cambia estos valores si quieren usar otros nombres o apodos.
export const PEOPLE = ["Stefanny", "Alejandro"];

// Un color de acento por persona, en el mismo orden que PEOPLE.
export const PERSON_COLORS = ["#ff7d9c", "#5a9e97"];

// Categorias disponibles para armar un plan (comida, actividad, etc).
// "key" se guarda en la base de datos; label/emoji/question son solo de UI.
export const CATEGORIES = [
  { key: "comida", label: "Comida", emoji: "🍽️", question: "¿Qué comemos?" },
  { key: "actividad", label: "Actividad", emoji: "🎯", question: "¿Qué hacemos?" },
  { key: "bebida", label: "Bebida", emoji: "🥤", question: "¿Qué tomamos?" },
  { key: "juego", label: "Juego", emoji: "🎲", question: "¿A qué jugamos?" },
  { key: "lugar", label: "Lugar", emoji: "📍", question: "¿Dónde estamos?" },
  { key: "otro", label: "Otro", emoji: "✨", question: "¿Qué más?" },
];

export function categoryInfo(key) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
}

