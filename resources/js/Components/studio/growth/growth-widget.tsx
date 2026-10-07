import { Link } from "@inertiajs/react";
import { ArrowRight, Flame, Target } from "lucide-react";
import { ActivityCalendar } from "@/Components/studio/growth/activity-calendar";
import { goalProgressLabel } from "@/Components/studio/growth/goal-meta";
import { GoalProgress } from "@/Components/studio/growth/goal-progress";
import { MonetizedBadge } from "@/Components/studio/growth/monetized-badge";
import { Panel } from "@/Components/ui/panel";
import { cn } from "@/lib/cn";
import { count } from "@/lib/format";
import type { GrowthSummary } from "@/types/growth";

/** Dashboard card: the streak, the next goal and how close the station is to monetization. */
export function GrowthWidget({ growth, href }: { growth: GrowthSummary; href: string }) {
  const { streak, next_goal: next, monetization } = growth;
  const today = growth.week[growth.week.length - 1]?.date ?? "";

  return (
    <Panel
      title="Tu crecimiento"
      description={`${growth.achieved_count} de ${growth.total_goals} metas logradas`}
      actions={
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
          Ver metas <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", streak.current > 0 ? "bg-gold text-on-primary" : "bg-raised text-faint ring-1 ring-line ring-inset")}>
            <Flame className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{streak.headline}</p>
            <p className="text-xs text-muted">{streak.message}</p>
          </div>
        </div>
        <ActivityCalendar days={growth.week} today={today} compact />

        {next && (
          <div className="space-y-2 rounded-xl border border-line bg-raised px-3.5 py-3">
            <p className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold tracking-[0.14em] text-gold uppercase">
              <Target className="size-3.5" aria-hidden /> Tu siguiente meta
            </p>
            <p className="text-sm font-semibold text-ink">{next.title}</p>
            {next.target > 1 && <GoalProgress current={next.current} target={next.target} size="sm" label={next.title} />}
            <p className="text-xs text-muted">{next.target > 1 ? goalProgressLabel(next) : next.description}</p>
          </div>
        )}

        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Monetización</p>
            {monetization.monetized_at && <MonetizedBadge size="sm" since={monetization.monetized_at} />}
          </div>
          {!monetization.monetized_at && (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted">
                  <span>Suscriptores</span>
                  <span className="tabular">
                    {count(monetization.subscribers.current)} / {count(monetization.subscribers.target)}
                  </span>
                </div>
                <GoalProgress current={monetization.subscribers.current} target={monetization.subscribers.target} tone="onair" size="sm" label="Suscriptores" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted">
                  <span>Días seguidos con {count(monetization.live.threshold)} oyentes</span>
                  <span className="tabular">
                    {Math.min(monetization.live.best_run, monetization.live.days_required)} / {monetization.live.days_required}
                  </span>
                </div>
                <GoalProgress current={monetization.live.best_run} target={monetization.live.days_required} tone="signal" size="sm" label="Días con audiencia en vivo" />
              </div>
              {monetization.eligible && <p className="text-xs font-semibold text-onair">¡Ya puedes solicitar la monetización!</p>}
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
