import type { Waveform } from "@/lib/dj/analysis";
import type { WavePalette } from "../palette";

export type Bands = [number, number, number];

/** Peak of each band between two bins of the waveform. */
export function bandsAt(wave: Waveform, from: number, to: number): Bands {
  let low = 0;
  let mid = 0;
  let high = 0;
  const end = Math.min(wave.low.length, Math.max(from + 1, to));
  for (let i = Math.max(0, from); i < end; i++) {
    low = Math.max(low, wave.low[i]);
    mid = Math.max(mid, wave.mid[i]);
    high = Math.max(high, wave.high[i]);
  }
  return [low, mid, high];
}

/** One column of the waveform: lows widest at the back, highs narrowest in front. */
export function paintColumn(ctx: CanvasRenderingContext2D, x: number, width: number, center: number, half: number, [low, mid, high]: Bands, palette: WavePalette): void {
  ctx.fillStyle = palette.low;
  ctx.fillRect(x, center - low * half, width, low * half * 2);
  ctx.fillStyle = palette.mid;
  ctx.fillRect(x, center - mid * half * 0.7, width, mid * half * 1.4);
  ctx.fillStyle = palette.high;
  ctx.fillRect(x, center - high * half * 0.4, width, high * half * 0.8);
}

/** A translucent band (a loop, the played part…). */
export function paintShade(ctx: CanvasRenderingContext2D, x: number, width: number, height: number, color: string, alpha: number): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, 0, width, height);
  ctx.globalAlpha = 1;
}

/** The cue marker: a small triangle on the top or bottom edge. */
export function paintCue(ctx: CanvasRenderingContext2D, x: number, edge: "top" | "bottom", height: number, size: number, color: string): void {
  const base = edge === "top" ? 0 : height;
  const tip = edge === "top" ? size + 2 : height - size - 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - size, base);
  ctx.lineTo(x + size, base);
  ctx.lineTo(x, tip);
  ctx.fill();
}
