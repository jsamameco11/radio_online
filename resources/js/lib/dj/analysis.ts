/** Waveform bins per second of audio: enough detail for the zoomed, scrolling view. */
export const WAVE_RATE = 150;

/** The three bands of a track (lows, mids, highs), between 0 and 1, WAVE_RATE bins per second. */
export interface Waveform {
  low: Float32Array;
  mid: Float32Array;
  high: Float32Array;
}

export interface TrackAnalysis {
  waveform: Waveform;
  /** Tempo of the track as recorded; null when no steady beat was found. */
  bpm: number | null;
  /** Second of the first beat of the grid. */
  grid: number;
  /** Overall RMS level, for auto gain. */
  rms: number;
}

const MIN_BPM = 70;
const MAX_BPM = 180;
/** Only this much of the track is used for the tempo, so long sets stay fast to analyse. */
const TEMPO_WINDOW_SECONDS = 360;

/**
 * Splits the track into lows (< 200 Hz), mids and highs (> 2.5 kHz) with one-pole filters, and
 * finds its tempo and first beat from the onsets of the low and mid bands: an autocorrelation
 * picks the beat period, then a comb over nearby tempos and every phase refines both.
 */
export function analyze(buffer: AudioBuffer): TrackAnalysis {
  const rate = buffer.sampleRate;
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const per = Math.max(1, Math.round(rate / WAVE_RATE));
  const bins = Math.ceil(left.length / per);
  const low = new Float32Array(bins);
  const mid = new Float32Array(bins);
  const high = new Float32Array(bins);
  const aLow = 1 - Math.exp((-2 * Math.PI * 200) / rate);
  const aHigh = 1 - Math.exp((-2 * Math.PI * 2500) / rate);
  let lp1 = 0;
  let lp2 = 0;
  let total = 0;
  for (let b = 0; b < bins; b++) {
    const start = b * per;
    const end = Math.min(left.length, start + per);
    let sl = 0;
    let sm = 0;
    let sh = 0;
    for (let i = start; i < end; i++) {
      const x = (left[i] + right[i]) * 0.5;
      lp1 += aLow * (x - lp1);
      lp2 += aHigh * (x - lp2);
      const m = lp2 - lp1;
      const h = x - lp2;
      sl += lp1 * lp1;
      sm += m * m;
      sh += h * h;
      total += x * x;
    }
    const n = Math.max(1, end - start);
    low[b] = Math.sqrt(sl / n);
    mid[b] = Math.sqrt(sm / n);
    high[b] = Math.sqrt(sh / n);
  }

  const { bpm, grid } = tempo(low, mid);
  [low, mid, high].forEach(normalize);
  return { waveform: { low, mid, high }, bpm, grid, rms: Math.sqrt(total / Math.max(1, left.length)) };
}

function normalize(band: Float32Array): void {
  let max = 0;
  for (const value of band) max = Math.max(max, value);
  if (max <= 0) return;
  for (let i = 0; i < band.length; i++) band[i] = Math.min(1, band[i] / max);
}

function tempo(low: Float32Array, mid: Float32Array): { bpm: number | null; grid: number } {
  const frames = Math.min(low.length, TEMPO_WINDOW_SECONDS * WAVE_RATE);
  if (frames < WAVE_RATE * 8) return { bpm: null, grid: 0 };
  const onset = new Float32Array(frames);
  let previous = 0;
  let mean = 0;
  for (let i = 0; i < frames; i++) {
    const energy = Math.log10(1e-6 + low[i] * low[i] * 2 + mid[i] * mid[i]);
    onset[i] = Math.max(0, energy - previous);
    previous = energy;
    mean += onset[i];
  }
  mean /= frames;
  for (let i = 0; i < frames; i++) onset[i] = Math.max(0, onset[i] - mean);

  const minLag = Math.floor((60 * WAVE_RATE) / MAX_BPM);
  const maxLag = Math.ceil((60 * WAVE_RATE) / MIN_BPM);
  const ac = new Float32Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < frames; i++) sum += onset[i] * onset[i + lag];
    ac[lag] = sum;
  }
  let bestLag = 0;
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * WAVE_RATE) / lag;
    const preference = Math.exp(-0.5 * (Math.log2(bpm / 122) / 0.9) ** 2);
    const score = ac[lag] * preference;
    if (score > best) {
      best = score;
      bestLag = lag;
    }
  }
  if (!bestLag || best <= 0) return { bpm: null, grid: 0 };
  const a = ac[bestLag - 1];
  const b = ac[bestLag];
  const c = ac[bestLag + 1];
  const shift = a - 2 * b + c === 0 ? 0 : (0.5 * (a - c)) / (a - 2 * b + c);
  const rough = (60 * WAVE_RATE) / (bestLag + Math.max(-0.5, Math.min(0.5, shift)));

  let found = { bpm: rough, phase: 0, score: -1 };
  for (let candidate = rough - 1.5; candidate <= rough + 1.5; candidate += 0.02) {
    const hit = comb(onset, candidate);
    if (hit.score > found.score) found = { bpm: candidate, ...hit };
  }
  let bpm = Math.round(found.bpm * 100) / 100;
  if (Math.abs(bpm - Math.round(bpm)) < 0.06) {
    bpm = Math.round(bpm);
    found = { bpm, ...comb(onset, bpm) };
  }
  return { bpm, grid: found.phase / WAVE_RATE };
}

/** How strongly the onsets line up with a beat of `bpm`, at the best phase (in frames). */
function comb(onset: Float32Array, bpm: number): { phase: number; score: number } {
  const period = (60 * WAVE_RATE) / bpm;
  let bestPhase = 0;
  let best = -1;
  for (let phase = 0; phase < period; phase += 1) {
    let sum = 0;
    for (let t = phase; t < onset.length; t += period) {
      const i = Math.min(onset.length - 1, Math.round(t));
      sum += onset[i] + 0.5 * ((onset[i - 1] ?? 0) + (onset[i + 1] ?? 0));
    }
    if (sum > best) {
      best = sum;
      bestPhase = phase;
    }
  }
  return { phase: bestPhase, score: best };
}
