import { TEMPO_RANGES } from "./constants";
import type { DeckState } from "./types";

type Grid = Pick<DeckState, "bpm" | "grid">;

const MIN_TAPS = 4;
const TAPPED_BPM = { min: 40, max: 250 };

export const roundBpm = (bpm: number): number => Math.round(bpm * 100) / 100;

/** Length of a beat, in seconds (half a second while the tempo is unknown). */
export const beatLength = (bpm: number | null): number => (bpm ? 60 / bpm : 0.5);

/** The beat at or before a second. */
export function beatFloor({ bpm, grid }: Grid, seconds: number): number {
  if (!bpm) return seconds;
  const beat = 60 / bpm;
  return grid + Math.floor((seconds - grid) / beat + 1e-6) * beat;
}

/** The beat closest to a second. */
export function nearestBeat({ bpm, grid }: Grid, seconds: number): number {
  if (!bpm) return Math.max(0, seconds);
  const beat = 60 / bpm;
  return Math.max(0, grid + Math.round((seconds - grid) / beat) * beat);
}

/** How far into its beat a second falls, from 0 to 1. */
export function beatPhase({ bpm, grid }: Grid, seconds: number): number {
  if (!bpm) return 0;
  return ((((seconds - grid) / (60 / bpm)) % 1) + 1) % 1;
}

/** Length of the active loop, in beats (null without an active loop or a tempo). */
export function loopBeats({ loop, bpm }: Pick<DeckState, "loop" | "bpm">): number | null {
  return loop?.active && bpm ? (loop.end - loop.start) / (60 / bpm) : null;
}

/** A grid offset brought within the first beat. */
export function wrapGrid(bpm: number, grid: number): number {
  const beat = 60 / bpm;
  return ((grid % beat) + beat) % beat;
}

/**
 * Tempo fader settings that take a track to a target tempo (or to its half or double, whichever
 * is closer), keeping the current range when it is wide enough; null when no range reaches it.
 */
export function syncFader(bpm: number, target: number, range: number): { range: number; tempo: number } | null {
  let ratio = target / bpm;
  while (ratio > 1.5) ratio /= 2;
  while (ratio < 0.67) ratio *= 2;
  const needed = ratio - 1;
  const fits = TEMPO_RANGES.find((item) => Math.abs(needed) <= item);
  if (fits === undefined) return null;
  const keep = Math.abs(needed) <= range ? range : fits;
  return { range: keep, tempo: needed / keep };
}

/** Tempo of a track from taps (timestamps in ms) heard at `rate` speed; null until there are enough or when implausible. */
export function tappedBpm(taps: number[], rate: number): number | null {
  if (taps.length < MIN_TAPS) return null;
  const gaps = taps.slice(1).map((at, index) => at - taps[index]);
  const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const bpm = roundBpm(60000 / average / rate);
  return bpm >= TAPPED_BPM.min && bpm <= TAPPED_BPM.max ? bpm : null;
}
