import { PartyPopper, Sparkles } from "lucide-react";
import { goalMeta } from "@/Components/studio/growth/goal-meta";
import { ago } from "@/lib/format";
import type { Goal } from "@/types/growth";

/** Celebrates the milestones unlocked during the last days; the ones unlocked by this visit lead. */
export function AchievementBanner({ recent }: { recent: Goal[] }) {
  if (recent.length === 0) return null;

  const fresh = recent.filter((goal) => goal.fresh);
  const lead = fresh[0] ?? recent[0];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-gold/30 bg-linear-to-r from-gold-soft via-surface to-gold-soft px-5 py-4" aria-live="polite">
      <Sparkles className="absolute top-3 right-4 size-5 text-gold/60" aria-hidden />
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-gold text-on-primary shadow-lg shadow-gold/20">
          <PartyPopper className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.14em] text-gold uppercase">{fresh.length > 0 ? "¡Meta desbloqueada!" : "Logros recientes"}</p>
          <p className="font-display text-lg font-semibold text-ink">
            {fresh.length > 1 ? `¡Desbloqueaste ${fresh.length} metas nuevas!` : `${lead.title}: ¡lo lograste!`}
          </p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {recent.slice(0, 4).map((goal) => {
            const Icon = goalMeta[goal.metric].icon;
            return (
              <li key={goal.key} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink ring-1 ring-gold/25 ring-inset">
                <Icon className="size-3.5 text-gold" aria-hidden />
                {goal.title}
                {goal.achieved_at && !goal.fresh && <span className="text-faint">· {ago(goal.achieved_at)}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
