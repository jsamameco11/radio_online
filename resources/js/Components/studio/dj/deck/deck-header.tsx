import { cn } from "@/lib/cn";
import type { DjEngine } from "@/lib/dj/engine";
import type { DeckId, DeckState } from "@/lib/dj/types";

/** Deck number, what is loaded and the tempo it sounds at, with the pitch of the fader. */
export function DeckHeader({ engine, id, deck }: { engine: DjEngine; id: DeckId; deck: DeckState }) {
  const bpm = engine.effectiveBpm(id);
  const pitch = deck.tempo * deck.range * 100;
  const origin = deck.track ? (deck.track.artist ?? (deck.track.id ? "Biblioteca" : "Archivo de tu equipo")) : "Carga una pista de la biblioteca o de tu equipo";

  return (
    <header className="flex items-start gap-3">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold", deck.playing ? "bg-onair text-white" : "bg-raised text-ink")}>{id + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{deck.loading ? "Cargando y analizando…" : (deck.track?.title ?? "Deck vacío")}</p>
        <p className="truncate text-xs text-muted">{origin}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-2xl leading-none font-semibold text-ink tabular">{bpm ? bpm.toFixed(2) : "--.--"}</p>
        <p className={cn("font-mono text-[11px] tabular", Math.abs(pitch) < 0.005 ? "text-faint" : "text-gold")}>
          BPM · {pitch >= 0 ? "+" : ""}
          {pitch.toFixed(2)}%
        </p>
      </div>
    </header>
  );
}
