import { EQ_RANGE } from "@/lib/dj/constants";
import type { CrossfaderCurve, FxTarget, PadMode } from "@/lib/dj/types";

export const PAD_MODES: { value: PadMode; label: string }[] = [
  { value: "hotcue", label: "Hot cue" },
  { value: "loop", label: "Beat loop" },
  { value: "jump", label: "Beat jump" },
  { value: "sampler", label: "Sampler" },
];

export const FX_TARGETS: { value: FxTarget; label: string }[] = [
  { value: "1", label: "Canal 1" },
  { value: "2", label: "Canal 2" },
  { value: "master", label: "Master" },
];

export const CURVES: { value: CrossfaderCurve; label: string; hint: string }[] = [
  { value: "smooth", label: "Suave", hint: "Mezcla larga: los dos canales suenan llenos al centro" },
  { value: "sharp", label: "Corte", hint: "Para scratch: el canal entra apenas mueves el crossfader" },
  { value: "thru", label: "Sin X", hint: "Crossfader desactivado: solo cuentan los faders de canal" },
];

/** Seconds as m:ss.t (or -m:ss.t). */
export function deckTime(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const value = Math.abs(seconds);
  const minutes = Math.floor(value / 60);
  const rest = value - minutes * 60;
  return `${sign}${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}

export function beatsLabel(beats: number): string {
  if (beats === 0.25) return "1/4";
  if (beats === 0.5) return "1/2";
  if (beats === 0.75) return "3/4";
  return String(beats);
}

export const percentLabel = (value: number): string => `${Math.round(value * 100)}`;

export const signedLabel = (value: number): string => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

export const eqLabel = (value: number): string => (value <= EQ_RANGE.min ? "KILL" : `${signedLabel(value)} dB`);

export const filterLabel = (value: number): string => (Math.abs(value) < 0.03 ? "—" : `${value < 0 ? "LPF" : "HPF"} ${Math.round(Math.abs(value) * 100)}`);
