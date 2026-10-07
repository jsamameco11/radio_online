import { useRef, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { SECONDS_PER_TURN } from "@/lib/dj/constants";
import type { DjEngine } from "@/lib/dj/engine";
import type { DeckId, DeckState } from "@/lib/dj/types";
import { useAnimationFrame } from "../use-animation-frame";

/** Share of the radius that is the platter's top; outside it is the jog ring. */
const TOP_RADIUS = 0.8;

/**
 * The platter: it turns with the music. Its top scratches in vinyl mode (or bends the pitch
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
    <div
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      role="application"
      aria-label={`Plato del deck ${id + 1}: gíralo para hacer scratch o ajustar el pitch`}
      className={cn(
        "relative aspect-square w-full max-w-44 touch-none rounded-full border-4 border-line-strong bg-canvas p-2 shadow-inner select-none",
        deck.track ? "cursor-grab active:cursor-grabbing" : "opacity-60",
      )}
    >
      <div className="absolute inset-1 rounded-full border border-dashed border-line" aria-hidden />
      <div ref={platter} className="relative size-full rounded-full border border-line bg-raised" aria-hidden>
        <span className="absolute top-1.5 left-1/2 h-[18%] w-1 -translate-x-1/2 rounded-full bg-signal" />
        {[45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <span key={deg} className="absolute inset-0" style={{ transform: `rotate(${deg}deg)` }}>
            <span className="absolute top-2 left-1/2 h-2 w-px -translate-x-1/2 bg-line-strong" />
          </span>
        ))}
        <span className="absolute inset-[30%] rounded-full border border-line bg-surface" />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-[10px] font-bold tracking-widest uppercase", deck.playing ? "text-onair" : "text-faint")}>{deck.vinyl ? "Vinilo" : "CDJ"}</span>
        <span className="font-display text-lg font-semibold text-ink">{id + 1}</span>
      </div>
    </div>
  );
}
