import { CheckCircle2, Lock } from "lucide-react";
import { goalMeta, goalProgressLabel } from "@/Components/studio/growth/goal-meta";
import { GoalProgress } from "@/Components/studio/growth/goal-progress";
import { Panel } from "@/Components/ui/panel";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";
import type { Goal } from "@/types/growth";

/** Every goal of the journey, grouped by what it measures, with its progress. */
export function GoalsBoard({ goals, nextKey }: { goals: Goal[]; nextKey: string | null }) {
  const groups = goals.reduce<Map<string, Goal[]>>((map, goal) => {
    const group = goalMeta[goal.metric].group;
    map.set(group, [...(map.get(group) ?? []), goal]);
    return map;
  }, new Map());

  return (
    <Panel title="Todas tus metas" description="Cada meta lograda queda guardada para siempre en el historial de tu radio.">
      <div className="grid gap-6 lg:grid-cols-2">
        {[...groups.entries()].map(([group, items]) => (
          <div key={group} className="space-y-2.5">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{group}</p>
            <ul className="space-y-2">
              {items.map((goal) => (
                <GoalRow key={goal.key} goal={goal} next={goal.key === nextKey} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function GoalRow({ goal, next }: { goal: Goal; next: boolean }) {
  const meta = goalMeta[goal.metric];
  const Icon = meta.icon;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3.5 py-3 transition",
        goal.achieved ? "border-gold/25 bg-gold-soft/60" : next ? "border-line-strong bg-raised" : "border-line bg-surface",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          goal.achieved ? "bg-gold text-on-primary" : next ? "bg-ink text-canvas" : "bg-raised text-faint ring-1 ring-line ring-inset",
        )}
      >
        {goal.achieved ? <CheckCircle2 className="size-4.5" aria-hidden /> : next ? <Icon className="size-4.5" aria-hidden /> : <Lock className="size-4" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <p className={cn("truncate text-sm font-semibold", goal.achieved || next ? "text-ink" : "text-muted")}>{goal.title}</p>
          <span className={cn("shrink-0 text-xs tabular", goal.achieved ? "font-semibold text-gold" : "text-muted")}>
            {goal.achieved && goal.achieved_at ? dateTime(goal.achieved_at, { day: "numeric", month: "short" }) : goalProgressLabel(goal)}
          </span>
        </div>
        {!goal.achieved && goal.target > 1 && <GoalProgress current={goal.current} target={goal.target} tone={meta.tone} size="sm" label={goal.title} />}
        {next && <p className="text-xs text-muted">{goal.description}</p>}
      </div>
    </li>
  );
}
