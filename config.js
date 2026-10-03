// Nombres de las dos personas que pueden votar.
// Cambia estos valores si quieren usar otros nombres o apodos.
export const PEOPLE = ["Stefanny", "Alejandro"];

// Un color de acento por persona, en el mismo orden que PEOPLE.
export const PERSON_COLORS = ["#ff7d9c", "#d6474f"];

// Clave opcional por persona, en el mismo orden que PEOPLE. Si la dejas
// vacia ("") esa persona entra sin pedir clave. Ojo: esto es solo una
// barrera liviana (el valor viaja en el codigo del navegador), no es
// seguridad real, pero alcanza para que no entren por error/curiosidad.
export const PERSON_PASSWORDS = ["", "1234"];

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

// Tipos de comida usados en el flujo de 2 pasos (tipo -> sitio) y en el
// catalogo de "Sitios". El "key" tambien se usa como categoria de los sitios.
export const FOOD_TYPES = [
  { key: "hamburguesa", label: "Hamburguesa", emoji: "🍔" },
  { key: "pizza", label: "Pizza", emoji: "🍕" },
  { key: "papas", label: "Papas", emoji: "🍟" },
  { key: "burritos", label: "Burritos", emoji: "🌯" },
  { key: "arepas", label: "Arepas", emoji: "🫓" },
  { key: "otro", label: "Otro", emoji: "🍽️" },
];

export function foodTypeInfo(key) {
  return FOOD_TYPES.find((f) => f.key === key) || FOOD_TYPES[FOOD_TYPES.length - 1];
}

// Sistema de puntos: cada categoria agregada a un plan suma puntos a quien la
// armo. Al llegar a DESSERT_THRESHOLD, el otro le debe un postre.
export const POINTS_PER_CATEGORY = 10;
export const DESSERT_THRESHOLD = 100;

