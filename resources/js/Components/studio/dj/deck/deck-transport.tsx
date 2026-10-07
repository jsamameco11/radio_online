import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import type { DjEngine } from "@/lib/dj/engine";
import type { DeckId, DeckState } from "@/lib/dj/types";

/** CDJ-style CUE (hold to preview) and PLAY/PAUSE; both react on press, not on release. */
export function DeckTransport({ engine, id, deck }: { engine: DjEngine; id: DeckId; deck: DeckState }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={!deck.track}
        onPointerDown={(event) => {
          event.preventDefault();
          engine.cueDown(id);
        }}
        onPointerUp={() => engine.cueUp(id)}
        onPointerLeave={() => engine.cueUp(id)}
        title="Cue: en pausa fija el punto y lo escucha mientras lo mantienes; sonando vuelve al punto"
        className="flex size-14 items-center justify-center rounded-full border-2 border-gold/70 bg-gold-soft text-sm font-bold text-gold transition active:scale-95 disabled:opacity-40"
      >
        CUE
      </button>
      <button
        type="button"
        disabled={!deck.track}
        onPointerDown={(event) => {
          event.preventDefault();
          engine.togglePlay(id);
        }}
        aria-pressed={deck.playing}
        aria-label={deck.playing ? `Pausar el deck ${id + 1}` : `Reproducir el deck ${id + 1}`}
        className={cn("flex size-14 items-center justify-center rounded-full border-2 transition active:scale-95 disabled:opacity-40", deck.playing ? "border-onair bg-onair text-white" : "border-onair/60 bg-onair-soft text-onair")}
      >
        {deck.playing ? <Pause className="size-6" /> : <Play className="size-6" />}
      </button>
    </div>
  );
}
