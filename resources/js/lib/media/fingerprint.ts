/**
 * Acoustic comparison of two songs in the browser, to tell whether a song about to be uploaded is the very recording
 * already in the library. Each audio is decoded at 11 kHz mono and reduced to a robust print (Haitsma–Kalker): 32 bits
 * every 23 ms, one per pair of neighbouring bands between 300 Hz and 3 kHz, telling whether their energy difference rose
 * or fell since the moment before. Two copies of one recording keep most bits after another encoding, a volume change
 * or a trimmed silence; another recording of the song (live, another mix, a cover) does not.
 */

const RATE = 11025;
const FRAME = 2048;
const HOP = 256;
const BANDS = 33;
const LOW_HZ = 300;
const HIGH_HZ = 3000;
/** Seconds of each audio that are printed: enough to tell, quick to read. */
const SPAN = 210;
/** Bytes downloaded from the start of a library song: about three minutes of a 192 kbps MP3. */
const PREFIX_BYTES = 4 * 1024 * 1024;
/** Seconds the level is measured over, the same for a whole file and for the start of a library song. */
const LEVEL_SECONDS = 120;
/** How much later one may start than the other: a longer intro, a cut silence or a video's opening. */
const MAX_SHIFT_SECONDS = 45;
/** Seconds both have to share to be compared. */
const MIN_OVERLAP_SECONDS = 15;
/** Seconds per window of the coincidence along the song. */
export const WINDOW_SECONDS = 5;
const PEAKS = 320;
/** Share of different bits up to which two prints are one recording, and up to which they are close. */
const SAME_RATE = 0.3;
const CLOSE_RATE = 0.4;
/** How a share of different bits reads as a coincidence: [bit error rate, coincidence]. */
const SCALE: [number, number][] = [
  [0, 1],
  [0.15, 0.95],
  [SAME_RATE, 0.7],
  [CLOSE_RATE, 0.5],
  [0.48, 0.1],
  [0.5, 0],
];

export interface AudioPrint {
  bits: Uint32Array;
  /** Loudest point of each slice of the part that was read, from 0 to 1, to draw its wave. */
  peaks: Float32Array;
  /** Length of the whole audio (estimated from its size when only its start was downloaded). */
  seconds: number;
  /** Size of the whole file. */
  bytes: number;
  /** Kilobits per second of the file. */
  kbps: number | null;
  /** Share of the audio that was read: a library song is compared by its start, without downloading all of it. */
  covered: number;
  /** Average level of its first two minutes, in dBFS. */
  loudness: number | null;
}

export type AcousticVerdict = "same" | "close" | "different";

export interface AcousticMatch {
  /** How much the sound coincides once aligned, from 0 (unrelated) to 1 (identical). */
  score: number;
  verdict: AcousticVerdict;
  /** Seconds the second audio is ahead of the first: a moment `t` of the first sounds at `t + offset` in the second. */
  offset: number;
  /** Seconds compared once aligned. */
  overlap: number;
  /** Coincidence every few seconds along the first audio. */
  timeline: { at: number; score: number }[];
}

const fileCache = new WeakMap<Blob, Promise<AudioPrint>>();
const urlCache = new Map<string, Promise<AudioPrint>>();

/** The print of a file of the upload or of a library song by its address; read once and kept while the page is open. */
export function printOf(source: Blob | string): Promise<AudioPrint> {
  const cached = typeof source === "string" ? urlCache.get(source) : fileCache.get(source);
  if (cached) return cached;
  const promise = read(source);
  if (typeof source === "string") urlCache.set(source, promise);
  else fileCache.set(source, promise);
  promise.catch(() => (typeof source === "string" ? urlCache.delete(source) : fileCache.delete(source)));
  return promise;
}

async function read(source: Blob | string): Promise<AudioPrint> {
  if (typeof source !== "string") {
    const size = source.size;
    return summarize(await decode(await source.arrayBuffer()), size, size);
  }
  const start = await download(source, PREFIX_BYTES);
  const length = start.data.byteLength;
  if (length < start.total) {
    const buffer = await decode(start.data).catch(() => null);
    if (buffer && buffer.duration >= MIN_OVERLAP_SECONDS * 2) return summarize(buffer, length, start.total);
  }
  const whole = length < start.total ? await download(source, null) : start;
  return summarize(await decode(whole.data), whole.data.byteLength, whole.total);
}

