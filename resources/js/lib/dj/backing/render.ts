import { PHRASE_BARS, repeatsOf, type BackingTrack, type Layer } from "./catalog";
import { STYLES, type BassNote, type BassSound, type Drum, type HarmonyPart, type Lead, type Quality, type Style } from "./styles";

/**
 * Backing tracks for the DJ booth, synthesized in the browser (drum machine, bass and chord
 * synths, a generated room and a tempo delay). One 8-bar phrase is rendered offline, its tail
 * folded onto the start so it loops seamlessly, and repeated to about a minute: always the same
 * for the same track and at an exact tempo.
 */

const SR = 44100;
const FLOOR = 0.0001;
const TAIL = 2.5;
const TARGET_RMS = 0.2;
const PEAK = 0.89;

const CHORDS: Record<Quality, number[]> = {
  m: [0, 3, 7],
  M: [0, 4, 7],
  m7: [0, 3, 7, 10],
  M7: [0, 4, 7, 11],
  "7": [0, 4, 7, 10],
  m9: [0, 3, 7, 10, 14],
  sus: [0, 5, 7, 12],
};

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function seeded(text: string) {
  let seed = 2166136261;
  for (const char of text) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Band = [BiquadFilterType, number, number?];

type Env = { peak: number; attack?: number; hold?: number; release: number };

/** A fixed path every hit of one instrument shares: drive, filters, pan, bus and room send. */
type Path = { bands?: Band[]; pan?: number; room?: number; echo?: number; drive?: number; bus?: "drums" | "music" | "master" };

class Studio {
  private readonly step: number;
  private readonly bar: number;
  private readonly random: () => number;
  private readonly noise: AudioBuffer;
  private readonly buses: Record<NonNullable<Path["bus"]>, GainNode>;
  private readonly room: GainNode;
  private readonly echo: GainNode;
  private readonly paths = new Map<string, AudioNode>();

  constructor(
    private readonly ctx: OfflineAudioContext,
    private readonly style: Style,
    seed: string,
  ) {
    this.step = 15 / style.bpm;
    this.bar = this.step * 16;
    this.random = seeded(seed);

    this.noise = ctx.createBuffer(1, SR * 2, SR);
    const white = this.noise.getChannelData(0);
    for (let i = 0; i < white.length; i++) white[i] = this.random() * 2 - 1;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.16;
    compressor.connect(ctx.destination);
    const master = this.gain(0.8, compressor);
    this.buses = { master, drums: this.gain(0.9, master), music: this.gain(1, master) };

    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(2.2);
    reverb.connect(this.gain(0.28, master));
    this.room = this.gain(1, reverb);

    const delay = ctx.createDelay(2);
    delay.delayTime.value = this.step * 3;
    const feedback = this.gain(0.34, delay);
    const tone = this.filter(["lowpass", 2800]);
    delay.connect(tone).connect(feedback);
    tone.connect(this.gain(0.45, master));
    this.echo = this.gain(1, delay);
  }

  play(layers: Set<Layer>): void {
    const { style } = this;
    const { bass } = style;
    if (style.pump && layers.has("drums")) {
      const music = this.buses.music.gain;
      for (let beat = 0; beat < PHRASE_BARS * 4; beat++) {
        const at = beat * this.step * 4;
        music.setValueAtTime(0.42, at);
        music.linearRampToValueAtTime(1, at + this.step * 2.8);
      }
    }
    for (let bar = 0; bar < PHRASE_BARS; bar++) {
      const [root, quality] = style.progression[bar % style.progression.length];
      const tonic = style.key + root;
      if (layers.has("drums")) this.drumBar(bar);
      if (layers.has("bass") && bass) bass.notes.forEach((note) => this.bassNote(bass.sound, bar, tonic, note));
      if (layers.has("harmony")) style.harmony?.forEach((part) => this.chordBar(part, bar, tonic, quality));
      if (layers.has("lead") && style.lead) this.leadBar(style.lead, bar, tonic, quality);
      if (style.crackle) this.crackle(bar);
    }
  }

  // ── Timing ──────────────────────────────────────────────────────────────

  private at(bar: number, step: number): number {
    const swing = step % 2 === 1 ? (this.style.swing ?? 0) * this.step : 0;
    return bar * this.bar + step * this.step + swing;
  }

  private human(velocity: number): number {
    return Math.min(1, velocity * (0.92 + this.random() * 0.16));
  }

  // ── Patterns ────────────────────────────────────────────────────────────

  private drumBar(bar: number): void {
    const drums = this.style.drums ?? {};
    const fillOn = drums.snare ? "snare" : drums.clap ? "clap" : null;
    if (drums.kick && bar === 0) this.hiss(0, { peak: 0.2, release: 1.6 }, this.path({ bands: [["highpass", 4500]], pan: -0.1, room: 0.3, bus: "drums" }));
    (Object.entries(drums) as [Drum, string | string[]][]).forEach(([drum, pattern]) => {
      let line = Array.isArray(pattern) ? pattern[bar % pattern.length] : pattern;
      if (drum === fillOn && bar === PHRASE_BARS - 1) line = `${line.slice(0, 12)}xxrr`;
      [...line].forEach((mark, step) => {
        if (mark === ".") return;
        const t = this.at(bar, step);
        const velocity = this.human(mark === "o" ? 0.55 : 1);
        if (mark === "r" || mark === "t") {
          const hits = mark === "r" ? 2 : 3;
          for (let hit = 0; hit < hits; hit++) this.hit(drum, t + (hit * this.step) / hits, velocity * (0.7 + 0.15 * hit));
        } else {
          this.hit(drum, t, velocity);
        }
      });
    });
  }

  private bassNote(sound: BassSound, bar: number, tonic: number, [step, offset, length, velocity = 1]: BassNote): void {
    const seconds = Math.max(this.step * 0.9, length * this.step - 0.01);
    this.bass(sound, hz(tonic + offset), this.at(bar, step), seconds, this.human(velocity));
  }

  private chordBar(part: HarmonyPart, bar: number, tonic: number, quality: Quality): void {
    const notes = CHORDS[quality].map((interval) => hz(tonic + part.octave + interval));
    part.hits.forEach(([step, length]) => this.chord(part.sound, notes, this.at(bar, step), length * this.step, this.human(0.9)));
  }

  private leadBar(lead: Lead, bar: number, tonic: number, quality: Quality): void {
    const chord = CHORDS[quality].map((interval) => tonic + lead.octave + interval);
    const order = lead.order === "up" ? [...chord, chord[0] + 12] : [...chord, chord[0] + 12, ...chord.slice(1).reverse()];
    lead.steps.forEach((step, index) => this.pluck(hz(order[(bar * lead.steps.length + index) % order.length]), this.at(bar, step), this.human(index === 0 ? 1 : 0.75)));
  }

  // ── Drum machine ────────────────────────────────────────────────────────

  private hit(drum: Drum, t: number, v: number): void {
    const drums = (path: Omit<Path, "bus"> = {}) => this.path({ ...path, bus: "drums" });
    switch (drum) {
      case "kick":
        this.tone(t, "sine", [150, 48, 0.07], { peak: 0.95 * v, hold: 0.02, release: 0.38 }, drums());
        this.hiss(t, { peak: 0.3 * v, release: 0.012 }, drums({ bands: [["highpass", 2500]] }));
        break;
      case "snare":
        this.tone(t, "triangle", [190, 150, 0.08], { peak: 0.45 * v, release: 0.12 }, drums());
        this.hiss(t, { peak: 0.55 * v, release: 0.17 }, drums({ bands: [["bandpass", 2800, 0.6]], room: 0.15 }));
        break;
      case "clap": {
        const path = drums({ bands: [["bandpass", 1300, 1.1]], room: 0.25 });
        [0, 0.011, 0.022].forEach((delay) => this.hiss(t + delay, { peak: 0.5 * v, release: 0.012 }, path));
        this.hiss(t + 0.03, { peak: 0.45 * v, release: 0.16 }, path);
        break;
      }
      case "rim":
        this.tone(t, "triangle", 1650, { peak: 0.3 * v, release: 0.035 }, drums({ pan: 0.1 }));
        this.hiss(t, { peak: 0.22 * v, release: 0.02 }, drums({ bands: [["bandpass", 2600, 1.5]], pan: 0.1 }));
        break;
      case "hatC":
        this.hiss(t, { peak: 0.26 * v, release: 0.045 }, drums({ bands: [["highpass", 7500], ["peaking", 10000, 1]], pan: 0.15 }));
        break;
      case "hatO":
        this.hiss(t, { peak: 0.2 * v, release: 0.26 }, drums({ bands: [["highpass", 7000], ["peaking", 10000, 1]], pan: 0.2 }));
        break;
      case "ride":
        this.hiss(t, { peak: 0.12 * v, release: 0.45 }, drums({ bands: [["bandpass", 8500, 0.7]], pan: -0.2, room: 0.1 }));
        break;
      case "shaker":
        this.hiss(t, { peak: 0.15 * v, attack: 0.012, release: 0.06 }, drums({ bands: [["bandpass", 6500, 1]], pan: -0.25 }));
        break;
      case "congaHigh":
        this.tone(t, "sine", [390, 340, 0.03], { peak: 0.5 * v, release: 0.22 }, drums({ pan: 0.3 }));
        this.hiss(t, { peak: 0.12 * v, release: 0.015 }, drums({ bands: [["bandpass", 2200, 1]], pan: 0.3 }));
        break;
      case "congaLow":
        this.tone(t, "sine", [255, 215, 0.04], { peak: 0.55 * v, release: 0.3 }, drums({ pan: -0.2 }));
        break;
      case "bongo":
        this.tone(t, "sine", [580, 520, 0.02], { peak: 0.35 * v, release: 0.1 }, drums({ pan: 0.35 }));
        break;
      case "cowbell": {
        const path = drums({ bands: [["bandpass", 1100, 1.2]], pan: -0.3 });
        [562, 845].forEach((freq) => this.tone(t, "square", freq, { peak: 0.08 * v, release: 0.22 }, path));
        break;
      }
      case "guiro":
        this.scrape(t, 0.2 * v, drums({ bands: [["bandpass", 3800, 2]], pan: 0.25 }));
        break;
      case "clave":
        this.tone(t, "sine", 2500, { peak: 0.28 * v, release: 0.05 }, drums({ pan: 0.2 }));
        break;
      case "tom":
        this.tone(t, "sine", [165, 110, 0.12], { peak: 0.5 * v, release: 0.3 }, drums({ pan: -0.15 }));
        break;
    }
  }

  private crackle(bar: number): void {
    const path = this.path({ bands: [["highpass", 1800]], bus: "master" });
    for (let pop = 0; pop < 14; pop++) this.hiss(bar * this.bar + this.random() * this.bar, { peak: 0.02 + this.random() * 0.06, attack: 0.0005, release: 0.003 }, path);
  }

  // ── Synths ──────────────────────────────────────────────────────────────

  private bass(sound: BassSound, freq: number, t: number, seconds: number, v: number): void {
    const hold = Math.max(0, seconds - 0.06);
    const music = this.path({ bus: "music" });
    switch (sound) {
      case "sub":
        this.tone(t, "sine", freq, { peak: 0.55 * v, attack: 0.006, hold, release: 0.06 }, music);
        this.tone(t, "triangle", freq * 2, { peak: 0.1 * v, attack: 0.006, hold, release: 0.06 }, music);
        break;
      case "808":
        this.tone(t, "sine", [freq * 1.6, freq, 0.03], { peak: 0.7 * v, attack: 0.003, hold: seconds * 0.85, release: 0.12 }, this.path({ drive: 2, bus: "music" }));
        break;
      case "saw":
        this.sweep(t, ["sawtooth", "square"], freq, [1500 * v + 300, 380, Math.min(seconds, 0.25)], 5, { peak: 0.2 * v, attack: 0.004, hold, release: 0.05 }, music);
        break;
      case "acid":
        this.sweep(t, ["sawtooth"], freq, [2600 * v, 320, 0.16], 13, { peak: 0.17, attack: 0.003, hold, release: 0.04 }, this.path({ drive: 3, bus: "music" }));
        break;
      case "reese":
        [-14, 14].forEach((cents) => this.tone(t, "sawtooth", freq, { peak: 0.22 * v, attack: 0.02, hold, release: 0.08 }, this.path({ bands: [["lowpass", 520, 1]], bus: "music" }), cents));
        break;
      case "octave":
        this.sweep(t, ["sawtooth"], freq, [2200, 600, 0.18], 4, { peak: 0.2 * v, attack: 0.003, hold: seconds * 0.6, release: 0.06 }, music);
        break;
      case "wobble": {
        const filter = this.filter(["lowpass", 650, 8]);
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = (this.style.bpm / 60) * 2;
        const depth = this.ctx.createGain();
        depth.gain.value = 520;
        lfo.connect(depth).connect(filter.frequency);
        lfo.start(t);
        lfo.stop(t + seconds + 0.1);
        filter.connect(music);
        (["sawtooth", "square"] as OscillatorType[]).forEach((type) => this.tone(t, type, freq, { peak: 0.24 * v, attack: 0.01, hold, release: 0.06 }, filter));
        break;
      }
    }
  }

  private chord(sound: HarmonyPart["sound"], notes: number[], t: number, seconds: number, v: number): void {
    notes.forEach((freq, index) => {
      const pan = index % 2 ? 0.3 : -0.3;
      switch (sound) {
        case "stab": {
          const path = this.path({ bands: [["lowpass", 2400]], pan, room: 0.25, bus: "music" });
          [-7, 7].forEach((cents) => this.tone(t, "sawtooth", freq, { peak: 0.06 * v, attack: 0.003, hold: 0.05, release: 0.2 }, path, cents));
          break;
        }
        case "pad": {
          const path = this.path({ bands: [["lowpass", 1300, 0.5]], pan, room: 0.45, bus: "music" });
          [-11, 0, 11].forEach((cents) => this.tone(t, "sawtooth", freq, { peak: 0.035 * v, attack: 0.45, hold: Math.max(0, seconds - 0.6), release: 0.9 }, path, cents));
          break;
        }
        case "piano": {
          const path = this.path({ bands: [["lowpass", 3200]], pan, room: 0.25, bus: "music" });
          const cents = (this.random() - 0.5) * 12;
          [
            [1, 0.12],
            [2, 0.05],
            [3, 0.02],
          ].forEach(([partial, level]) => this.tone(t, "sine", freq * partial, { peak: level * v, attack: 0.004, release: Math.min(1.8, seconds + 0.6) }, path, cents));
          break;
        }
        case "organ":
          this.tone(t, "square", freq, { peak: 0.045 * v, attack: 0.004, hold: 0.08, release: 0.12 }, this.path({ bands: [["lowpass", 1900]], pan, room: 0.2, bus: "music" }));
          break;
        case "strings": {
          const path = this.path({ bands: [["lowpass", 3200]], pan, room: 0.4, bus: "music" });
          [-9, 9].forEach((cents) => this.tone(t, "sawtooth", freq, { peak: 0.03 * v, attack: 0.25, hold: Math.max(0, seconds - 0.35), release: 0.5 }, path, cents));
          break;
        }
      }
    });
  }

  private pluck(freq: number, t: number, v: number): void {
    this.sweep(t, ["square"], freq, [4000, 900, 0.15], 2, { peak: 0.07 * v, attack: 0.002, release: 0.2 }, this.path({ room: 0.2, echo: 0.35, bus: "music" }));
  }

  // ── Building blocks ─────────────────────────────────────────────────────

  private gain(value: number, to: AudioNode): GainNode {
    const node = this.ctx.createGain();
    node.gain.value = value;
    node.connect(to);
    return node;
  }

  private filter([type, frequency, q]: Band): BiquadFilterNode {
    const node = this.ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    if (q !== undefined) node.Q.value = q;
    return node;
  }

  /** The entry of a shared path, built the first time it is asked for. */
  private path(path: Path): AudioNode {
    const key = JSON.stringify(path);
    const known = this.paths.get(key);
    if (known) return known;

    let end: AudioNode = this.buses[path.bus ?? "music"];
    if (path.pan) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = path.pan;
      panner.connect(end);
      end = panner;
    }
    const out = this.gain(1, end);
    if (path.room) out.connect(this.gain(path.room, this.room));
    if (path.echo) out.connect(this.gain(path.echo, this.echo));
    let entry: AudioNode = out;
    [...(path.bands ?? [])].reverse().forEach((band) => {
      const filter = this.filter(band);
      filter.connect(entry);
      entry = filter;
    });
    if (path.drive) {
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = driveCurve(path.drive);
      shaper.connect(entry);
      entry = shaper;
    }
    this.paths.set(key, entry);
    return entry;
  }

  /** A gain that opens and closes once. */
  private enveloped(t: number, env: Env, to: AudioNode): GainNode {
    const node = this.ctx.createGain();
    const attack = env.attack ?? 0.001;
    const hold = env.hold ?? 0;
    const end = t + attack + hold + env.release;
    node.gain.setValueAtTime(0, t);
    node.gain.linearRampToValueAtTime(env.peak, t + attack);
    if (hold > 0) node.gain.setValueAtTime(env.peak, t + attack + hold);
    node.gain.exponentialRampToValueAtTime(FLOOR, end);
    node.gain.setValueAtTime(0, end + 0.001);
    node.connect(to);
    return node;
  }

  private length(env: Env): number {
    return (env.attack ?? 0.001) + (env.hold ?? 0) + env.release + 0.02;
  }

  private tone(t: number, type: OscillatorType, freq: number | [number, number, number], env: Env, to: AudioNode, cents = 0): void {
    const node = this.ctx.createOscillator();
    node.type = type;
    node.detune.value = cents;
    if (Array.isArray(freq)) {
      node.frequency.setValueAtTime(freq[0], t);
      node.frequency.exponentialRampToValueAtTime(freq[1], t + freq[2]);
    } else {
      node.frequency.value = freq;
    }
    node.connect(this.enveloped(t, env, to));
    node.start(t);
    node.stop(t + this.length(env));
  }

  /** Oscillators through a resonant low-pass whose cutoff falls from one value to another. */
  private sweep(t: number, types: OscillatorType[], freq: number, [from, to, time]: [number, number, number], q: number, env: Env, path: AudioNode): void {
    const filter = this.filter(["lowpass", from, q]);
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + Math.max(0.01, time));
    filter.connect(this.enveloped(t, env, path));
    types.forEach((type, index) => {
      const node = this.ctx.createOscillator();
      node.type = type;
      node.frequency.value = freq;
      node.detune.value = types.length > 1 ? (index ? 14 : -14) : 0;
      node.connect(filter);
      node.start(t);
      node.stop(t + this.length(env));
    });
  }

  private hiss(t: number, env: Env, to: AudioNode): void {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.connect(this.enveloped(t, env, to));
    source.start(t, this.random() * 1.5);
    source.stop(t + this.length(env));
  }

  /** A güiro stroke: six quick scrapes of noise through one gain. */
  private scrape(t: number, peak: number, to: AudioNode): void {
    const node = this.ctx.createGain();
    node.gain.setValueAtTime(0, t);
    for (let scrape = 0; scrape < 6; scrape++) {
      const at = t + scrape * 0.018;
      node.gain.setValueAtTime(FLOOR, at);
      node.gain.linearRampToValueAtTime(peak, at + 0.004);
      node.gain.exponentialRampToValueAtTime(FLOOR, at + 0.014);
    }
    node.gain.setValueAtTime(0, t + 0.12);
    node.connect(to);
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.connect(node);
    source.start(t, this.random() * 1.5);
    source.stop(t + 0.13);
  }

  private impulse(seconds: number): AudioBuffer {
    const length = Math.round(SR * seconds);
    const buffer = this.ctx.createBuffer(2, length, SR);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (this.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    return buffer;
  }
}

