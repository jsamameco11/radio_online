import { useRef } from "react";
import type { DjEngine } from "@/lib/dj/engine";
import type { DeckId, DeckState } from "@/lib/dj/types";
import { deckTime } from "../labels";
import { useAnimationFrame } from "../use-animation-frame";

/** Seconds left under which the remaining time flashes. */
const WARN_SECONDS = 30;

/** Elapsed and remaining time, redrawn every frame without re-rendering the deck. */
export function DeckClock({ engine, id, deck }: { engine: DjEngine; id: DeckId; deck: DeckState }) {
  const elapsed = useRef<HTMLSpanElement>(null);
  const remaining = useRef<HTMLSpanElement>(null);
  const duration = deck.track?.duration ?? 0;

  useAnimationFrame(() => {
    const at = engine.position(id);
    if (elapsed.current) elapsed.current.textContent = deckTime(at);
    if (remaining.current) {
      remaining.current.textContent = deckTime(-(duration - at));
      remaining.current.dataset.warn = String(duration > 0 && duration - at < WARN_SECONDS);
    }
  });

  return (
    <div className="flex items-center justify-between font-mono text-sm text-ink tabular">
      <span ref={elapsed}>0:00.0</span>
      <span className="text-xs text-faint">{deckTime(duration)}</span>
      <span ref={remaining} className="data-[warn=true]:animate-onair data-[warn=true]:text-danger">
        -0:00.0
      </span>
    </div>
  );
}
