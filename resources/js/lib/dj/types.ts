import type { Waveform } from "./analysis";

export type DeckId = 0 | 1;
export type PadMode = "hotcue" | "loop" | "jump" | "sampler";
export type FxTarget = "1" | "2" | "master";
export type CrossfaderCurve = "smooth" | "sharp" | "thru";
export type EffectKind = "echo" | "reverb" | "flanger" | "filter" | "trans" | "crush";

export interface LoadedTrack {
  id: string | null;
  title: string;
  artist: string | null;
  duration: number;
}

export interface DeckLoop {
  start: number;
  end: number;
  active: boolean;
}

export interface DeckState {
  track: LoadedTrack | null;
  loading: boolean;
  error: string | null;
  playing: boolean;
  /** Tempo of the track as recorded. */
  bpm: number | null;
  /** Second of the first beat. */
  grid: number;
  /** Tempo fader, from -1 (top, slower) to 1. */
  tempo: number;
  range: number;
  keylock: boolean;
  reverse: boolean;
  vinyl: boolean;
  sync: boolean;
  cue: number;
  hotcues: (number | null)[];
  loop: DeckLoop | null;
  loopIn: number | null;
  padMode: PadMode;
  waveform: Waveform | null;
  autoGain: number;
}

export interface ChannelState {
  /** Gain trim, dB (-12 … +12). */
  trim: number;
  /** Equalizer, dB (EQ_RANGE); the minimum kills the band. */
  high: number;
  mid: number;
  low: number;
  /** One-knob filter: below 0 low-pass, above 0 high-pass. */
  filter: number;
  fader: number;
  cue: boolean;
}

export interface FxState {
  kind: EffectKind;
  beats: number;
  depth: number;
  target: FxTarget;
  on: boolean;
}

export interface SamplerSlot {
  id: string | null;
  title: string;
  src: string;
}

export interface MixerSettings {
  crossfader: number;
  curve: CrossfaderCurve;
  master: number;
  /** Headphones: 0 hears only the cued channels, 1 only the master. */
  cueMix: number;
  phones: number;
  samplerVolume: number;
}

export interface DjState extends MixerSettings {
  ready: boolean;
  decks: [DeckState, DeckState];
  channels: [ChannelState, ChannelState];
  fx: FxState;
  sampler: (SamplerSlot | null)[];
  quantize: boolean;
  autoGain: boolean;
  onAir: boolean;
  talkover: number;
}

/** A track to put on a deck: from the library (an address) or from this computer (a file). */
/** An audio for a deck; `bpm` is given only when the tempo is known exactly and the first beat starts the file. */
export type TrackSource = { id: string | null; title: string; artist: string | null; bpm?: number } & ({ src: string } | { file: File });