/** The file, or its first `limit` bytes when the storage serves parts of it, with the size of the whole file. */
async function download(url: string, limit: number | null) {
  const response = await fetch(url, { headers: limit ? { Range: `bytes=0-${limit - 1}` } : {} });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.arrayBuffer();
  const total = response.status === 206 ? Number(response.headers.get("Content-Range")?.split("/")[1]) : NaN;
  return { data, total: Number.isFinite(total) && total >= data.byteLength ? total : data.byteLength };
}

async function summarize(buffer: AudioBuffer, read: number, total: number): Promise<AudioPrint> {
  const samples = mono(buffer, SPAN);
  const covered = Math.min(1, read / total);
  return {
    bits: await print(samples),
    peaks: peaks(buffer),
    seconds: buffer.duration / covered,
    bytes: total,
    kbps: bitrate(read, buffer.duration),
    covered,
    loudness: level(samples.subarray(0, LEVEL_SECONDS * RATE)),
  };
}

async function decode(data: ArrayBuffer): Promise<AudioBuffer> {
  let context: OfflineAudioContext;
  try {
    context = new OfflineAudioContext(1, 1, RATE);
  } catch {
    context = new OfflineAudioContext(1, 1, 44100);
  }
  return context.decodeAudioData(data);
}

/** The first `seconds` of the audio at RATE, both channels mixed. */
function mono(buffer: AudioBuffer, seconds: number): Float32Array {
  const step = buffer.sampleRate / RATE;
  const length = Math.min(Math.floor(buffer.length / step), Math.floor(seconds * RATE));
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const out = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    const start = Math.floor(index * step);
    const end = Math.max(start + 1, Math.floor((index + 1) * step));
    let sum = 0;
    for (const channel of channels) for (let at = start; at < end; at++) sum += channel[at];
    out[index] = sum / (channels.length * (end - start));
  }
  return out;
}

function peaks(buffer: AudioBuffer): Float32Array {
  const channel = buffer.getChannelData(0);
  const slice = Math.max(1, Math.floor(channel.length / PEAKS));
  const stride = Math.max(1, Math.floor(slice / 400));
  const out = new Float32Array(PEAKS);
  let loudest = 0;
  for (let index = 0; index < PEAKS; index++) {
    let peak = 0;
    for (let at = index * slice; at < Math.min(channel.length, (index + 1) * slice); at += stride) peak = Math.max(peak, Math.abs(channel[at]));
    out[index] = peak;
    loudest = Math.max(loudest, peak);
  }
  if (loudest > 0) for (let index = 0; index < PEAKS; index++) out[index] /= loudest;
  return out;
}

function level(samples: Float32Array): number | null {
  if (!samples.length) return null;
  let sum = 0;
  for (let index = 0; index < samples.length; index++) sum += samples[index] * samples[index];
  const rms = Math.sqrt(sum / samples.length);
  return rms > 0 ? 20 * Math.log10(rms) : null;
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

async function print(samples: Float32Array): Promise<Uint32Array> {
  const frames = samples.length >= FRAME ? Math.floor((samples.length - FRAME) / HOP) + 1 : 0;
  const bits = new Uint32Array(Math.max(0, frames - 1));
  const { reverse, cos, sin } = tables(FRAME);
  const window = Float64Array.from({ length: FRAME }, (_, index) => 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (FRAME - 1)));
  const edges = Array.from({ length: BANDS + 1 }, (_, band) => Math.round((LOW_HZ * Math.pow(HIGH_HZ / LOW_HZ, band / BANDS) * FRAME) / RATE));
  const re = new Float64Array(FRAME);
  const im = new Float64Array(FRAME);
  let energy = new Float64Array(BANDS);
  let before = new Float64Array(BANDS);
  for (let frame = 0; frame < frames; frame++) {
    const offset = frame * HOP;
    for (let index = 0; index < FRAME; index++) {
      re[reverse[index]] = samples[offset + index] * window[index];
      im[index] = 0;
    }
    fft(re, im, cos, sin);
    for (let band = 0; band < BANDS; band++) {
      let sum = 0;
      for (let bin = edges[band]; bin < Math.max(edges[band] + 1, edges[band + 1]); bin++) sum += re[bin] * re[bin] + im[bin] * im[bin];
      energy[band] = sum;
    }
    if (frame > 0) {
      let word = 0;
      for (let bit = 0; bit < 32; bit++) {
        if (energy[bit] - energy[bit + 1] - (before[bit] - before[bit + 1]) > 0) word |= 1 << bit;
      }
      bits[frame - 1] = word >>> 0;
    }
    [before, energy] = [energy, before];
    if (frame % 500 === 499) await pause();
  }
  return bits;
}

