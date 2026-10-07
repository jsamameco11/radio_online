import type { DeckId, EffectKind } from "./types";

export const DECKS: readonly DeckId[] = [0, 1];

/** Tempo fader ranges (±6 %, ±10 %, ±16 % and wide). */
export const TEMPO_RANGES = [0.06, 0.1, 0.16, 0.5];
export const HOT_CUES = 8;
export const LOOP_PADS = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
export const JUMP_PADS = [-1, 1, -2, 2, -4, 4, -8, 8];
export const SAMPLER_SLOTS = 8;

/** Seconds of audio under one turn of the platter (a record at 33⅓ rpm). */
export const SECONDS_PER_TURN = 1.8;

/** Equalizer knobs, dB: the minimum kills the band. */
export const EQ_RANGE = { min: -26, max: 6 } as const;
/** Trim knobs, ± dB. */
export const TRIM_DB = 12;
/** Top of the master level knob (above 1 boosts into the limiter). */
export const MASTER_MAX = 1.2;

/** Beat divisions of the beat FX (in beats). */
export const FX_BEATS = [0.25, 0.5, 0.75, 1, 2, 4, 8];

export const EFFECTS: { kind: EffectKind; label: string; hint: string }[] = [
  { kind: "echo", label: "Eco", hint: "Repite el sonido al compás; al apagarlo la cola se desvanece" },
  { kind: "reverb", label: "Reverb", hint: "Ambiente de sala; deja la cola al apagarlo" },
  { kind: "flanger", label: "Flanger", hint: "Barrido metálico que recorre el compás" },
  { kind: "filter", label: "Filtro", hint: "Filtro resonante que sube y baja al compás" },
  { kind: "trans", label: "Trans", hint: "Corta el sonido en golpes rítmicos" },
  { kind: "crush", label: "Bitcrush", hint: "Degrada el audio a pocos bits" },
];
