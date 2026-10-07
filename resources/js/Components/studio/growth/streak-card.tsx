import { Flame, Trophy } from "lucide-react";
import { ActivityCalendar } from "@/Components/studio/growth/activity-calendar";
import { Badge } from "@/Components/ui/badge";
import { cn } from "@/lib/cn";
import type { ActivityDay, Streak } from "@/types/growth";

const stateBadge: Record<Streak["state"], { tone: "onair" | "warning" | "neutral" | "info"; label: string }> = {
  active: { tone: "onair", label: "Hoy ya sumaste" },
  at_risk: { tone: "warning", label: "Se mantiene hasta la medianoche" },
  broken: { tone: "neutral", label: "Racha en pausa" },
  fresh: { tone: "info", label: "Tu primer día te espera" },
};

/** The streak of consecutive active days, with the words that keep it going and the last 30 days. */
export function StreakCard({ streak, calendar, today }: { streak: Streak; calendar: ActivityDay[]; today: string }) {
  const lit = streak.current > 0;
  const badge = stateBadge[streak.state];

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-5 border-b border-line bg-linear-to-br from-gold-soft via-surface to-surface px-5 py-5">
        <div
          className={cn(
            "relative flex size-20 shrink-0 flex-col items-center justify-center rounded-3xl ring-1 ring-inset",
            lit ? "bg-gold text-on-primary ring-gold/40" : "bg-raised text-faint ring-line",
          )}
        >
          <Flame className={cn("size-7", lit && streak.state === "active" && "animate-onair")} aria-hidden />
          <span className="font-display text-2xl leading-none font-bold tabular">{streak.current}</span>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-semibold text-ink">{streak.headline}</h2>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
          <p className="max-w-xl text-sm text-muted">{streak.message}</p>
          <p className="inline-flex items-center gap-1.5 text-xs text-faint">
            <Trophy className="size-3.5" aria-hidden />
            Mejor racha: <span className="font-semibold text-muted tabular">{streak.best === 1 ? "1 día" : `${streak.best} días`}</span>
          </p>
        </div>
      </div>
      <div className="space-y-3 px-5 py-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Últimos 30 días</p>
        <ActivityCalendar days={calendar} today={today} />
      </div>
    </section>
  );
}