function tables(size: number) {
  const levels = Math.log2(size);
  const reverse = new Uint32Array(size);
  for (let index = 0; index < size; index++) {
    let value = 0;
    for (let bit = 0; bit < levels; bit++) value = (value << 1) | ((index >>> bit) & 1);
    reverse[index] = value;
  }
  const cos = Float64Array.from({ length: size / 2 }, (_, index) => Math.cos((2 * Math.PI * index) / size));
  const sin = Float64Array.from({ length: size / 2 }, (_, index) => Math.sin((2 * Math.PI * index) / size));
  return { reverse, cos, sin };
}

/** In-place radix-2 FFT of data already in bit-reversed order. */
function fft(re: Float64Array, im: Float64Array, cos: Float64Array, sin: Float64Array) {
  const size = re.length;
  for (let width = 2; width <= size; width *= 2) {
    const half = width / 2;
    const step = size / width;
    for (let start = 0; start < size; start += width) {
      for (let index = 0; index < half; index++) {
        const a = start + index;
        const b = a + half;
        const wr = cos[index * step];
        const wi = -sin[index * step];
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

function ones(value: number) {
  value -= (value >>> 1) & 0x55555555;
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  return Math.imul((value + (value >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}

function coincidence(rate: number) {
  for (let index = 1; index < SCALE.length; index++) {
    const [toRate, toScore] = SCALE[index];
    if (rate <= toRate) {
      const [fromRate, fromScore] = SCALE[index - 1];
      return fromScore + ((rate - fromRate) / (toRate - fromRate)) * (toScore - fromScore);
    }
  }
  return 0;
}

/** How the sound of two audios coincides at their best alignment, or null when they are too short to tell. */
export function compareAudio(first: AudioPrint, second: AudioPrint): AcousticMatch | null {
  const a = first.bits;
  const b = second.bits;
  const perSecond = RATE / HOP;
  const minOverlap = Math.min(Math.round(MIN_OVERLAP_SECONDS * perSecond), Math.floor(Math.min(a.length, b.length) * 0.5));
  if (minOverlap < 40) return null;
  const maxShift = Math.round(MAX_SHIFT_SECONDS * perSecond);
  const errorRate = (shift: number, stride: number) => {
    const start = Math.max(0, -shift);
    const end = Math.min(a.length, b.length - shift);
    if (end - start < minOverlap) return 1;
    let errors = 0;
    let count = 0;
    for (let index = start; index < end; index += stride) {
      errors += ones(a[index] ^ b[index + shift]);
      count++;
    }
    return errors / (count * 32);
  };
  let shift = 0;
  let rate = 1;
  for (let candidate = -maxShift; candidate <= maxShift; candidate++) {
    const value = errorRate(candidate, 8);
    if (value < rate) [rate, shift] = [value, candidate];
  }
  const coarse = shift;
  rate = 1;
  for (let candidate = coarse - 2; candidate <= coarse + 2; candidate++) {
    const value = errorRate(candidate, 1);
    if (value < rate) [rate, shift] = [value, candidate];
  }
  if (rate >= 1) return null;

  const start = Math.max(0, -shift);
  const end = Math.min(a.length, b.length - shift);
  const window = Math.round(WINDOW_SECONDS * perSecond);
  const timeline: AcousticMatch["timeline"] = [];
  for (let from = start; from < end; from += window) {
    const to = Math.min(end, from + window);
    let errors = 0;
    for (let index = from; index < to; index++) errors += ones(a[index] ^ b[index + shift]);
    if (to - from >= window / 3) timeline.push({ at: from / perSecond, score: coincidence(errors / ((to - from) * 32)) });
  }
  return {
    score: coincidence(rate),
    verdict: rate <= SAME_RATE ? "same" : rate <= CLOSE_RATE ? "close" : "different",
    offset: shift / perSecond,
    overlap: (end - start) / perSecond,
    timeline,
  };
}

/** Kilobits per second of an audio file, or null when it cannot be told. */
export function bitrate(bytes: number, seconds: number | null) {
  return seconds && seconds > 0 && bytes > 0 ? Math.round((bytes * 8) / seconds / 1000) : null;
}
