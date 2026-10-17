// Cada persona tiene su cuenta y puede estar en varias salas (pareja,
// amigos, familia...). Los nombres los escribe cada quien al registrarse.

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

// Para que comida es la encuesta de "Comida" (opcional: sin elegir queda
// como "Comida"). "what" es la pregunta del tipo de comida y "where" la del
// restaurante.
export const MEALS = [
  { key: "desayuno", label: "Desayuno", emoji: "🥐", what: "¿Qué desayunamos?", where: "¿Dónde desayunamos?" },
  { key: "almuerzo", label: "Almuerzo", emoji: "🍛", what: "¿Qué almorzamos?", where: "¿Dónde almorzamos?" },
  { key: "cena", label: "Cena", emoji: "🌙", what: "¿Qué cenamos?", where: "¿Dónde cenamos?" },
];

export function mealInfo(key) {
  return MEALS.find((m) => m.key === key) || null;
}

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

// Temas de color que cada persona puede elegir en Ajustes. `preview` pinta
// la tarjeta de muestra; `meta` es el color de la barra del celular.
export const THEMES = [
  { id: "lila", name: "Lila", dark: false, meta: "#f8f5fc", preview: ["#f8f5fc", "#ffffff", "#7446d7", "#ef7096"] },
  { id: "rosa", name: "Rosa", dark: false, meta: "#fdf6f8", preview: ["#fdf6f8", "#ffffff", "#d6457a", "#f4c878"] },
  { id: "oceano", name: "Océano", dark: false, meta: "#f5f9fe", preview: ["#f5f9fe", "#ffffff", "#2f6fd6", "#9cc3f5"] },
  { id: "lila-noche", name: "Lila noche", dark: true, meta: "#110d19", preview: ["#110d19", "#1d1727", "#a57cf5", "#f07fa3"] },
  { id: "rojo-noche", name: "Rojo noche", dark: true, meta: "#150b0d", preview: ["#150b0d", "#221417", "#ef4f58", "#f0a95a"] },
  { id: "azul-noche", name: "Azul noche", dark: true, meta: "#080d16", preview: ["#080d16", "#141d2b", "#5b9bf5", "#f0b45a"] },
];

// Tema de una cuenta nueva mientras no elija otro.
export const DEFAULT_THEME = "lila";

export function themeInfo(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function defaultThemeFor() {
  return DEFAULT_THEME;
}

// Nombre del grupo (se ve en el encabezado y en el login). Lo pueden
// cambiar los dos desde Cuenta.
export const DEFAULT_GROUP_NAME = "Plan de dos";
export const GROUP_NAME_MAX = 40;

// Novedades: al entrar despues de una actualizacion, cada cuenta ve una vez
// la mas reciente (queda marcada como vista en su cuenta). Para anunciar
// algo nuevo, agrega una entrada AL FINAL con un id distinto. "before": solo
// la ven las cuentas creadas antes de esa fecha (a quien llega despues no le
// es "nuevo").
export const UPDATES = [
  {
    id: "2026-10-salas",
    before: "2026-10-17T05:00:00.000Z",
    title: "¡Plan de dos se agrandó!",
    intro: "Ahora la app no es solo para ustedes dos: pueden armar salas con amigos o con la familia. Sus planes, fotos, sitios y puntos siguen intactos en su sala de siempre.",
    items: [
      { emoji: "🏠", title: "Salas", text: "Toca el nombre de la sala arriba para cambiar de sala o crear una nueva." },
      { emoji: "💌", title: "Invita con un enlace", text: "En Cuenta → Invitar a la sala hay un código y un enlace para compartir." },
      { emoji: "🔑", title: "Entras con tu correo", text: "Cuando la app te pida la clave, usa tu correo y la misma clave de siempre." },
      { emoji: "🗳️", title: "Votaciones en grupo", text: "En salas grandes, quien crea el plan puede cerrar la votación si alguien no vota." },
      { emoji: "🏆", title: "Puntos por sala", text: "Cada sala tiene su ranking y su propio premio." },
    ],
  },
];

export function pendingUpdate(user) {
  const latest = UPDATES[UPDATES.length - 1];
  if (!latest || !user || user.seenUpdate === latest.id) return null;
  if (latest.before && user.createdAt && user.createdAt >= latest.before) return null;
  return latest;
}
