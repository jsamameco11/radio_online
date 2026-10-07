import { PartyPopper, Target } from "lucide-react";
import { goalMeta, goalProgressLabel } from "@/Components/studio/growth/goal-meta";
import { GoalProgress } from "@/Components/studio/growth/goal-progress";
import type { Goal } from "@/types/growth";

/** "Tu siguiente meta": the first goal of the journey not reached yet. */
export function NextGoalCard({ goal, achieved, total }: { goal: Goal | null; achieved: number; total: number }) {
  if (!goal) {
    return (
      <section className="rounded-2xl border border-gold/30 bg-linear-to-br from-gold-soft to-surface p-6">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gold text-on-primary">
            <PartyPopper className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-gold uppercase">Recorrido completo</p>
            <h2 className="font-display text-xl font-semibold text-ink">¡Completaste todas las metas!</h2>
            <p className="text-sm text-muted">Tu radio está entre las grandes. Sigue al aire y cuida a tu comunidad.</p>
          </div>
        </div>
      </section>
    );
  }

  const meta = goalMeta[goal.metric];
  const Icon = meta.icon;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6">
      <div className="absolute -top-16 -right-16 size-48 rounded-full bg-gold-soft blur-2xl" aria-hidden />
      <div className="relative flex flex-wrap items-start gap-5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-canvas">
          <Icon className="size-7" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-gold uppercase">
              <Target className="size-3.5" aria-hidden /> Tu siguiente meta
            </p>
            <h2 className="font-display text-2xl font-semibold text-ink">{goal.title}</h2>
            <p className="text-sm text-muted">{goal.description}</p>
          </div>
          {goal.target > 1 && (
            <div className="space-y-1.5">
              <GoalProgress current={goal.current} target={goal.target} tone={meta.tone} size="lg" label={goal.title} />
              <p className="text-xs font-medium text-muted tabular">{goalProgressLabel(goal)}</p>
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-semibold text-ink tabular">
            {achieved}
            <span className="text-lg text-faint">/{total}</span>
          </p>
          <p className="text-xs text-muted">metas logradas</p>
        </div>
      </div>
    </section>
  );
}
