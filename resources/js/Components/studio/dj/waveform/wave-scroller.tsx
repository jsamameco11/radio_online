import { useRef, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { WAVE_RATE } from "@/lib/dj/analysis";
import type { DjEngine } from "@/lib/dj/engine";
import type { DeckId, DeckState } from "@/lib/dj/types";
import { bandsAt, paintColumn, paintCue, paintShade } from "./paint";
import { useCanvasLoop } from "./use-canvas-loop";

const COLUMN = 2;

interface WaveScrollerProps {
  engine: DjEngine;
  id: DeckId;
  deck: DeckState;
  /** Seconds shown across the canvas. */
  span: number;
  className?: string;
}

/** The zoomed waveform scrolling under a fixed playhead, with the beat grid; drag it to scratch. */
export function WaveScroller({ engine, id, deck, span, className }: WaveScrollerProps) {
  const drag = useRef<{ x: number } | null>(null);

  const canvas = useCanvasLoop((ctx, width, height, palette) => {
    ctx.clearRect(0, 0, width, height);
    const wave = deck.waveform;
    if (!wave) return;
    const from = engine.position(id) - span / 2;
    const perPixel = span / width;
    const at = (seconds: number) => (seconds - from) / perPixel;

    if (deck.loop) paintShade(ctx, at(deck.loop.start), (deck.loop.end - deck.loop.start) / perPixel, height, palette.loop, deck.loop.active ? 0.22 : 0.08);

    if (deck.bpm) {
      const beat = 60 / deck.bpm;
      const end = Math.min(from + span, deck.track?.duration ?? 0);
      for (let k = Math.ceil((Math.max(from, 0) - deck.grid) / beat); deck.grid + k * beat < end; k++) {
        const downbeat = ((k % 4) + 4) % 4 === 0;
        ctx.fillStyle = downbeat ? palette.downbeat : palette.grid;
        ctx.fillRect(at(deck.grid + k * beat), 0, downbeat ? 1.5 : 1, height);
      }
    }

    for (let x = 0; x < width; x += COLUMN) {
      const t0 = from + x * perPixel;
      if (t0 < 0) continue;
      const b0 = Math.floor(t0 * WAVE_RATE);
      if (b0 >= wave.low.length) break;
      paintColumn(ctx, x, COLUMN - 0.5, height / 2, height / 2 - 2, bandsAt(wave, b0, Math.floor((t0 + perPixel * COLUMN) * WAVE_RATE)), palette);
    }

    deck.hotcues.forEach((cue, index) => {
      if (cue === null) return;
      const x = at(cue);
      if (x < -20 || x > width + 20) return;
      ctx.fillStyle = palette.hot[index];
      ctx.fillRect(x - 1, 0, 2, height);
      ctx.fillRect(x, 0, 14, 12);
      ctx.fillStyle = palette.shade;
      ctx.font = "bold 9px ui-monospace, monospace";
      ctx.fillText(String(index + 1), x + 4, 9);
    });
    paintCue(ctx, at(deck.cue), "bottom", height, 5, palette.cue);
    ctx.fillStyle = palette.head;
    ctx.fillRect(width / 2 - 1, 0, 2, height);
  });

  function down(event: PointerEvent<HTMLCanvasElement>) {
    if (!deck.track) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX };
    engine.scratchStart(id);
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    const width = event.currentTarget.clientWidth || 1;
    engine.scratchMove(id, (-(event.clientX - drag.current.x) / width) * span);
    drag.current = { x: event.clientX };
  }

  function up() {
    if (!drag.current) return;
    drag.current = null;
    engine.scratchEnd(id);
  }

  return (
    <canvas
      ref={canvas}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className={cn("w-full touch-none rounded-md bg-raised", deck.track ? "cursor-grab active:cursor-grabbing" : "", className)}
      aria-label={`Onda del deck ${id + 1}: arrástrala para hacer scratch`}
    />
  );
}
