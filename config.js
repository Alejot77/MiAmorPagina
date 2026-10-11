// Nombres de las dos personas que pueden votar.
// Cambia estos valores si quieren usar otros nombres o apodos.
export const PEOPLE = ["Stefanny", "Alejandro"];

// Un color de acento por persona, en el mismo orden que PEOPLE.
export const PERSON_COLORS = ["#ef7096", "#e45757"];

// Texto del menu de perfil ("Planeando juntos desde ...").
export const TOGETHER_SINCE = "diciembre de 2023";

// Categorias disponibles para armar un plan (comida, actividad, etc).
// "key" se guarda en la base de datos; label/emoji/question son solo de UI.
export const CATEGORIES = [
  { key: "comida", label: "Comida", emoji: "🍽️", question: "¿Qué comemos?", description: "Tipos de comida para votar" },
  { key: "actividad", label: "Actividad", emoji: "🎯", question: "¿Qué hacemos?", description: "Ideas para pasar el día" },
  { key: "bebida", label: "Bebidas", emoji: "🥤", question: "¿Qué tomamos?", description: "Bebidas para elegir juntos" },
  { key: "juego", label: "Entretenimiento", emoji: "🎬", question: "¿Qué vemos o jugamos?", description: "Películas, series o juegos" },
  { key: "lugar", label: "Lugar", emoji: "📍", question: "¿A dónde vamos?", description: "Lugares para votar" },
  { key: "otro", label: "Otro", emoji: "✨", question: "¿Qué más?", description: "Una categoría hecha por ustedes" },
];

export function categoryInfo(key) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
}

// Tipos de comida del flujo de 2 pasos (tipo -> restaurante) y de los sitios
// de comida. El "key" tambien se guarda como tipo de comida de cada sitio.
// "otro" va al final: es el respaldo de foodTypeInfo.
export const FOOD_TYPES = [
  { key: "hamburguesa", label: "Hamburguesa", emoji: "🍔" },
  { key: "pizza", label: "Pizza", emoji: "🍕" },
  { key: "arepas", label: "Arepas", emoji: "🫓" },
  { key: "sushi", label: "Sushi", emoji: "🍣" },
  { key: "burritos", label: "Burritos", emoji: "🌯" },
  { key: "pollo", label: "Pollo", emoji: "🍗" },
  { key: "pasta", label: "Pasta", emoji: "🍝" },
  { key: "mexicana", label: "Mexicana", emoji: "🌮" },
  { key: "saludable", label: "Saludable", emoji: "🥗" },
  { key: "papas", label: "Papas", emoji: "🍟" },
  { key: "otro", label: "Otro", emoji: "🍽️" },
];

export function foodTypeInfo(key) {
  return FOOD_TYPES.find((f) => f.key === key) || FOOD_TYPES[FOOD_TYPES.length - 1];
}

// Grupos de la pantalla de Sitios. Los sitios de "comida" ademas tienen un
// tipo de comida (FOOD_TYPES) para recomendarlos en la votacion.
export const PLACE_GROUPS = [
  { key: "comida", label: "Comida", emoji: "🍽️", color: "peach" },
  { key: "cafe", label: "Café", emoji: "☕", color: "cream" },
  { key: "drinks", label: "Drinks", emoji: "🍸", color: "pink" },
  { key: "actividades", label: "Actividades", emoji: "🎳", color: "blue" },
];

export function placeGroupInfo(key) {
  return PLACE_GROUPS.find((g) => g.key === key) || PLACE_GROUPS[0];
}

// Sistema de puntos: cada categoria agregada a un plan suma puntos a quien la
// armo. Al llegar a DESSERT_THRESHOLD, el otro le debe un postre.
export const POINTS_PER_CATEGORY = 10;
export const DESSERT_THRESHOLD = 100;
