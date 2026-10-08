import { STYLES, type StyleId } from "./styles";

export type Layer = "drums" | "bass" | "harmony" | "lead";

export type BackingCategory = { id: string; label: string; hint: string };

export type BackingTrack = { id: string; title: string; category: string; style: StyleId; layers: Layer[] };

export const BACKING_CATEGORIES: BackingCategory[] = [
  { id: "grooves", label: "Grooves completos", hint: "Batería, bajo y acordes listos para mezclar" },
  { id: "beats", label: "Beats", hint: "Solo batería, para rapear, locutar o sumar tu música" },
  { id: "bajos", label: "Bajos", hint: "Líneas de bajo para montar sobre otro beat" },
  { id: "acordes", label: "Acordes y pads", hint: "Armonías, pianos y arpegios" },
  { id: "percusion", label: "Percusión", hint: "Congas, shakers y loops de percusión" },
];

const ALL: Layer[] = ["drums", "bass", "harmony", "lead"];

const groove = (style: StyleId, title: string): BackingTrack => ({ id: `groove-${style}`, title, category: "grooves", style, layers: ALL });

const beat = (style: StyleId, title: string): BackingTrack => ({ id: `beat-${style}`, title, category: "beats", style, layers: ["drums"] });

export const BACKING_TRACKS: BackingTrack[] = [
  groove("house", "House clásico"),
  groove("deep", "Deep house"),
  groove("tech", "Tech house"),
  groove("techno", "Techno"),
  groove("acid", "Acid techno"),
  groove("trance", "Trance"),
  groove("dnb", "Drum & bass"),
  groove("boombap", "Hip hop boom bap"),
  groove("trap", "Trap"),
  groove("lofi", "Lo-fi chill"),
  groove("reggaeton", "Reggaetón (dembow)"),
  groove("moombah", "Moombahton"),
  groove("cumbia", "Cumbia"),
  groove("electrocumbia", "Electrocumbia"),
  groove("guaracha", "Guaracha"),
  groove("afro", "Afro house"),
  groove("disco", "Disco funk"),
  groove("synthwave", "Synthwave"),
  groove("dubstep", "Dubstep"),
  groove("reggae", "Reggae one drop"),
  beat("house", "Beat house"),
  beat("techno", "Beat techno"),
  beat("boombap", "Beat hip hop"),
  beat("trap", "Beat trap"),
  beat("reggaeton", "Beat reggaetón"),
  beat("cumbia", "Beat cumbia"),
  beat("dnb", "Beat drum & bass"),
  beat("lofi", "Beat lo-fi"),
  { id: "bass-house", title: "Bajo house", category: "bajos", style: "house", layers: ["bass"] },
  { id: "bass-trap", title: "808 de trap", category: "bajos", style: "trap", layers: ["bass"] },
  { id: "bass-reggaeton", title: "Bajo de reggaetón", category: "bajos", style: "reggaeton", layers: ["bass"] },
  { id: "bass-acid", title: "Línea acid 303", category: "bajos", style: "acid", layers: ["bass"] },
  { id: "bass-disco", title: "Bajo disco en octavas", category: "bajos", style: "disco", layers: ["bass"] },
  { id: "pad-ambient", title: "Pad ambiental", category: "acordes", style: "ambient", layers: ["bass", "harmony", "lead"] },
  { id: "chords-house", title: "Stabs de house", category: "acordes", style: "house", layers: ["harmony"] },
  { id: "chords-lofi", title: "Piano lo-fi", category: "acordes", style: "lofi", layers: ["harmony"] },
  { id: "chords-synthwave", title: "Arpegio synthwave", category: "acordes", style: "synthwave", layers: ["harmony", "lead"] },
  { id: "chords-disco", title: "Cuerdas disco", category: "acordes", style: "disco", layers: ["harmony"] },
  { id: "perc-latin", title: "Percusión latina", category: "percusion", style: "latin", layers: ["drums"] },
  { id: "perc-afro", title: "Percusión afro", category: "percusion", style: "afroPerc", layers: ["drums"] },
  { id: "perc-top", title: "Top loop de shaker", category: "percusion", style: "topLoop", layers: ["drums"] },
];

const NOTES = ["Do", "Do♯", "Re", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "La♭", "La", "Si♭", "Si"];

/** Bars of the phrase that is rendered and repeated: fills and crashes mark its edges. */
export const PHRASE_BARS = 8;

const phraseSeconds = (track: BackingTrack) => (PHRASE_BARS * 240) / STYLES[track.style].bpm;

/** Times the phrase repeats, so every track lasts about a minute. */
export function repeatsOf(track: BackingTrack): number {
  return Math.max(2, Math.round(60 / phraseSeconds(track)));
}

export function secondsOf(track: BackingTrack): number {
  return phraseSeconds(track) * repeatsOf(track);
}

export function bpmOf(track: BackingTrack): number {
  return STYLES[track.style].bpm;
}

/** «La menor», «Sol mayor»: the key of the first chord, for harmonic mixing. */
export function keyOf(track: BackingTrack): string {
  const style = STYLES[track.style];
  const [root, quality] = style.progression[0];
  return `${NOTES[(style.key + root) % 12]} ${quality.startsWith("m") ? "menor" : "mayor"}`;
}
