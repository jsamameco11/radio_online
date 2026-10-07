import { cn } from "@/lib/cn";
import { count, dateTime } from "@/lib/format";
import type { ActivityDay } from "@/types/growth";

const dayLabel = (date: string, options: Intl.DateTimeFormatOptions) => dateTime(`${date}T12:00:00`, options);

function describe(day: ActivityDay): string {
  const parts = [day.live && `En vivo · pico ${count(day.peak)}`, day.episode && "Episodio publicado"].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Sin actividad";
}

/** The last days of a station: a lit cell for every day it went live or published an episode. */
export function ActivityCalendar({ days, today, compact = false }: { days: ActivityDay[]; today: string; compact?: boolean }) {
  return (
    <div className="space-y-2">
      <ol className={cn("grid gap-1.5", compact ? "grid-cols-7" : "grid-cols-10 sm:grid-cols-15")} aria-label="Actividad de los últimos días">
        {days.map((day) => {
          const active = day.live || day.episode;
          const isToday = day.date === today;
          return (
            <li key={day.date} className="group relative">
              <div
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg text-[0.65rem] font-semibold tabular transition",
                  active ? (day.live ? "bg-gold text-on-primary" : "bg-gold/60 text-on-primary") : "bg-raised text-faint ring-1 ring-line ring-inset",
                  isToday && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
                )}
                aria-label={`${dayLabel(day.date, { weekday: "long", day: "numeric", month: "long" })}: ${describe(day)}`}
              >
                {compact ? dayLabel(day.date, { weekday: "narrow" }) : dayLabel(day.date, { day: "numeric" })}
              </div>
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg group-hover:block">
                <p className="font-semibold capitalize">{isToday ? "Hoy" : dayLabel(day.date, { weekday: "long", day: "numeric", month: "short" })}</p>
                <p className="text-muted">{describe(day)}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {!compact && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded bg-gold" aria-hidden /> En vivo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded bg-gold/60" aria-hidden /> Episodio publicado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded bg-raised ring-1 ring-line ring-inset" aria-hidden /> Sin actividad
          </span>
        </div>
      )}
    </div>
  );
}
