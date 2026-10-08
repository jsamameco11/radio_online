import { useRef, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { SECONDS_PER_TURN } from "@/lib/dj/constants";
import type { DjEngine } from "@/lib/dj/engine";
import type { DeckId, DeckState } from "@/lib/dj/types";
import { useAnimationFrame } from "../use-animation-frame";

/** Share of the radius that is the platter's top; outside it is the jog ring. */
const TOP_RADIUS = 0.8;

/** Each deck's record label, so both platters read apart at a glance. */
const LABELS = ["bg-signal", "bg-royal"] as const;

/**
 * The platter, drawn as a vinyl record: it turns with the music. Its top scratches in vinyl mode (or bends the pitch
 * without it); its outer ring always bends the pitch while playing and searches while paused.
 */
export function JogWheel({ engine, id, deck }: { engine: DjEngine; id: DeckId; deck: DeckState }) {
  const platter = useRef<HTMLDivElement>(null);
  const touch = useRef<{ angle: number; mode: "scratch" | "jog" } | null>(null);

  useAnimationFrame(() => {
    if (platter.current) platter.current.style.transform = `rotate(${(engine.position(id) / SECONDS_PER_TURN) * 360}deg)`;
  });

  function angleOf(event: PointerEvent<HTMLDivElement>): { angle: number; radius: number } {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (box.left + box.width / 2);
    const y = event.clientY - (box.top + box.height / 2);
    return { angle: (Math.atan2(y, x) * 180) / Math.PI, radius: Math.hypot(x, y) / (box.width / 2) };
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (!deck.track) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const { angle, radius } = angleOf(event);
    const mode = radius < TOP_RADIUS && deck.vinyl ? "scratch" : "jog";
    touch.current = { angle, mode };
    if (mode === "scratch") engine.scratchStart(id);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!touch.current) return;
    const { angle } = angleOf(event);
    let delta = angle - touch.current.angle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    touch.current.angle = angle;
    const turns = delta / 360;
    if (touch.current.mode === "scratch") engine.scratchMove(id, turns * SECONDS_PER_TURN);
    else engine.jog(id, turns);
  }

  function up() {
    if (touch.current?.mode === "scratch") engine.scratchEnd(id);
    touch.current = null;
  }

  return (
    <div className="relative w-full max-w-48 pr-4">
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role="application"
        aria-label={`Plato del deck ${id + 1}: gíralo para hacer scratch o ajustar el pitch`}
        className={cn(
          "relative aspect-square w-full touch-none rounded-full border-[3px] border-line-strong bg-raised p-1.5 shadow-[inset_0_2px_10px_var(--color-canvas)] select-none",
          deck.track ? "cursor-grab active:cursor-grabbing" : "opacity-70",
        )}
      >
        <div ref={platter} className="vinyl-disc relative size-full rounded-full" aria-hidden>
          <span className={cn("absolute inset-[34%] rounded-full shadow-[0_0_0_3px_var(--color-canvas)]", LABELS[id])}>
            <span className="absolute top-[8%] left-1/2 h-[26%] w-[3px] -translate-x-1/2 rounded-full bg-white/85" />
          </span>
        </div>
        <span className="vinyl-sheen pointer-events-none absolute inset-1.5 rounded-full" aria-hidden />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-white" aria-hidden>
          <span className="text-[8px] font-bold tracking-[0.2em] uppercase opacity-80">{deck.vinyl ? "Vinilo" : "CDJ"}</span>
          <span className="font-display text-base leading-none font-semibold">{id + 1}</span>
        </div>
      </div>
      <Tonearm playing={deck.playing} />
    </div>
  );
}

/** The tonearm: it rests beside the platter and swings onto the record while the deck plays. */
function Tonearm({ playing }: { playing: boolean }) {
  return (
    <svg
      viewBox="0 0 24 120"
      preserveAspectRatio="xMidYMin meet"
      className="vinyl-arm pointer-events-none absolute top-0 right-0 h-[74%] w-5 text-line-strong"
      style={{ transform: playing ? "rotate(20deg)" : "rotate(0deg)" }}
      aria-hidden
    >
      <circle cx="12" cy="8" r="7" className="fill-raised" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="8" r="2.5" className="fill-muted" />
      <path d="M12 15 L12 96 L7 108" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="2" y="104" width="9" height="14" rx="2" transform="rotate(25 6.5 111)" className="fill-muted" />
    </svg>
  );
}
