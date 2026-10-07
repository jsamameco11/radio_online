/** What a deck processor reports about ten times per 100 ms: its position (in samples) at `at` (context time). */
export interface DeckReport {
  pos: number;
  rate: number;
  playing: boolean;
  at: number;
  ended: boolean;
}

export type DeckCommand =
  | { t: "load"; left: Float32Array; right: Float32Array | null }
  | { t: "unload" }
  | { t: "play"; on: boolean }
  | { t: "seek"; pos: number }
  | { t: "tempo"; value: number }
  | { t: "keylock"; on: boolean }
  | { t: "reverse"; on: boolean }
  | { t: "bend"; value: number }
  | { t: "scratch"; on: boolean; velocity: number }
  | { t: "loop"; on: boolean; start: number; end: number };

/**
 * A DJ deck on the audio thread: it plays a decoded track at any speed (cubic interpolation),
 * forwards or backwards, follows the platter while scratching, loops sample-exact and, with key
 * lock, keeps the original pitch at any tempo (WSOLA: overlapping grains aligned by correlation).
 * Speed changes are smoothed over a few milliseconds so play, stop and pitch bends never click.
 */
const SOURCE = `
const GRAIN = 2048;
const HALF = GRAIN / 2;
const SEARCH = 512;
const MATCH = 512;
const WINDOW = new Float32Array(GRAIN + 1);
for (let i = 0; i <= GRAIN; i++) WINDOW[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / GRAIN);

class DjDeckProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.left = null;
    this.right = null;
    this.length = 0;
    this.pos = 0;
    this.rate = 0;
    this.tempo = 1;
    this.bend = 0;
    this.playing = false;
    this.reverse = false;
    this.keylock = false;
    this.scratching = false;
    this.velocity = 0;
    this.loopOn = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.stretching = false;
    this.grains = [{ read: 0, phase: 0 }, { read: 0, phase: HALF }];
    this.outL = 0;
    this.outR = 0;
    this.blocks = 0;
    this.ended = false;
    this.port.onmessage = (event) => this.receive(event.data);
  }

  receive(m) {
    if (m.t === "load") {
      this.left = m.left;
      this.right = m.right || m.left;
      this.length = m.left.length;
      this.pos = 0;
      this.rate = 0;
      this.playing = false;
      this.loopOn = false;
      this.ended = false;
    } else if (m.t === "unload") {
      this.left = null;
      this.right = null;
      this.length = 0;
      this.playing = false;
    } else if (m.t === "play") {
      this.playing = m.on;
      if (m.on) this.ended = false;
    } else if (m.t === "seek") {
      this.pos = Math.max(0, Math.min(this.length, m.pos));
      this.ended = false;
      this.resetGrains();
    } else if (m.t === "tempo") this.tempo = m.value;
    else if (m.t === "keylock") {
      this.keylock = m.on;
      this.resetGrains();
    } else if (m.t === "reverse") this.reverse = m.on;
    else if (m.t === "bend") this.bend = m.value;
    else if (m.t === "scratch") {
      this.scratching = m.on;
      this.velocity = m.velocity;
    } else if (m.t === "loop") {
      this.loopOn = m.on && m.end > m.start;
      this.loopStart = m.start;
      this.loopEnd = m.end;
    }
    this.report(0);
  }

  resetGrains() {
    this.grains[0].read = this.pos;
    this.grains[0].phase = 0;
    this.grains[1].read = this.pos;
    this.grains[1].phase = HALF;
  }

  wrap(p) {
    if (!this.loopOn) return p;
    const len = this.loopEnd - this.loopStart;
    if (p >= this.loopEnd) return this.loopStart + ((p - this.loopEnd) % len);
    return p;
  }

  read(data, p) {
    const i = Math.floor(p);
    const f = p - i;
    const n = this.length;
    const x0 = i > 0 && i - 1 < n ? data[i - 1] : 0;
    const x1 = i >= 0 && i < n ? data[i] : 0;
    const x2 = i + 1 >= 0 && i + 1 < n ? data[i + 1] : 0;
    const x3 = i + 2 >= 0 && i + 2 < n ? data[i + 2] : 0;
    const c1 = 0.5 * (x2 - x0);
    const c2 = x0 - 2.5 * x1 + 2 * x2 - 0.5 * x3;
    const c3 = 0.5 * (x3 - x0) + 1.5 * (x1 - x2);
    return ((c3 * f + c2) * f + c1) * f + x1;
  }

  mono(p) {
    const i = Math.floor(this.wrap(p));
    if (i < 0 || i >= this.length) return 0;
    return this.left[i] + this.right[i];
  }

  /** A grain starts where the timeline is, shifted to the offset that best continues the grain fading out. */
  restart(grain, other) {
    const base = this.pos;
    let best = 0;
    let score = -Infinity;
    for (let d = -SEARCH; d <= SEARCH; d += 4) {
      let sum = 0;
      for (let k = 0; k < MATCH; k += 4) sum += this.mono(base + d + k) * this.mono(other.read + k);
      if (sum > score) {
        score = sum;
        best = d;
      }
    }
    grain.read = Math.max(0, base + best);
    grain.phase = 0;
  }

  stretched() {
    let l = 0;
    let r = 0;
    for (let g = 0; g < 2; g++) {
      const grain = this.grains[g];
      if (grain.phase >= GRAIN) this.restart(grain, this.grains[1 - g]);
      const w = WINDOW[grain.phase];
      const p = this.wrap(grain.read);
      l += w * this.read(this.left, p);
      r += w * this.read(this.right, p);
      grain.read += 1;
      grain.phase += 1;
    }
    this.outL = l;
    this.outR = r;
  }

  advance(step) {
    const before = this.pos;
    let p = before + step;
    if (this.loopOn) {
      const len = this.loopEnd - this.loopStart;
      if (step > 0 && before < this.loopEnd && p >= this.loopEnd) p -= len;
      else if (step < 0 && before >= this.loopStart && p < this.loopStart) p += len;
    }
    if (p >= this.length) {
      p = this.length;
      if (this.playing && !this.scratching) {
        this.playing = false;
        this.ended = true;
      }
    }
    this.pos = Math.max(0, p);
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out[1] || out[0];
    const frames = L.length;
    if (!this.left) {
      L.fill(0);
      R.fill(0);
      this.report(frames);
      return true;
    }
    const target = this.scratching ? this.velocity : this.playing ? this.tempo * (1 + this.bend) * (this.reverse ? -1 : 1) : 0;
    const smooth = this.scratching ? 0.0025 : 0.004;
    for (let i = 0; i < frames; i++) {
      this.rate += (target - this.rate) * smooth;
      if (Math.abs(this.rate) < 1e-5 && target === 0) this.rate = 0;
      const stretch = this.keylock && !this.scratching && this.rate > 0.05;
      if (stretch !== this.stretching) {
        this.stretching = stretch;
        if (stretch) this.resetGrains();
      }
      if (stretch) {
        this.stretched();
        L[i] = this.outL;
        R[i] = this.outR;
      } else if (this.rate === 0) {
        L[i] = 0;
        R[i] = 0;
      } else {
        L[i] = this.read(this.left, this.pos);
        R[i] = this.read(this.right, this.pos);
      }
      this.advance(this.rate);
    }
    this.blocks += 1;
    if (this.blocks % 4 === 0) this.report(frames);
    return true;
  }

  report(frames) {
    this.port.postMessage({ pos: this.pos, rate: this.rate, playing: this.playing, at: currentTime + frames / sampleRate, ended: this.ended });
    this.ended = false;
  }
}

registerProcessor("dj-deck", DjDeckProcessor);
`;

const modules = new WeakMap<BaseAudioContext, Promise<void>>();

/** Loads the deck processor once per audio context. */
export function loadDeckProcessor(ctx: AudioContext): Promise<void> {
  let loading = modules.get(ctx);
  if (!loading) {
    const url = URL.createObjectURL(new Blob([SOURCE], { type: "application/javascript" }));
    loading = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    modules.set(ctx, loading);
  }
  return loading;
}
