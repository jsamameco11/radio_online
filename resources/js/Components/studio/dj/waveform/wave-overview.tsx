import { useRef, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import type { Waveform } from "@/lib/dj/analysis";
import type { DjEngine } from "@/lib/dj/engine";
import type { DeckId, DeckState } from "@/lib/dj/types";
import { bandsAt, paintColumn, paintCue, paintShade } from "./paint";
import { useCanvasLoop } from "./use-canvas-loop";

/** The whole track: click to jump (needle search); the played part is dimmed. */
export function WaveOverview({ engine, id, deck }: { engine: DjEngine; id: DeckId; deck: DeckState }) {
  const cache = useRef<{ canvas: HTMLCanvasElement; wave: Waveform; width: number } | null>(null);

  const canvas = useCanvasLoop((ctx, width, height, palette) => {
    ctx.clearRect(0, 0, width, height);
    const wave = deck.waveform;
    const duration = deck.track?.duration ?? 0;
    if (!wave || !duration) return;
    if (!cache.current || cache.current.wave !== wave || cache.current.width !== Math.round(width)) {
      const off = document.createElement("canvas");
      off.width = Math.round(width);
      off.height = Math.round(height);
      const octx = off.getContext("2d");
      if (octx) {
        const bins = wave.low.length;
        for (let x = 0; x < off.width; x++) {
          paintColumn(octx, x, 1, height / 2, height / 2 - 1, bandsAt(wave, Math.floor((x / off.width) * bins), Math.floor(((x + 1) / off.width) * bins)), palette);
        }
      }
      cache.current = { canvas: off, wave, width: Math.round(width) };
    }
    ctx.drawImage(cache.current.canvas, 0, 0, width, height);

    const at = (seconds: number) => (seconds / duration) * width;
    const here = at(engine.position(id));
    paintShade(ctx, 0, here, height, palette.shade, 0.55);
    if (deck.loop) paintShade(ctx, at(deck.loop.start), Math.max(1, at(deck.loop.end) - at(deck.loop.start)), height, palette.loop, deck.loop.active ? 0.3 : 0.12);
    deck.hotcues.forEach((cue, index) => {
      if (cue === null) return;
      ctx.fillStyle = palette.hot[index];
      ctx.fillRect(at(cue) - 1, 0, 2, height);
    });
    paintCue(ctx, at(deck.cue), "top", height, 4, palette.cue);
    ctx.fillStyle = palette.head;
    ctx.fillRect(here - 1, 0, 2, height);
  });

  function seek(event: PointerEvent<HTMLCanvasElement>) {
    const duration = deck.track?.duration;
    if (!duration) return;
    const box = event.currentTarget.getBoundingClientRect();
    engine.seek(id, ((event.clientX - box.left) / box.width) * duration);
  }

  return <canvas ref={canvas} onPointerDown={seek} className={cn("h-10 w-full rounded-md bg-raised", deck.track ? "cursor-pointer" : "")} aria-label={`Vista completa del deck ${id + 1}: toca para saltar`} />;
}
