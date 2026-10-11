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
};

export type Plan = {
  id: string;
  weekend: string; // yyyy-mm-dd
  steps: Step[];
  createdBy: string;
  createdAt: string;
  favorite?: boolean;
  memoryNote?: string;
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
  points: Record<string, number>;
  desserts: Record<string, number>;
  threshold: number;
};

export type HistoryEntry = { plan: Plan; votes: PlanVotes };