function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * amount) / Math.tanh(amount);
  return curve;
}

/** Renders a backing track: stereo, 44.1 kHz, a whole number of phrases, leveled with peaks under -1 dBFS. */
export async function renderBacking(track: BackingTrack): Promise<AudioBuffer> {
  const style = STYLES[track.style];
  const phrase = Math.round(((PHRASE_BARS * 240) / style.bpm) * SR);
  const ctx = new OfflineAudioContext(2, phrase + Math.round(TAIL * SR), SR);
  new Studio(ctx, style, track.id).play(new Set(track.layers));
  const full = await ctx.startRendering();

  const loops = [0, 1].map((channel) => {
    const source = full.getChannelData(channel);
    const data = source.slice(0, phrase);
    for (let i = phrase; i < source.length; i++) data[i - phrase] += source[i];
    return data;
  });
  let peak = 0;
  let sum = 0;
  loops.forEach((data) => data.forEach((value) => {
    peak = Math.max(peak, Math.abs(value));
    sum += value * value;
  }));
  const rms = Math.sqrt(sum / (phrase * 2));
  const gain = peak > 0 ? Math.min(PEAK / peak, TARGET_RMS / Math.max(rms, 1e-6)) : 1;

  const repeats = repeatsOf(track);
  const out = new AudioBuffer({ numberOfChannels: 2, length: phrase * repeats, sampleRate: SR });
  loops.forEach((data, channel) => {
    data.forEach((value, i) => (data[i] = value * gain));
    for (let repeat = 0; repeat < repeats; repeat++) out.copyToChannel(data, channel, repeat * phrase);
  });
  return out;
}

