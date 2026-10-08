import { Link, router, usePage } from "@inertiajs/react";
import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { count, rating } from "@/lib/format";
import { useSignInUrl } from "@/lib/sign-in";
import type { SharedProps, Station } from "@/types";

type RatedStation = Pick<Station, "frequency" | "rating_average" | "rating_count">;

function starFill(value: number, index: number): number {
  return Math.min(1, Math.max(0, value - index));
}

function Stars({ value, icon }: { value: number; icon: string }) {
  return (
    <span className="inline-flex" aria-hidden>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = starFill(value, index);
        return (
          <span key={index} className="relative inline-flex">
            <Star className={cn(icon, "text-faint")} strokeWidth={1.75} />
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn(icon, "fill-warning text-warning")} strokeWidth={1.75} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function summary(station: RatedStation): string {
  if (station.rating_count === 0) return "Sin calificaciones";
  const votes = station.rating_count === 1 ? "1 calificación" : `${count(station.rating_count)} calificaciones`;
  return `${rating(station.rating_average)} de 5 · ${votes}`;
}

/** The station's public score. `compact` is the number on a card; `interactive` lets a signed-in listener vote. */
export function StationRating({
  station,
  mine = null,
  interactive = false,
  compact = false,
  className,
}: {
  station: RatedStation;
  mine?: number | null;
  interactive?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const { auth } = usePage<SharedProps>().props;
  const signInUrl = useSignInUrl();
  const [hover, setHover] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const user = auth.user;
  const canVote = Boolean(user?.email_verified);

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)} title={summary(station)}>
        <Star className={cn("size-3.5", station.rating_count > 0 ? "fill-warning text-warning" : "fill-none")} aria-hidden />
        <span className="tabular">{station.rating_count > 0 ? rating(station.rating_average) : "—"}</span>
      </span>
    );
  }

  const vote = (stars: number) => {
    setBusy(true);
    router.post(`/radio/${station.frequency.slug}/calificar`, { stars }, { preserveScroll: true, onFinish: () => setBusy(false) });
  };

  const shown = hover ?? (canVote ? (mine ?? 0) : station.rating_average);
  const caption = (
    <span className="text-sm text-muted">
      {station.rating_count > 0 ? (
        <>
          <strong className="font-semibold text-ink tabular">{rating(station.rating_average)}</strong>
          <span className="tabular"> · {count(station.rating_count)}</span>
        </>
      ) : (
        "Sin calificaciones"
      )}
      {interactive && canVote && mine !== null && <span className="text-xs"> · Tu calificación: {mine}</span>}
    </span>
  );

  if (interactive && !canVote) {
    const href = user ? "/verificar-correo" : signInUrl;
    const prompt = user ? "Verifica tu correo para calificar" : "Ingresa para calificar";

    return (
      <Link href={href} className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg", className)} title={prompt}>
        <Stars value={station.rating_average} icon="size-5" />
        {caption}
        <span className="text-xs font-medium text-signal">{prompt}</span>
      </Link>
    );
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {interactive ? (
        <span className="inline-flex" role="group" aria-label="Calificar esta frecuencia" onMouseLeave={() => setHover(null)}>
          {Array.from({ length: 5 }, (_, index) => {
            const stars = index + 1;
            return (
              <button
                key={stars}
                type="button"
                disabled={busy}
                onMouseEnter={() => setHover(stars)}
                onFocus={() => setHover(stars)}
                onBlur={() => setHover(null)}
                onClick={() => vote(stars)}
                className="rounded p-0.5 text-warning transition hover:scale-110 disabled:opacity-60"
                aria-label={`Calificar con ${stars} ${stars === 1 ? "estrella" : "estrellas"}`}
                aria-pressed={mine === stars}
              >
                <Star className={cn("size-5", stars <= shown ? "fill-current" : "fill-none")} strokeWidth={1.75} />
              </button>
            );
          })}
        </span>
      ) : (
        <span role="img" aria-label={summary(station)}>
          <Stars value={station.rating_average} icon="size-4" />
        </span>
      )}
      {caption}
    </span>
  );
}
