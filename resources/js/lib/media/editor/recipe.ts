/**
 * What an edit does to an audio. Mirrors App\Domain\Studio\Editor\EditRecipe: the server clamps and
 * renders exactly this, so the length and the parts shown here are the ones the edited file has.
 */

export type Cut = [number, number];

export type Recipe = {
  cuts: Cut[];
  fadeIn: number;
  fadeOut: number;
  join: number;
  gain: number;
  normalize: boolean;
  voice: number;
  eq: number[];
  compress: number;
  width: number;
  lowcut: boolean;
  denoise: number;
  deess: number;
  preset: string | null;
};

export type SoundSettings = Omit<Recipe, "cuts" | "fadeIn" | "fadeOut" | "join" | "preset">;

export const EQ_BANDS = [
  { hz: 100, label: "Graves", hint: "Bajo y bombo", type: "lowshelf" },
  { hz: 250, label: "Cuerpo", hint: "Calidez; si sobra, suena a caja", type: "peaking" },
  { hz: 1000, label: "Medios", hint: "Guitarras, piano y voz", type: "peaking" },
  { hz: 3500, label: "Presencia", hint: "Claridad de la voz", type: "peaking" },
  { hz: 10000, label: "Brillo", hint: "Aire y platillos", type: "highshelf" },
] as const;

/** A cut shorter than this is a slip of the mouse. */
const MIN_CUT = 0.05;
/** Audio left between two cuts (or against an edge) shorter than this is cut too. */
const MIN_KEEP = 0.1;

export function defaults(): Recipe {
  return { cuts: [], fadeIn: 0, fadeOut: 0, join: 0, gain: 0, normalize: false, voice: 0, eq: [0, 0, 0, 0, 0], compress: 0, width: 0, lowcut: false, denoise: 0, deess: 0, preset: null };
}

const SOUND_DEFAULTS: SoundSettings = (({ cuts: _c, fadeIn: _i, fadeOut: _o, join: _j, preset: _p, ...sound }) => sound)(defaults());

export type Preset = { key: string; name: string; text: string; sound: Partial<SoundSettings> };

export const PRESETS: Preset[] = [
  { key: "natural", name: "Natural", text: "El sonido tal como vino, sin tratamiento.", sound: {} },
  { key: "voz", name: "Resaltar voz", text: "El cantante adelante y más claro; los instrumentos un paso atrás.", sound: { voice: 60, eq: [0, -1.5, 0, 2, 0.5], compress: 25 } },
  { key: "brillo", name: "Más brillo", text: "Más aire y definición para audios opacos.", sound: { eq: [0, -0.5, 0, 2, 4], width: 10 } },
  { key: "graves", name: "Más graves", text: "Más cuerpo y fuerza en el bajo y el bombo.", sound: { eq: [4, 1, 0, 0, 0] } },
  { key: "calido", name: "Cálido", text: "Suave y envolvente, sin agudos que cansen.", sound: { eq: [1.5, 2, 0, -1, -2] } },
  { key: "radio", name: "Sonido radio", text: "Parejo, presente y al volumen estándar de la radio.", sound: { voice: 25, eq: [1.5, 0, 0, 1.5, 1.5], compress: 55, normalize: true, lowcut: true } },
  { key: "voz-hablada", name: "Podcast o voz hablada", text: "Voz clara y pareja, sin zumbidos ni «eses» fuertes.", sound: { voice: 30, eq: [-2, -1, 0, 2.5, 0], compress: 45, normalize: true, lowcut: true, denoise: 40, deess: 30 } },
  { key: "antigua", name: "Grabación antigua", text: "Menos ruido de fondo y más claridad en grabaciones viejas.", sound: { eq: [-1, -1.5, 0, 2, 3], compress: 30, lowcut: true, denoise: 55, deess: 15 } },
];