/** 16-bit PCM WAV of a stereo buffer. */
export function stereoWav(buffer: AudioBuffer, name: string): File {
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const frames = buffer.length;
  const bytes = new ArrayBuffer(44 + frames * 4);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + frames * 4, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * 4, true);
  for (let i = 0; i < frames; i++) {
    view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, left[i])) * 0x7fff, true);
    view.setInt16(46 + i * 4, Math.max(-1, Math.min(1, right[i])) * 0x7fff, true);
  }
  return new File([bytes], name, { type: "audio/wav" });
}

const rendered = new Map<string, Promise<AudioBuffer>>();

export function backingBuffer(track: BackingTrack): Promise<AudioBuffer> {
  let buffer = rendered.get(track.id);
  if (!buffer) {
    buffer = renderBacking(track);
    buffer.catch(() => rendered.delete(track.id));
    rendered.set(track.id, buffer);
  }
  return buffer;
}

const files = new Map<string, Promise<File>>();

/** The track as a WAV file, rendered once per session. */
export function backingFile(track: BackingTrack): Promise<File> {
  let file = files.get(track.id);
  if (!file) {
    file = backingBuffer(track).then((buffer) => stereoWav(buffer, `${track.id}.wav`));
    file.catch(() => files.delete(track.id));
    files.set(track.id, file);
  }
  return file;
}

const urls = new Map<string, string>();

/** A same-session URL of the track, for the sampler (which loads audio by address). */
export async function backingUrl(track: BackingTrack): Promise<string> {
  const known = urls.get(track.id);
  if (known) return known;
  const url = URL.createObjectURL(await backingFile(track));
  urls.set(track.id, url);
  return url;
}

let previewContext: AudioContext | null = null;
let previewSource: AudioBufferSourceNode | null = null;
let previewTurn = 0;

/** Loops a track on this computer only, outside the mix; onEnd runs when it stops or fails. */
export async function previewBacking(track: BackingTrack, onEnd: () => void): Promise<void> {
  stopBackingPreview();
  const turn = previewTurn;
  let buffer: AudioBuffer;
  try {
    previewContext ??= new AudioContext();
    await previewContext.resume();
    buffer = await backingBuffer(track);
  } catch {
    onEnd();
    return;
  }
  if (turn !== previewTurn) {
    onEnd();
    return;
  }
  const source = previewContext.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(previewContext.destination);
  source.onended = () => {
    if (previewSource === source) previewSource = null;
    onEnd();
  };
  previewSource = source;
  source.start();
}

export function stopBackingPreview(): void {
  previewTurn++;
  previewSource?.stop();
  previewSource = null;
}
