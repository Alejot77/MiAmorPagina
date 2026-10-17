export type Option = { id: string; name: string; link?: string; placeId?: string };

export type Step = {
  id: string;
  category: string;
  question: string;
  options: Option[];
  kind?: string; // "comida-tipo" | "comida-lugar"
  twoPhase?: boolean;
  generatedStepId?: string;
  generatedFrom?: string;
  meal?: string; // "desayuno" | "almuerzo" | "cena" (solo comida)
  voters?: string[]; // cuentas que votan (las manda el servidor)
  closed?: boolean; // votacion cerrada antes de que votaran todos
};

export type Plan = {
  id: string;
  weekend: string; // yyyy-mm-dd
  steps: Step[];
  createdBy: string;
  createdAt: string;
  favorite?: boolean;
  memoryNote?: string;
  voters?: string[];
};

export type StepVotes = Record<string, string>; // persona -> id de opcion
export type PlanVotes = Record<string, StepVotes>; // id de paso -> votos
export type VotesByPlan = Record<string, PlanVotes>; // id de plan -> votos

export type Place = {
  id: string;
  name: string;
  group: string; // PLACE_GROUPS
  category: string; // FOOD_TYPES (solo importa si group === "comida")
  link?: string;
  area?: string;
  note?: string;
  favorite?: boolean;
  visits: number;
};

export type PointsData = {
  points: Record<string, number>; // cuenta -> puntos
  desserts: Record<string, number>; // cuenta -> premios cobrados
  threshold: number;
  reward: string; // "postre", "cerveza"...
};

export type HistoryEntry = { plan: Plan; votes: PlanVotes };

// Estado del correo de la cuenta (las direcciones vienen enmascaradas).
export type Account = {
  email: string | null; // verificado
  emailVerified: boolean;
  pendingEmail: string | null; // esperando el enlace de confirmacion
};

// La propia cuenta.
export type Me = Account & {
  id: string;
  name: string;
  color: string;
  theme: string | null;
  pinned: string[];
  flowers: boolean;
  createdAt: string | null;
  seenUpdate: string | null;
  tourDone: boolean;
};

export type Member = { id: string; name: string; color: string; admin?: boolean };

// Una sala en la lista de salas de la cuenta.
export type GroupSummary = { id: string; name: string; members: Member[]; admin: boolean; pinned: boolean };

export type GroupSettings = { pointsPerCategory: number; dessertThreshold: number; reward: string };

// Detalle de la sala abierta.
export type GroupDetail = {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  settings: GroupSettings;
  members: Member[];
  admin: boolean;
};

export type Photo = { id: string; url: string; by: string; at: string; w: number | null; h: number | null };

// Resumen del mes.
export type RecapEntry = { plan: Plan; votes: PlanVotes; photos: Photo[] };
export type RecapList = {
  months: { month: string; plans: number; photos: number }[];
  upcoming: { month: string; plans: number; opensOn: string } | null;
};
