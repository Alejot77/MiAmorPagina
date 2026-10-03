import { kv } from "@/lib/kv";
import { POINTS_PER_CATEGORY, DESSERT_THRESHOLD } from "@/config";

// Puntos/umbral configurables desde Perfil -> Configuracion. Si nunca los
// cambiaron, se usan los valores por defecto de config.js.
export async function getSettings() {
  const [pointsPerCategory, dessertThreshold] = await Promise.all([
    kv.get("settings:points_per_category"),
    kv.get("settings:dessert_threshold"),
  ]);
  return {
    pointsPerCategory:
      typeof pointsPerCategory === "number" && pointsPerCategory > 0
        ? pointsPerCategory
        : POINTS_PER_CATEGORY,
    dessertThreshold:
      typeof dessertThreshold === "number" && dessertThreshold > 0
        ? dessertThreshold
        : DESSERT_THRESHOLD,
  };
}
