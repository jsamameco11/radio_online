import { EQ_RANGE } from "./constants";
import type { CrossfaderCurve } from "./types";

const KILL_DB = -40;
const AUTO_GAIN_TARGET = 0.18;
const AUTO_GAIN_LIMITS = { min: 0.3, max: 3 };

export const dbToGain = (db: number): number => 10 ** (db / 20);

/** Faders and level knobs follow a square law, closer to how loudness is heard. */
export const levelGain = (value: number): number => value * value;

/** Gain of an EQ band, in dB: the bottom of the knob kills the band. */
export const bandDb = (value: number): number => (value <= EQ_RANGE.min ? KILL_DB : value);

/** Gains of channel 1 and channel 2 for a crossfader position (-1 … 1). */
export function crossfaderGains(position: number, curve: CrossfaderCurve): [number, number] {
  const x = (position + 1) / 2;
  if (curve === "smooth") {
    return [Math.min(1, Math.cos((x * Math.PI) / 2) * Math.SQRT2), Math.min(1, Math.sin((x * Math.PI) / 2) * Math.SQRT2)];
  }
  if (curve === "sharp") return [x >= 0.97 ? 0 : 1, x <= 0.03 ? 0 : 1];
  return [1, 1];
}

/** Equal-power blend of the headphones: gains of the cued channels and of the master. */
export const cueBlend = (mix: number): [number, number] => [Math.cos((mix * Math.PI) / 2), Math.sin((mix * Math.PI) / 2)];

/** Cutoffs and resonance of the one-knob filter (below 0 low-pass, above 0 high-pass). */
export function filterShape(filter: number): { lowpass: number; highpass: number; lowQ: number; highQ: number } {
  const amount = Math.abs(filter) < 0.03 ? 0 : filter;
  return {
    lowpass: amount < 0 ? 20000 * (90 / 20000) ** -amount : 22000,
    highpass: amount > 0 ? 20 * (9000 / 20) ** amount : 10,
    lowQ: amount < 0 ? 1.4 : 0.707,
    highQ: amount > 0 ? 1.4 : 0.707,
  };
}

/** Gain that brings a track of some loudness (RMS) to the level of the others. */
export const autoGainFor = (rms: number): number => (rms > 0 ? Math.min(AUTO_GAIN_LIMITS.max, Math.max(AUTO_GAIN_LIMITS.min, AUTO_GAIN_TARGET / rms)) : 1);
