import type { LucideIcon } from "lucide-react";
import { Flame, Headphones, Podcast, Radio, Users } from "lucide-react";
import { count } from "@/lib/format";
import type { Goal, GoalMetric } from "@/types/growth";

/** Icon, group and wording of each goal metric. */
export const goalMeta: Record<GoalMetric, { icon: LucideIcon; group: string; tone: "signal" | "onair" | "gold" | "info" }> = {
  episodes: { icon: Podcast, group: "Primeros pasos", tone: "info" },
  lives: { icon: Radio, group: "Primeros pasos", tone: "signal" },
  streak: { icon: Flame, group: "Racha de días seguidos", tone: "gold" },
  subscribers: { icon: Users, group: "Suscriptores", tone: "onair" },
  live_peak: { icon: Headphones, group: "Audiencia en vivo", tone: "signal" },
};

/** "2 de 3 días", "48 de 100 suscriptores", "Pendiente". */
export function goalProgressLabel(goal: Goal): string {
  if (goal.achieved) return "¡Logrado!";
  switch (goal.metric) {
    case "episodes":
    case "lives":
      return "Pendiente";
    case "streak":
      return `${goal.current} de ${goal.target} días`;
    case "subscribers":
      return `${count(goal.current)} de ${count(goal.target)} suscriptores`;
    case "live_peak":
      return `Tu mejor pico: ${count(goal.current)} de ${count(goal.target)}`;
  }
}
