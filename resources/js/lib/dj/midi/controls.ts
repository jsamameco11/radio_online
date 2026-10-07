import { HOT_CUES } from "../constants";

/** How a hardware control behaves: a button (press and release), a knob or fader (0–1) or an endless encoder (± steps). */
export type ControlKind = "button" | "absolute" | "relative";

export interface MidiControl {
  id: string;
  label: string;
  kind: ControlKind;
  group: MidiGroup;
}

/** Hardware message key (`n` note or `c` control change, channel, number) → console control id. */
export type MidiMapping = Record<string, string>;

/** One hardware event, already translated: a press or release, a position (0–1) or steps of an encoder. */
export interface MidiEvent {
  control: MidiControl;
  pressed: boolean;
  value: number;
  steps: number;
}

export const MIDI_GROUPS = ["Deck 1", "Deck 2", "Mezclador", "Efectos"] as const;
export type MidiGroup = (typeof MIDI_GROUPS)[number];

/** Performance pads of a deck as `{prefix}{n}` ids, n from 1 to HOT_CUES. */
const PAD_CONTROLS = [
  { prefix: "hotcue", label: "Hot cue" },
  { prefix: "hotcueDelete", label: "Borrar hot cue" },
  { prefix: "loop", label: "Pad beat loop" },
  { prefix: "jump", label: "Pad beat jump" },
  { prefix: "sample", label: "Pad sampler" },
] as const;

function deckControls(deck: 1 | 2): MidiControl[] {
  const group: MidiGroup = deck === 1 ? "Deck 1" : "Deck 2";
  const p = `d${deck}`;
  const button = (id: string, label: string): MidiControl => ({ id: `${p}.${id}`, label, kind: "button", group });
  const absolute = (id: string, label: string): MidiControl => ({ id: `${p}.${id}`, label, kind: "absolute", group });
  const relative = (id: string, label: string): MidiControl => ({ id: `${p}.${id}`, label, kind: "relative", group });
  return [
    button("play", "Play / Pausa"),
    button("cue", "Cue"),
    button("sync", "Sync"),
    button("keylock", "Key lock"),
    button("shift", "Shift"),
    button("load", "Cargar pista elegida"),
    absolute("tempo", "Fader de tempo"),
    button("jogTouch", "Toque del plato"),
    relative("scratch", "Giro del plato (scratch)"),
    relative("jog", "Aro del plato (pitch bend)"),
    button("loopIn", "Loop in"),
    button("loopOut", "Loop out"),
    button("reloop", "Reloop / salir"),
    button("loopHalve", "Loop ½"),
    button("loopDouble", "Loop ×2"),
    button("pfl", "Cue de auriculares"),
    absolute("fader", "Fader de canal"),
    absolute("trim", "Trim"),
    absolute("high", "EQ agudos"),
    absolute("mid", "EQ medios"),
    absolute("low", "EQ graves"),
    absolute("filter", "Filtro"),
    ...PAD_CONTROLS.flatMap((pad) => Array.from({ length: HOT_CUES }, (_, i) => button(`${pad.prefix}${i + 1}`, `${pad.label} ${i + 1}`))),
  ];
}

export const MIDI_CONTROLS: MidiControl[] = [
  ...deckControls(1),
  ...deckControls(2),
  { id: "crossfader", label: "Crossfader", kind: "absolute", group: "Mezclador" },
  { id: "master", label: "Nivel master", kind: "absolute", group: "Mezclador" },
  { id: "cueMix", label: "Mezcla de auriculares", kind: "absolute", group: "Mezclador" },
  { id: "phones", label: "Volumen de auriculares", kind: "absolute", group: "Mezclador" },
  { id: "browse", label: "Navegar la biblioteca", kind: "relative", group: "Mezclador" },
  { id: "fxOn", label: "FX encendido", kind: "button", group: "Efectos" },
  { id: "fxDepth", label: "FX nivel / profundidad", kind: "absolute", group: "Efectos" },
  { id: "fxNext", label: "Siguiente efecto", kind: "button", group: "Efectos" },
  { id: "fxBeatDown", label: "FX beat ◀", kind: "button", group: "Efectos" },
  { id: "fxBeatUp", label: "FX beat ▶", kind: "button", group: "Efectos" },
];

/** Readable name of a hardware message key (`n:0:11` → «Nota 11 · canal 1»). */
export function midiKeyLabel(key: string): string {
  const [type, channel, number] = key.split(":");
  return `${type === "n" ? "Nota" : "CC"} ${number} · canal ${Number(channel) + 1}`;
}