export function applyPreset(recipe: Recipe, preset: Preset): Recipe {
  return { ...recipe, ...SOUND_DEFAULTS, eq: [...SOUND_DEFAULTS.eq], ...preset.sound, preset: preset.key === "natural" ? null : preset.key };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const round = (value: number, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Cuts in order, overlaps merged, edges snapped to the start and the end, slivers between two cuts cut too. */
export function mergeCuts(cuts: Cut[], duration: number): Cut[] {
  const sorted = cuts
    .map(([a, b]) => [clamp(Math.min(a, b), 0, duration), clamp(Math.max(a, b), 0, duration)] as Cut)
    .sort((a, b) => a[0] - b[0]);
  const merged: Cut[] = [];
  for (let [start, end] of sorted) {
    if (start < MIN_KEEP) start = 0;
    if (end > duration - MIN_KEEP) end = duration;
    if (end - start < MIN_CUT) continue;
    const last = merged[merged.length - 1];
    if (last && start - last[1] < MIN_KEEP) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged.map(([a, b]) => [round(a), round(b)]);
}

/** Parts of the audio that stay, in order. */
export function keeps(cuts: Cut[], duration: number): Cut[] {
  const parts: Cut[] = [];
  let from = 0;
  for (const [start, end] of cuts) {
    if (start > from) parts.push([from, start]);
    from = Math.max(from, end);
  }
  if (duration > from) parts.push([from, duration]);
  return parts;
}

/** Crossfade at each join between two parts that stay (0 for a clean join). */
export function joins(recipe: Recipe, duration: number): number[] {
  const parts = keeps(recipe.cuts, duration);
  return parts.slice(1).map((after, index) => {
    const before = parts[index];
    return recipe.join > 0 ? round(Math.max(0.01, Math.min(recipe.join, (before[1] - before[0]) * 0.45, (after[1] - after[0]) * 0.45))) : 0;
  });
}

export function editedLength(recipe: Recipe, duration: number) {
  const kept = keeps(recipe.cuts, duration).reduce((sum, [a, b]) => sum + b - a, 0);
  return round(Math.max(0, kept - joins(recipe, duration).reduce((sum, value) => sum + value, 0)));
}

/** Where a moment of the original falls in the edited audio (a moment cut out falls where the next part starts). */
export function toEdited(time: number, recipe: Recipe, duration: number) {
  const parts = keeps(recipe.cuts, duration);
  const overlaps = joins(recipe, duration);
  let elapsed = 0;
  for (let index = 0; index < parts.length; index++) {
    const [start, end] = parts[index];
    if (time < start) return elapsed;
    if (time <= end) return elapsed + time - start;
    elapsed += end - start - (overlaps[index] ?? 0);
  }
  return elapsed;
}

/** The moment of the original heard at a point of the edited audio. */
export function toSource(time: number, recipe: Recipe, duration: number) {
  const parts = keeps(recipe.cuts, duration);
  const overlaps = joins(recipe, duration);
  let elapsed = 0;
  for (let index = 0; index < parts.length; index++) {
    const [start, end] = parts[index];
    const length = end - start - (overlaps[index] ?? 0);
    if (time <= elapsed + length || index === parts.length - 1) return Math.min(end, start + Math.max(0, time - elapsed));
    elapsed += length;
  }
  return duration;
}

/** Index of the cut holding this moment, or -1. */
export function cutAt(cuts: Cut[], time: number) {
  return cuts.findIndex(([start, end]) => time >= start && time < end);
}

/** Gives back the audio of a range that was cut. */
export function restoreRange(cuts: Cut[], [from, to]: Cut, duration: number): Cut[] {
  const pieces = cuts.flatMap(([start, end]): Cut[] => {
    if (end <= from || start >= to) return [[start, end]];
    return [start < from ? ([start, from] as Cut) : null, end > to ? ([to, end] as Cut) : null].filter((piece): piece is Cut => piece !== null);
  });
  return mergeCuts(pieces, duration);
}

/** The saved edit, or a clean one, in the shape the editor works with. */
export function fromSaved(saved: unknown, duration: number): Recipe {
  const base = defaults();
  if (!saved || typeof saved !== "object") return base;
  const value = saved as Partial<Recipe>;
  const number = (input: unknown, min: number, max: number) => clamp(Number(input ?? 0), min, max);
  return {
    cuts: mergeCuts(Array.isArray(value.cuts) ? value.cuts.filter((cut) => Array.isArray(cut) && cut.length === 2).map(([a, b]) => [Number(a), Number(b)] as Cut) : [], duration),
    fadeIn: number(value.fadeIn, 0, 15),
    fadeOut: number(value.fadeOut, 0, 15),
    join: number(value.join, 0, 3),
    gain: number(value.gain, -12, 12),
    normalize: Boolean(value.normalize),
    voice: number(value.voice, 0, 100),
    eq: base.eq.map((_, band) => number(value.eq?.[band], -12, 12)),
    compress: number(value.compress, 0, 100),
    width: number(value.width, -100, 100),
    lowcut: Boolean(value.lowcut),
    denoise: number(value.denoise, 0, 100),
    deess: number(value.deess, 0, 100),
    preset: typeof value.preset === "string" ? value.preset : null,
  };
}

export function sameRecipe(a: Recipe, b: Recipe) {
  const strip = ({ preset: _preset, ...rest }: Recipe) => JSON.stringify(rest);
  return strip(a) === strip(b);
}

export function isPlain(recipe: Recipe) {
  return sameRecipe(recipe, defaults());
}

export function soundChanged(recipe: Recipe) {
  return JSON.stringify({ ...recipe, cuts: [], fadeIn: 0, fadeOut: 0, join: 0, preset: null }) !== JSON.stringify(defaults());
}

/** The treatments the browser cannot play live: they are heard in the final-result sample and in the saved file. */
export function serverOnly(recipe: Recipe) {
  return [recipe.denoise > 0 && "reducción de ruido", recipe.deess > 0 && "suavizado de «eses»"].filter(Boolean) as string[];
}

/** «1:05.3»: precise time for the timeline. */
export function preciseTime(seconds: number) {
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const rest = total - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}
