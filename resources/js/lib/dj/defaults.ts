import { HOT_CUES, SAMPLER_SLOTS } from "./constants";
import type { ChannelState, DeckState, DjState, SamplerSlot } from "./types";

export const emptyHotcues = (): (number | null)[] => Array<number | null>(HOT_CUES).fill(null);

export const deckDefaults = (): DeckState => ({
  track: null,
  loading: false,
  error: null,
  playing: false,
  bpm: null,
  grid: 0,
  tempo: 0,
  range: 0.1,
  keylock: true,
  reverse: false,
  vinyl: true,
  sync: false,
  cue: 0,
  hotcues: emptyHotcues(),
  loop: null,
  loopIn: null,
  padMode: "hotcue",
  waveform: null,
  autoGain: 1,
});

const channelDefaults = (): ChannelState => ({ trim: 0, high: 0, mid: 0, low: 0, filter: 0, fader: 0.8, cue: false });

export const djDefaults = (): DjState => ({
  ready: false,
  decks: [deckDefaults(), deckDefaults()],
  channels: [channelDefaults(), channelDefaults()],
  crossfader: 0,
  curve: "smooth",
  master: 0.9,
  cueMix: 0.5,
  phones: 0.8,
  samplerVolume: 0.8,
  fx: { kind: "echo", beats: 1, depth: 0.5, target: "master", on: false },
  sampler: Array<SamplerSlot | null>(SAMPLER_SLOTS).fill(null),
  quantize: true,
  autoGain: true,
  onAir: false,
  talkover: 0.5,
});
