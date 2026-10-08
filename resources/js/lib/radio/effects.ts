/**
 * Factory effects of the pad bank. Every sound is synthesized here (oscillators, noise, filters,
 * plucked strings, formant voices and a generated room) and rendered offline, always the same for
 * the same effect. Added to the pad bank it becomes a WAV in the station library like any other
 * audio, so every listener hears exactly that file.
 */

export type EffectCategory = { id: string; label: string; hint: string };

export type FactoryEffect = { id: string; title: string; category: string; seconds: number; make: (kit: Kit) => void };

export const EFFECT_CATEGORIES: EffectCategory[] = [
  { id: "graciosos", label: "Graciosos", hint: "Boing, bocina, risas, trombón triste" },
  { id: "suspenso", label: "Suspenso", hint: "Tensión, latidos, golpes dramáticos" },
  { id: "transiciones", label: "Transiciones", hint: "Whoosh, barridos, reversa, glitch" },
  { id: "impactos", label: "Impactos", hint: "Golpes, platillo, gong, explosión" },
  { id: "alertas", label: "Alertas y avisos", hint: "Ding, timbre, alarma, cuenta regresiva" },
  { id: "celebracion", label: "Celebración", hint: "Fanfarria, aplausos, redoble, ta-dá" },
  { id: "calma", label: "Calma y fantasía", hint: "Campanas, coro, arpa, cuenco" },
  { id: "radio", label: "Radio y locución", hint: "Estática, noticias, jingle, pips" },
  { id: "tecnologia", label: "Tecnología y juegos", hint: "Láser, moneda, 8 bits, robot" },
  { id: "naturaleza", label: "Naturaleza y ambiente", hint: "Lluvia, mar, pájaros, fogata" },
  { id: "musicales", label: "Golpes musicales", hint: "Guitarra, piano, batería, kalimba" },
];

const SR = 44100;

const FLOOR = 0.0001;

type Glide = number | number[];

type Filter = { type: BiquadFilterType; freq: Glide; q?: number; gain?: number };

type Shape = {
  at?: number;
  dur: number;
  vol?: number;
  attack?: number;
  release?: number;
  /** Fades exponentially over the whole duration (a struck or plucked sound). */
  decay?: boolean;
  /** Share sent to the room. */
  wet?: number;
  filter?: Filter;
  /** Tremolo: rate in Hz and depth from 0 to 1. */
  am?: [number, number];
};

type ToneShape = Shape & { freq: Glide; type?: OscillatorType; vibrato?: [number, number]; fm?: [number, number]; linear?: boolean };

type NoiseShape = Shape & { color?: "white" | "pink" | "brown" };

type VoiceShape = Shape & { freq: Glide; vowel?: keyof typeof VOWELS; vibrato?: [number, number] };

/** Formants (frequency, Q, gain) of the sung vowels. */
const VOWELS = {
  a: [[800, 6, 3], [1150, 8, 2], [2900, 10, 1]],
  o: [[450, 6, 3], [800, 8, 1.8], [2830, 10, 0.6]],
  u: [[325, 6, 3], [700, 8, 1.2], [2530, 10, 0.4]],
  e: [[400, 6, 3], [1700, 8, 1.6], [2600, 10, 1]],
} as const;

/** Partials of a large cast bell: ratio, level and share of the length it rings. */
const CAST_BELL: [number, number, number][] = [
  [0.5, 0.5, 1],
  [1, 0.8, 0.85],
  [1.19, 0.6, 0.7],
  [1.5, 0.35, 0.6],
  [2, 0.55, 0.5],
  [2.52, 0.3, 0.35],
  [3, 0.25, 0.3],
  [4.17, 0.18, 0.22],
  [5.43, 0.12, 0.15],
];

export function hz(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Seeded generator, so an effect sounds the same in the preview and in the stored file. */
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

function glide(param: AudioParam, value: Glide, at: number, dur: number, linear = false) {
  const points = Array.isArray(value) ? value : [value];
  param.setValueAtTime(points[0], at);
  points.slice(1).forEach((point, index) => {
    const time = at + (dur * (index + 1)) / (points.length - 1);
    if (linear || point <= 0 || points[index] <= 0) param.linearRampToValueAtTime(point, time);
    else param.exponentialRampToValueAtTime(point, time);
  });
}

function envelope(param: AudioParam, at: number, shape: Shape) {
  const vol = shape.vol ?? 0.8;
  const attack = Math.min(shape.attack ?? 0.004, shape.dur);
  param.setValueAtTime(FLOOR, at);
  param.linearRampToValueAtTime(vol, at + attack);
  if (shape.decay) {
    param.exponentialRampToValueAtTime(FLOOR, at + shape.dur);
  } else {
    const release = Math.max(0, Math.min(shape.release ?? 0.04, shape.dur - attack));
    param.setValueAtTime(vol, at + shape.dur - release);
    param.exponentialRampToValueAtTime(FLOOR, at + shape.dur);
  }
  param.setValueAtTime(0, at + shape.dur + 0.002);
}

export type Kit = ReturnType<typeof createKit>;

function createKit(ctx: BaseAudioContext, seconds: number, seed: string) {
  const random = seeded(seed);
  const rand = (min: number, max: number) => min + random() * (max - min);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const noises = new Map<string, AudioBuffer>();
  let room: GainNode | null = null;

  function reverb() {
    if (!room) {
      const length = Math.round(ctx.sampleRate * 2.6);
      const impulse = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = impulse.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (random() * 2 - 1) * Math.pow(1 - i / length, 3.4);
      const convolver = ctx.createConvolver();
      convolver.buffer = impulse;
      room = ctx.createGain();
      room.gain.value = 0.5;
      room.connect(convolver).connect(out);
    }
    return room;
  }

  function noiseBuffer(color: NonNullable<NoiseShape["color"]>) {
    let buffer = noises.get(color);
    if (!buffer) {
      const length = Math.round(ctx.sampleRate * (seconds + 2));
      buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = random() * 2 - 1;
        if (color === "pink") {
          b0 = 0.99765 * b0 + white * 0.099046;
          b1 = 0.963 * b1 + white * 0.2965164;
          b2 = 0.57 * b2 + white * 1.0526913;
          data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
        } else if (color === "brown") {
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.5;
        } else {
          data[i] = white;
        }
      }
      noises.set(color, buffer);
    }
    return buffer;
  }

  function lfo(target: AudioParam, rate: number, depth: number, at: number, dur: number) {
    const osc = ctx.createOscillator();
    osc.frequency.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = depth;
    osc.connect(gain).connect(target);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  /** Filter, envelope, tremolo and room of any source. */
  function finish(source: AudioNode, at: number, shape: Shape) {
    let node = source;
    if (shape.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = shape.filter.type;
      glide(filter.frequency, shape.filter.freq, at, shape.dur);
      filter.Q.value = shape.filter.q ?? 1;
      if (shape.filter.gain) filter.gain.value = shape.filter.gain;
      node = node.connect(filter);
    }
    const env = ctx.createGain();
    envelope(env.gain, at, shape);
    node = node.connect(env);
    if (shape.am) {
      const tremolo = ctx.createGain();
      tremolo.gain.value = 1 - shape.am[1] / 2;
      lfo(tremolo.gain, shape.am[0], shape.am[1] / 2, at, shape.dur);
      node = node.connect(tremolo);
    }
    node.connect(out);
    if (shape.wet) {
      const send = ctx.createGain();
      send.gain.value = shape.wet;
      node.connect(send).connect(reverb());
    }
  }

  function tone(shape: ToneShape) {
    const at = shape.at ?? 0;
    const osc = ctx.createOscillator();
    osc.type = shape.type ?? "sine";
    glide(osc.frequency, shape.freq, at, shape.dur, shape.linear);
    if (shape.vibrato) lfo(osc.frequency, shape.vibrato[0], shape.vibrato[1], at, shape.dur);
    if (shape.fm) {
      const base = Array.isArray(shape.freq) ? shape.freq[0] : shape.freq;
      const modulator = ctx.createOscillator();
      modulator.frequency.value = base * shape.fm[0];
      const index = ctx.createGain();
      index.gain.setValueAtTime(base * shape.fm[1], at);
      index.gain.exponentialRampToValueAtTime(base * shape.fm[1] * 0.04 + 0.01, at + shape.dur);
      modulator.connect(index).connect(osc.frequency);
      modulator.start(at);
      modulator.stop(at + shape.dur + 0.05);
    }
    finish(osc, at, shape);
    osc.start(at);
    osc.stop(at + shape.dur + 0.05);
  }

  function noise(shape: NoiseShape) {
    const at = shape.at ?? 0;
    const buffer = noiseBuffer(shape.color ?? "white");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    finish(source, at, shape);
    source.start(at, random() * Math.max(0, buffer.duration - shape.dur - 0.2), shape.dur + 0.05);
  }

  function chord(notes: number[], shape: Omit<ToneShape, "freq">) {
    notes.forEach((freq) => tone({ ...shape, freq, vol: (shape.vol ?? 0.8) / Math.sqrt(notes.length) }));
  }

  /** A plucked string (Karplus-Strong): guitar, harp, kalimba. */
  function pluck(freq: number, at = 0, { dur = 2.5, vol = 0.7, damp = 0.996, bright = 0.6, wet = 0 } = {}) {
    const period = Math.max(2, Math.round(ctx.sampleRate / freq));
    const length = Math.round(dur * ctx.sampleRate);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const line = new Float32Array(period);
    let previous = 0;
    for (let i = 0; i < period; i++) {
      previous = bright * (random() * 2 - 1) + (1 - bright) * previous;
      line[i] = previous;
    }
    let index = 0;
    const fade = Math.round(0.03 * ctx.sampleRate);
    for (let i = 0; i < length; i++) {
      const next = (index + 1) % period;
      const value = line[index];
      data[i] = value * (i > length - fade ? (length - i) / fade : 1);
      line[index] = damp * 0.5 * (value + line[next]);
      index = next;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    source.connect(gain).connect(out);
    if (wet) {
      const send = ctx.createGain();
      send.gain.value = wet;
      gain.connect(send).connect(reverb());
    }
    source.start(at);
  }

  /** A sung vowel: a sawtooth through the vowel's formants. */
  function voice(shape: VoiceShape) {
    const at = shape.at ?? 0;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    glide(osc.frequency, shape.freq, at, shape.dur);
    if (shape.vibrato) lfo(osc.frequency, shape.vibrato[0], shape.vibrato[1], at, shape.dur);
    const mix = ctx.createGain();
    VOWELS[shape.vowel ?? "a"].forEach(([freq, q, level]) => {
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = freq;
      band.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = level;
      osc.connect(band).connect(gain).connect(mix);
    });
    finish(mix, at, shape);
    osc.start(at);
    osc.stop(at + shape.dur + 0.05);
  }

  function bell(base: number, at = 0, { vol = 0.7, len = 4, wet = 0.3, partials = CAST_BELL } = {}) {
    partials.forEach(([ratio, level, share]) => tone({ freq: base * ratio * (1 + rand(-0.002, 0.002)), at, dur: len * share, vol: vol * level, decay: true, attack: 0.002, wet }));
    noise({ at, dur: 0.03, vol: vol * 0.3, decay: true, filter: { type: "bandpass", freq: base * 4, q: 2 } });
  }

  function organ(notes: number[], at: number, dur: number, vol = 0.7, wet = 0.5) {
    notes.forEach((freq) =>
      [1, 2, 3, 4, 6].forEach((harmonic, index) =>
        tone({ freq: freq * harmonic, at, dur, vol: (vol * [1, 0.6, 0.35, 0.25, 0.12][index]) / Math.sqrt(notes.length), attack: 0.08, release: 0.5, vibrato: [5.5, freq * 0.002], wet }),
      ),
    );
  }

  function brass(freq: number, at: number, dur: number, vol = 0.6, wet = 0.25) {
    tone({ freq, at, dur, vol, type: "sawtooth", attack: 0.03, release: 0.12, filter: { type: "lowpass", freq: [600, 3200, 2200], q: 1.2 }, vibrato: [5, freq * 0.004], wet });
    tone({ freq: freq * 1.003, at, dur, vol: vol * 0.5, type: "sawtooth", attack: 0.04, release: 0.12, filter: { type: "lowpass", freq: 1800 }, wet });
  }

  function kick(at = 0, vol = 1) {
    tone({ freq: [160, 42], at, dur: 0.45, vol, decay: true });
    noise({ at, dur: 0.02, vol: vol * 0.3, decay: true, filter: { type: "lowpass", freq: 2500 } });
  }

  function snare(at = 0, vol = 0.8) {
    noise({ at, dur: 0.2, vol, decay: true, filter: { type: "highpass", freq: 1500 } });
    tone({ freq: [240, 170], at, dur: 0.1, vol: vol * 0.6, type: "triangle", decay: true });
  }

  function hat(at = 0, vol = 0.35, open = false) {
    noise({ at, dur: open ? 0.4 : 0.05, vol, decay: true, filter: { type: "highpass", freq: 7500 } });
  }

  function crash(at = 0, vol = 0.7, dur = 2.6, wet = 0.2) {
    noise({ at, dur, vol, decay: true, filter: { type: "highpass", freq: 3800 }, wet });
    noise({ at, dur: dur * 0.6, vol: vol * 0.5, decay: true, filter: { type: "bandpass", freq: 8500, q: 0.8 } });
  }

  function tom(at: number, freq: number, vol = 0.8) {
    tone({ freq: [freq * 1.7, freq], at, dur: 0.4, vol, decay: true });
    noise({ at, dur: 0.05, vol: vol * 0.25, decay: true, filter: { type: "lowpass", freq: 1200 } });
  }

  function clap(at: number, vol = 0.6) {
    const freq = rand(900, 1800);
    [0, 0.009, 0.017].forEach((offset) => noise({ at: at + offset, dur: 0.012, vol, decay: true, filter: { type: "bandpass", freq, q: 1.4 } }));
    noise({ at: at + 0.022, dur: rand(0.05, 0.11), vol: vol * 0.8, decay: true, filter: { type: "bandpass", freq, q: 1 } });
  }

  function crickets(at: number, dur: number, freq = 4600, vol = 0.25) {
    for (let chirp = at + rand(0, 0.3); chirp < at + dur - 0.2; chirp += rand(0.45, 0.65)) {
      for (let pulse = 0; pulse < 3; pulse++) tone({ freq: freq + rand(-40, 40), at: chirp + pulse * 0.038, dur: 0.022, vol, attack: 0.003, release: 0.01 });
    }
  }

  function thunder(at: number, vol = 1, len = 4.5) {
    noise({ at, dur: 0.35, vol: vol * 0.7, decay: true, filter: { type: "highpass", freq: 900 } });
    noise({ at: at + 0.05, dur: len, vol, attack: 0.08, decay: true, color: "brown", filter: { type: "lowpass", freq: [900, 140] }, am: [3.5, 0.5] });
    noise({ at: at + 0.7, dur: len * 0.7, vol: vol * 0.7, attack: 0.3, decay: true, color: "brown", filter: { type: "lowpass", freq: 300 }, am: [2.2, 0.6] });
  }

  return { ctx, seconds, random, rand, tone, noise, chord, pluck, voice, bell, organ, brass, kick, snare, hat, crash, tom, clap, crickets, thunder };
}

const C4 = 60;

/** Major and minor triads from a root, as frequencies. */
const major = (root: number) => [hz(root), hz(root + 4), hz(root + 7)];
const minor = (root: number) => [hz(root), hz(root + 3), hz(root + 7)];

function effect(category: string, id: string, title: string, seconds: number, make: (kit: Kit) => void): FactoryEffect {
  return { id, title, category, seconds, make };
}

export const FACTORY_EFFECTS: FactoryEffect[] = [
  /* ------------------------------------------------------------ Graciosos */
  effect("graciosos", "boing", "Boing", 1.1, ({ tone }) => {
    tone({ freq: [90, 260], dur: 1.05, vol: 0.9, decay: true, vibrato: [13, 45], attack: 0.003 });
    tone({ freq: [45, 130], dur: 0.9, vol: 0.5, type: "triangle", decay: true, vibrato: [13, 22] });
  }),
  effect("graciosos", "resorte", "Resorte", 0.9, ({ tone }) => {
    tone({ freq: [260, 900], dur: 0.85, vol: 0.7, type: "square", decay: true, vibrato: [24, 140], filter: { type: "lowpass", freq: 2600 } });
  }),
  effect("graciosos", "silbato-sube", "Silbato que sube", 1.3, ({ tone }) => {
    tone({ freq: [480, 1900], dur: 1.25, vol: 0.7, attack: 0.06, release: 0.12, vibrato: [6, 14] });
  }),
  effect("graciosos", "caida", "Caída con golpe", 1.9, ({ tone, kick }) => {
    tone({ freq: [1900, 260], dur: 1.45, vol: 0.65, attack: 0.04, release: 0.08, vibrato: [5, 12] });
    kick(1.5, 1);
  }),
  effect("graciosos", "trombon-triste", "Trombón triste", 3.0, ({ brass }) => {
    [hz(58), hz(57), hz(56)].forEach((freq, index) => brass(freq, index * 0.5, 0.45, 0.6, 0.15));
    brass(hz(55), 1.5, 1.45, 0.6, 0.2);
  }),
  effect("graciosos", "bocina", "Bocina de payaso", 1.0, ({ tone }) => {
    [0, 0.38].forEach((at) => {
      tone({ freq: [400, 365], at, dur: 0.28, vol: 0.6, type: "sawtooth", attack: 0.01, filter: { type: "lowpass", freq: 1900, q: 3 } });
      tone({ freq: [404, 368], at, dur: 0.28, vol: 0.4, type: "square", attack: 0.01, filter: { type: "lowpass", freq: 1400 } });
    });
  }),
  effect("graciosos", "pop", "Pop", 0.3, ({ tone, noise }) => {
    tone({ freq: [950, 180], dur: 0.09, vol: 0.9, decay: true });
    noise({ dur: 0.02, vol: 0.4, decay: true, filter: { type: "highpass", freq: 2000 } });
  }),
  effect("graciosos", "burbujas", "Burbujas", 1.6, ({ tone, rand }) => {
    for (let i = 0; i < 11; i++) tone({ freq: [rand(250, 450), rand(900, 1500)], at: rand(0, 1.4), dur: rand(0.04, 0.07), vol: rand(0.4, 0.8), decay: true });
  }),
  effect("graciosos", "chillido", "Chillido de juguete", 0.8, ({ tone }) => {
    [0, 0.38].forEach((at) => tone({ freq: [1300, 2300, 1500], at, dur: 0.26, vol: 0.6, attack: 0.01, vibrato: [30, 60], linear: true }));
  }),
  effect("graciosos", "cucu", "Cucú", 1.8, ({ tone }) => {
    [0, 0.85].forEach((at) => {
      tone({ freq: hz(76), at, dur: 0.32, vol: 0.6, type: "triangle", attack: 0.02, release: 0.12, wet: 0.2 });
      tone({ freq: hz(72), at: at + 0.4, dur: 0.38, vol: 0.6, type: "triangle", attack: 0.02, release: 0.16, wet: 0.2 });
    });
  }),
  effect("graciosos", "ba-dum-tss", "Ba-dum-tss", 1.8, ({ tom, kick, crash }) => {
    tom(0, 170);
    tom(0.17, 125);
    kick(0.17, 0.8);
    crash(0.4, 0.6, 1.35, 0.1);
  }),
  effect("graciosos", "risa", "Risa de caricatura", 2.1, ({ voice, noise }) => {
    for (let i = 0; i < 9; i++) {
      const at = i * 0.19;
      const pitch = 330 - i * 13;
      noise({ at, dur: 0.05, vol: 0.25, decay: true, filter: { type: "bandpass", freq: 1500, q: 1 } });
      voice({ freq: [pitch * 1.06, pitch], at: at + 0.03, dur: 0.12, vol: 0.8, vowel: "a", attack: 0.01, release: 0.06 });
    }
  }),
  effect("graciosos", "grillos", "Silencio incómodo (grillos)", 4.5, ({ crickets, noise }) => {
    crickets(0, 4.5, 4600, 0.3);
    crickets(0.25, 4.2, 4200, 0.2);
    noise({ dur: 4.5, vol: 0.05, color: "pink", attack: 1, release: 1, filter: { type: "lowpass", freq: 600 } });
  }),
  effect("graciosos", "patinazo", "Patinazo", 1.0, ({ noise, tone }) => {
    noise({ dur: 0.9, vol: 0.7, decay: true, filter: { type: "bandpass", freq: [3200, 1100], q: 7 } });
    tone({ freq: [780, 480], dur: 0.8, vol: 0.3, type: "sawtooth", decay: true, filter: { type: "bandpass", freq: 1500, q: 4 } });
  }),
  effect("graciosos", "kazoo", "Kazoo de victoria", 1.6, ({ voice }) => {
    [hz(72), hz(72), hz(79)].forEach((freq, index) => voice({ freq, at: index * 0.2, dur: index === 2 ? 1 : 0.16, vol: 0.7, vowel: "e", vibrato: [6, 6], attack: 0.02, release: 0.08 }));
  }),

  /* ------------------------------------------------------------- Suspenso */
  effect("suspenso", "tension", "Tensión creciente", 6.5, ({ tone, noise }) => {
    tone({ freq: 55, dur: 6.4, vol: 0.5, type: "sawtooth", attack: 5.5, release: 0.3, filter: { type: "lowpass", freq: [180, 1600] } });
    tone({ freq: 82.4, dur: 6.4, vol: 0.4, type: "sawtooth", attack: 5.5, release: 0.3, filter: { type: "lowpass", freq: [180, 1400] } });
    tone({ freq: 1760, dur: 6.4, vol: 0.2, attack: 5.8, release: 0.2, vibrato: [7, 18], wet: 0.5 });
    noise({ dur: 6.4, vol: 0.25, attack: 6.2, release: 0.1, filter: { type: "highpass", freq: [400, 6000] } });
  }),
  effect("suspenso", "latido", "Latido de corazón", 4.2, ({ tone }) => {
    for (let at = 0; at < 3.8; at += 0.95) {
      tone({ freq: [75, 42], at, dur: 0.18, vol: 1, decay: true, filter: { type: "lowpass", freq: 300 } });
      tone({ freq: [65, 38], at: at + 0.23, dur: 0.16, vol: 0.7, decay: true, filter: { type: "lowpass", freq: 300 } });
    }
  }),
  effect("suspenso", "dun-dun", "Dun dun duuun", 3.6, ({ brass, kick }) => {
    brass(hz(57), 0, 0.28, 0.7, 0.3);
    brass(hz(45), 0, 0.28, 0.5, 0.3);
    kick(0, 0.8);
    brass(hz(57), 0.42, 0.28, 0.7, 0.3);
    brass(hz(45), 0.42, 0.28, 0.5, 0.3);
    kick(0.42, 0.8);
    brass(hz(56), 0.9, 2.6, 0.7, 0.4);
    brass(hz(44), 0.9, 2.6, 0.5, 0.4);
    kick(0.9, 1);
  }),
  effect("suspenso", "terror", "Golpe de terror", 3.2, ({ chord, tone, kick }) => {
    chord([220, 233, 247, 262], { dur: 3, vol: 0.9, type: "sawtooth", decay: true, filter: { type: "lowpass", freq: [4000, 900] }, wet: 0.5 });
    tone({ freq: 1865, dur: 2.5, vol: 0.25, decay: true, vibrato: [11, 40], wet: 0.6 });
    kick(0, 1);
  }),
  effect("suspenso", "reloj", "Reloj tic-tac", 4.0, ({ tone, noise }) => {
    for (let i = 0; i < 8; i++) {
      const at = i * 0.5;
      noise({ at, dur: 0.018, vol: 0.6, decay: true, filter: { type: "bandpass", freq: i % 2 ? 2100 : 3000, q: 9 } });
      tone({ freq: i % 2 ? 1500 : 2000, at, dur: 0.025, vol: 0.3, decay: true });
    }
  }),
  effect("suspenso", "viento-tenebroso", "Viento tenebroso", 6.0, ({ noise, tone }) => {
    noise({ dur: 6, vol: 0.8, color: "pink", attack: 1.4, release: 1.6, filter: { type: "bandpass", freq: [380, 900, 480, 1150, 560], q: 5 } });
    tone({ freq: 55, dur: 6, vol: 0.3, attack: 1.5, release: 1.5 });
    tone({ freq: [700, 920, 640, 860], dur: 6, vol: 0.06, attack: 2, release: 1.5, vibrato: [4, 10], wet: 0.6 });
  }),
  effect("suspenso", "trueno", "Trueno", 5.5, ({ thunder }) => thunder(0, 1, 5.2)),
  effect("suspenso", "subida", "Subida de tensión", 4.0, ({ tone, noise }) => {
    tone({ freq: [110, 880], dur: 3.95, vol: 0.5, type: "sawtooth", attack: 3.9, release: 0.02, filter: { type: "lowpass", freq: [300, 5000] } });
    noise({ dur: 3.95, vol: 0.35, attack: 3.9, release: 0.02, filter: { type: "highpass", freq: [500, 8000] } });
  }),
  effect("suspenso", "revelacion", "Revelación", 4.5, ({ tone, noise }) => {
    tone({ freq: [95, 34], dur: 2.8, vol: 1, decay: true });
    noise({ dur: 0.6, vol: 0.5, decay: true, filter: { type: "lowpass", freq: 450 } });
    [1318.5, 1760, 2637].forEach((freq) => tone({ freq, at: 0.05, dur: 4.3, vol: 0.18, attack: 0.3, decay: true, wet: 0.8 }));
  }),
  effect("suspenso", "misterio", "Misterio (órgano)", 5.0, ({ organ }) => organ(minor(50).concat(hz(62)), 0, 4.9, 0.7, 0.6)),
  effect("suspenso", "cuerdas-suspenso", "Cuerdas de suspenso", 5.0, ({ tone }) => {
    [hz(64), hz(65), hz(52)].forEach((freq) => tone({ freq, dur: 4.9, vol: 0.35, type: "sawtooth", attack: 1, release: 0.8, am: [11, 0.7], filter: { type: "lowpass", freq: 2600 }, wet: 0.4 }));
  }),
  effect("suspenso", "puerta-rechina", "Puerta que rechina", 2.6, ({ tone, kick }) => {
    tone({ freq: [290, 520, 340, 610, 380], dur: 2, vol: 0.55, type: "sawtooth", attack: 0.1, release: 0.1, vibrato: [32, 25], filter: { type: "bandpass", freq: 1500, q: 5 } });
    kick(2.1, 0.7);
  }),

  /* ---------------------------------------------------------- Transiciones */
  effect("transiciones", "whoosh", "Whoosh", 1.2, ({ noise }) => {
    noise({ dur: 1.15, vol: 0.9, color: "pink", attack: 0.5, release: 0.6, filter: { type: "bandpass", freq: [300, 3200, 420], q: 1.5 } });
  }),
  effect("transiciones", "swoosh", "Swoosh corto", 0.55, ({ noise }) => {
    noise({ dur: 0.5, vol: 0.9, attack: 0.15, release: 0.3, filter: { type: "bandpass", freq: [800, 5200], q: 2 } });
  }),
  effect("transiciones", "barrido-sube", "Barrido ascendente", 3.0, ({ noise, tone }) => {
    noise({ dur: 2.95, vol: 0.6, attack: 2.9, release: 0.03, filter: { type: "highpass", freq: [200, 8000] } });
    tone({ freq: [100, 820], dur: 2.95, vol: 0.35, type: "sawtooth", attack: 2.9, release: 0.03, filter: { type: "lowpass", freq: [400, 4000] } });
  }),
  effect("transiciones", "barrido-baja", "Barrido descendente", 2.6, ({ noise, tone }) => {
    noise({ dur: 2.5, vol: 0.6, decay: true, filter: { type: "highpass", freq: [8000, 200] } });
    tone({ freq: [820, 70], dur: 2.5, vol: 0.4, type: "sawtooth", decay: true, filter: { type: "lowpass", freq: [4000, 300] } });
  }),
  effect("transiciones", "reversa", "Platillo en reversa", 2.2, ({ noise }) => {
    noise({ dur: 2.1, vol: 0.8, attack: 2.05, release: 0.03, filter: { type: "highpass", freq: 4500 } });
    noise({ dur: 2.1, vol: 0.4, attack: 2.05, release: 0.03, filter: { type: "bandpass", freq: 9000, q: 0.8 } });
  }),
  effect("transiciones", "glitch", "Glitch", 0.9, ({ tone, noise, rand }) => {
    for (let i = 0; i < 14; i++) {
      const at = rand(0, 0.8);
      if (i % 3) tone({ freq: rand(200, 3200), at, dur: rand(0.015, 0.05), vol: 0.5, type: "square", attack: 0.001, release: 0.004 });
      else noise({ at, dur: rand(0.01, 0.04), vol: 0.6, attack: 0.001, release: 0.004, filter: { type: "bandpass", freq: rand(800, 6000), q: 3 } });
    }
  }),
  effect("transiciones", "cinta", "Cinta que se detiene", 1.6, ({ tone }) => {
    major(C4).forEach((freq) => tone({ freq: [freq, freq * 0.06], dur: 1.5, vol: 0.35, type: "sawtooth", attack: 0.01, release: 0.25, filter: { type: "lowpass", freq: [4000, 200] } }));
  }),
  effect("transiciones", "rebobinar", "Rebobinar", 1.5, ({ tone, noise }) => {
    for (let i = 0; i < 12; i++) tone({ freq: [380, 1700], at: i * 0.11, dur: 0.1, vol: 0.3, type: "square", attack: 0.004, release: 0.02, filter: { type: "lowpass", freq: 3000 } });
    noise({ dur: 1.4, vol: 0.2, attack: 0.05, release: 0.1, filter: { type: "bandpass", freq: 2200, q: 2 }, am: [9, 0.8] });
  }),
  effect("transiciones", "pagina", "Pasar página", 0.7, ({ noise }) => {
    noise({ dur: 0.38, vol: 0.7, attack: 0.06, release: 0.22, filter: { type: "bandpass", freq: [1800, 5200], q: 1 } });
    noise({ at: 0.3, dur: 0.14, vol: 0.5, decay: true, filter: { type: "highpass", freq: 3000 } });
  }),
  effect("transiciones", "impacto-cola", "Impacto con cola", 3.8, ({ tone, noise }) => {
    tone({ freq: [120, 38], dur: 1.8, vol: 1, decay: true });
    noise({ dur: 3.4, vol: 0.6, decay: true, filter: { type: "lowpass", freq: [2500, 400] }, wet: 0.7 });
  }),
  effect("transiciones", "zip", "Cierre rápido (zip)", 0.5, ({ noise }) => {
    noise({ dur: 0.38, vol: 0.8, attack: 0.02, release: 0.05, filter: { type: "bandpass", freq: [1500, 6500], q: 3 }, am: [70, 0.9] });
  }),

  /* -------------------------------------------------------------- Impactos */
  effect("impactos", "boom", "Boom grave", 2.6, ({ tone, noise }) => {
    tone({ freq: [105, 30], dur: 2.5, vol: 1, decay: true });
    noise({ dur: 0.5, vol: 0.6, decay: true, filter: { type: "lowpass", freq: 320 } });
  }),
  effect("impactos", "golpe-cine", "Golpe cinematográfico", 3.2, ({ tone, noise }) => {
    tone({ freq: [110, 32], dur: 2.6, vol: 1, decay: true });
    noise({ dur: 1.1, vol: 0.6, decay: true, filter: { type: "bandpass", freq: 1000, q: 0.8 }, wet: 0.5 });
    [180, 271, 407].forEach((freq) => tone({ freq, dur: 0.9, vol: 0.25, type: "square", decay: true, filter: { type: "lowpass", freq: 2000 }, wet: 0.6 }));
  }),
  effect("impactos", "puerta", "Puerta que se cierra", 1.6, ({ tone, noise }) => {
    tone({ freq: [95, 48], dur: 0.55, vol: 1, decay: true, wet: 0.35 });
    noise({ dur: 0.3, vol: 0.6, decay: true, filter: { type: "lowpass", freq: 900 }, wet: 0.35 });
  }),
  effect("impactos", "explosion", "Explosión lejana", 4.2, ({ noise, tone }) => {
    noise({ dur: 0.25, vol: 0.5, decay: true, filter: { type: "highpass", freq: 1500 } });
    noise({ dur: 4, vol: 1, attack: 0.02, decay: true, color: "brown", filter: { type: "lowpass", freq: [1300, 90] } });
    tone({ freq: [62, 24], dur: 3, vol: 0.8, decay: true });
  }),
  effect("impactos", "mesa", "Golpe en la mesa", 0.8, ({ noise, tone }) => {
    noise({ dur: 0.16, vol: 0.8, decay: true, filter: { type: "lowpass", freq: 1300 } });
    tone({ freq: [170, 80], dur: 0.26, vol: 0.8, decay: true });
  }),
  effect("impactos", "platillo", "Platillo", 3.0, ({ crash }) => crash(0, 0.9, 2.9, 0.15)),
  effect("impactos", "gong", "Gong", 6.5, ({ tone, noise }) => {
    [[1, 1, 1], [1.48, 0.6, 0.8], [2.06, 0.5, 0.7], [2.53, 0.4, 0.6], [3.1, 0.3, 0.45], [3.95, 0.2, 0.35]].forEach(([ratio, level, share]) =>
      tone({ freq: 98 * ratio, dur: 6.3 * share, vol: 0.6 * level, attack: 0.06, decay: true, vibrato: [0.8, ratio], wet: 0.5 }),
    );
    noise({ dur: 0.15, vol: 0.3, decay: true, filter: { type: "lowpass", freq: 900 } });
  }),
  effect("impactos", "latigazo", "Latigazo", 0.6, ({ noise, tone }) => {
    noise({ dur: 0.09, vol: 1, decay: true, filter: { type: "highpass", freq: 2200 } });
    tone({ freq: [3200, 700], dur: 0.06, vol: 0.4, decay: true });
  }),

  /* --------------------------------------------------------------- Alertas */
  effect("alertas", "ding", "Ding", 2.2, ({ tone }) => {
    tone({ freq: 1318.5, dur: 2.1, vol: 0.7, decay: true, fm: [3.5, 1.5], wet: 0.3 });
    tone({ freq: 2637, dur: 1, vol: 0.2, decay: true, wet: 0.3 });
  }),
  effect("alertas", "ding-dong", "Timbre ding-dong", 2.6, ({ tone }) => {
    tone({ freq: hz(76), dur: 1.6, vol: 0.7, decay: true, fm: [2, 0.6], wet: 0.25 });
    tone({ freq: hz(72), at: 0.6, dur: 1.9, vol: 0.7, decay: true, fm: [2, 0.6], wet: 0.25 });
  }),
  effect("alertas", "aviso", "Campanilla de aviso", 2.6, ({ tone }) => {
    [hz(72), hz(76), hz(79)].forEach((freq, index) => {
      tone({ freq, at: index * 0.22, dur: 1.9, vol: 0.5, decay: true, wet: 0.4 });
      tone({ freq: freq * 2, at: index * 0.22, dur: 0.9, vol: 0.15, type: "triangle", decay: true, wet: 0.4 });
    });
  }),
  effect("alertas", "notificacion", "Notificación", 0.8, ({ tone }) => {
    tone({ freq: 880, dur: 0.18, vol: 0.6, decay: true });
    tone({ freq: 1318.5, at: 0.12, dur: 0.5, vol: 0.6, decay: true, wet: 0.2 });
  }),
  effect("alertas", "alarma", "Alarma", 3.0, ({ tone }) => {
    for (let i = 0; i < 12; i++) tone({ freq: i % 2 ? 620 : 840, at: i * 0.25, dur: 0.24, vol: 0.5, type: "square", attack: 0.005, release: 0.02, filter: { type: "lowpass", freq: 3200 } });
  }),
  effect("alertas", "telefono", "Teléfono que suena", 4.0, ({ tone }) => {
    [0, 2].forEach((at) =>
      [440, 480].forEach((freq) => tone({ freq, at, dur: 1.2, vol: 0.45, attack: 0.01, release: 0.03, am: [20, 1], filter: { type: "lowpass", freq: 3000 } })),
    );
  }),
  effect("alertas", "sirena", "Sirena", 4.0, ({ tone }) => {
    tone({ freq: [620, 1250, 620, 1250, 620], dur: 3.95, vol: 0.5, type: "sawtooth", attack: 0.2, release: 0.3, linear: true, filter: { type: "lowpass", freq: 3200 } });
  }),
  effect("alertas", "error", "Error", 0.7, ({ tone }) => {
    tone({ freq: 220, dur: 0.22, vol: 0.5, type: "square", attack: 0.005, release: 0.03, filter: { type: "lowpass", freq: 1500 } });
    tone({ freq: 175, at: 0.28, dur: 0.32, vol: 0.5, type: "square", attack: 0.005, release: 0.06, filter: { type: "lowpass", freq: 1500 } });
  }),
  effect("alertas", "correcto", "Respuesta correcta", 1.1, ({ tone }) => {
    [hz(72), hz(76), hz(79), hz(84)].forEach((freq, index) => tone({ freq, at: index * 0.08, dur: index === 3 ? 0.9 : 0.2, vol: 0.5, type: "triangle", decay: true, wet: 0.25 }));
  }),
  effect("alertas", "incorrecto", "Respuesta incorrecta", 1.0, ({ tone }) => {
    tone({ freq: 110, dur: 0.85, vol: 0.5, type: "sawtooth", attack: 0.01, release: 0.1, filter: { type: "lowpass", freq: 1500 } });
    tone({ freq: 116.5, dur: 0.85, vol: 0.5, type: "sawtooth", attack: 0.01, release: 0.1, filter: { type: "lowpass", freq: 1500 } });
  }),
  effect("alertas", "cuenta-regresiva", "Cuenta regresiva 3-2-1", 4.0, ({ tone }) => {
    [0, 1, 2].forEach((at) => tone({ freq: 880, at, dur: 0.16, vol: 0.6, attack: 0.004, release: 0.03 }));
    tone({ freq: 1760, at: 3, dur: 0.9, vol: 0.6, attack: 0.004, release: 0.1 });
  }),
  effect("alertas", "hora-exacta", "Pitidos de la hora exacta", 6.0, ({ tone }) => {
    [0, 1, 2, 3, 4].forEach((at) => tone({ freq: 1000, at, dur: 0.1, vol: 0.6, attack: 0.003, release: 0.01 }));
    tone({ freq: 1000, at: 5, dur: 0.5, vol: 0.6, attack: 0.003, release: 0.02 });
  }),

  /* ----------------------------------------------------------- Celebración */
  effect("celebracion", "fanfarria", "Fanfarria", 3.2, ({ brass, crash, kick }) => {
    [hz(67), hz(72), hz(76)].forEach((freq, index) => brass(freq, index * 0.2, 0.18, 0.6));
    brass(hz(79), 0.6, 2.4, 0.6, 0.35);
    major(C4).forEach((freq) => brass(freq, 0.6, 2.4, 0.35, 0.35));
    kick(0.6, 0.8);
    crash(0.6, 0.5, 2.4);
  }),
  effect("celebracion", "tada", "¡Ta-dá!", 2.2, ({ brass, crash }) => {
    major(C4 + 10).forEach((freq) => brass(freq, 0, 0.12, 0.45));
    [...major(C4), hz(72)].forEach((freq) => brass(freq, 0.16, 1.9, 0.45, 0.35));
    crash(0.16, 0.5, 1.9);
  }),
  effect("celebracion", "redoble", "Redoble con platillo", 3.8, ({ snare, crash, kick }) => {
    for (let at = 0; at < 2.5; at += 0.045) snare(at, 0.15 + (at / 2.5) * 0.55);
    kick(2.6, 1);
    crash(2.6, 0.8, 1.15);
  }),
  effect("celebracion", "aplausos", "Aplausos", 5.0, ({ clap, rand }) => {
    for (let i = 0; i < 260; i++) {
      const at = Math.pow(rand(0, 1), 0.9) * 4.6;
      const fade = at < 0.5 ? at / 0.5 : at > 3.4 ? Math.max(0.05, (4.6 - at) / 1.2) : 1;
      clap(at, rand(0.25, 0.7) * fade);
    }
  }),
  effect("celebracion", "ovacion", "Ovación", 6.0, ({ clap, noise, tone, rand }) => {
    for (let i = 0; i < 320; i++) {
      const at = rand(0, 5.6);
      clap(at, rand(0.2, 0.6) * (at < 0.6 ? at / 0.6 : at > 4.4 ? Math.max(0.05, (5.6 - at) / 1.2) : 1));
    }
    noise({ dur: 5.8, vol: 0.35, color: "pink", attack: 0.6, release: 1.4, filter: { type: "bandpass", freq: [600, 1200, 900], q: 0.7 }, am: [1.3, 0.4] });
    [0.8, 2.1, 3.3].forEach((at) => tone({ freq: [1900, 2900, 2500], at, dur: 0.6, vol: 0.12, attack: 0.05, release: 0.2, wet: 0.3 }));
  }),
  effect("celebracion", "corneta", "Corneta de fiesta", 1.3, ({ tone }) => {
    tone({ freq: [470, 560, 540], dur: 1.2, vol: 0.6, type: "sawtooth", attack: 0.05, release: 0.15, vibrato: [7, 9], filter: { type: "bandpass", freq: 1600, q: 2 } });
  }),
  effect("celebracion", "destellos", "Destellos (confeti)", 2.2, ({ tone, rand }) => {
    for (let i = 0; i < 32; i++) tone({ freq: rand(2000, 6000), at: rand(0, 1.8), dur: rand(0.15, 0.4), vol: rand(0.15, 0.35), decay: true, wet: 0.5 });
  }),
  effect("celebracion", "campanas-fiesta", "Campanas de fiesta", 3.6, ({ tone }) => {
    [79, 81, 83, 86, 88, 86, 83, 91].forEach((note, index) => tone({ freq: hz(note), at: index * 0.16, dur: 1.4, vol: 0.45, decay: true, fm: [3.5, 0.9], wet: 0.4 }));
  }),
  effect("celebracion", "ganador", "Ganador (8 bits)", 2.2, ({ tone }) => {
    [72, 76, 79, 84, 88, 91].forEach((note, index) => tone({ freq: hz(note), at: index * 0.07, dur: 0.07, vol: 0.4, type: "square", attack: 0.002, release: 0.01 }));
    [84, 88, 91].forEach((note) => tone({ freq: hz(note), at: 0.5, dur: 0.9, vol: 0.25, type: "square", attack: 0.004, release: 0.15, vibrato: [7, 6] }));
  }),
  effect("celebracion", "arpa-victoria", "Arpa de victoria", 2.8, ({ pluck }) => {
    [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84].forEach((note, index) => pluck(hz(note), index * 0.05, { dur: 2.6, vol: 0.4, damp: 0.998, bright: 0.4, wet: 0.4 }));
  }),

  /* ----------------------------------------------------------------- Calma */
  effect("calma", "campana-grande", "Campana grande", 7.0, ({ bell }) => bell(196, 0, { vol: 0.8, len: 6.8, wet: 0.4 })),
  effect("calma", "repique", "Repique de campanas", 6.5, ({ bell }) => {
    [392, 330, 262, 392, 330, 262, 196].forEach((base, index) => bell(base, index * 0.55, { vol: 0.55, len: 3.2, wet: 0.35 }));
  }),
  effect("calma", "coro", "Coro (Aah)", 6.0, ({ voice }) => {
    [...major(C4 - 12), hz(C4), hz(C4 + 4)].forEach((freq) =>
      [-0.004, 0, 0.004].forEach((detune) => voice({ freq: freq * (1 + detune), dur: 5.9, vol: 0.25, vowel: "a", attack: 1.6, release: 1.8, vibrato: [5, freq * 0.006], wet: 0.7 })),
    );
  }),
  effect("calma", "arpa", "Arpa (glissando)", 3.2, ({ pluck }) => {
    [55, 57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84].forEach((note, index) => pluck(hz(note), index * 0.06, { dur: 3, vol: 0.4, damp: 0.998, bright: 0.35, wet: 0.5 }));
  }),
  effect("calma", "brillo", "Brillo mágico", 4.5, ({ tone, rand }) => {
    [84, 88, 91, 96].forEach((note) => tone({ freq: hz(note), dur: 4.4, vol: 0.12, attack: 1.4, release: 2, wet: 0.9, vibrato: [4, 3] }));
    for (let i = 0; i < 18; i++) tone({ freq: hz([84, 88, 91, 96, 100][i % 5]), at: rand(0, 3.5), dur: 0.8, vol: 0.12, decay: true, wet: 0.9 });
  }),
  effect("calma", "organo", "Acorde de órgano", 5.0, ({ organ }) => organ([hz(48), hz(55), ...major(C4)], 0, 4.9)),
  effect("calma", "cadencia-organo", "Cadencia de órgano", 5.4, ({ organ }) => {
    organ([hz(53), hz(57), hz(60), hz(65)], 0, 2.2);
    organ([hz(48), hz(55), hz(60), hz(64)], 2.1, 3.2);
  }),
  effect("calma", "fondo-ambiental", "Fondo ambiental", 12, ({ tone }) => {
    [48, 55, 60, 62, 64].forEach((note) =>
      [-0.003, 0.003].forEach((detune) => tone({ freq: hz(note) * (1 + detune), dur: 11.9, vol: 0.14, type: "sawtooth", attack: 3, release: 3, filter: { type: "lowpass", freq: 900 }, am: [0.2, 0.2], wet: 0.7 })),
    );
  }),
  effect("calma", "campanita", "Campanita de mano", 2.6, ({ bell }) => bell(1568, 0, { vol: 0.6, len: 2.5, wet: 0.3, partials: [[1, 1, 1], [2.76, 0.4, 0.5], [5.4, 0.2, 0.3], [8.93, 0.1, 0.2]] })),
  effect("calma", "cuenco", "Cuenco tibetano", 8.0, ({ tone }) => {
    tone({ freq: 220, dur: 7.9, vol: 0.5, attack: 0.02, decay: true, wet: 0.4 });
    tone({ freq: 221.6, dur: 7.9, vol: 0.4, attack: 0.02, decay: true, wet: 0.4 });
    tone({ freq: 220 * 2.71, dur: 5, vol: 0.2, attack: 0.02, decay: true, wet: 0.4 });
    tone({ freq: 220 * 5.12, dur: 3, vol: 0.08, attack: 0.02, decay: true, wet: 0.4 });
  }),

  /* ----------------------------------------------------------------- Radio */
  effect("radio", "estatica", "Estática", 3.0, ({ noise, rand }) => {
    noise({ dur: 2.95, vol: 0.5, attack: 0.05, release: 0.2, filter: { type: "bandpass", freq: 3000, q: 0.5 }, am: [7, 0.5] });
    for (let i = 0; i < 40; i++) noise({ at: rand(0, 2.8), dur: rand(0.004, 0.02), vol: rand(0.3, 0.8), decay: true });
  }),
  effect("radio", "sintonizar", "Sintonizar la radio", 3.0, ({ noise, tone }) => {
    noise({ dur: 2.9, vol: 0.4, attack: 0.05, release: 0.3, filter: { type: "bandpass", freq: [1500, 3500, 2000], q: 0.6 } });
    tone({ freq: [200, 3000, 900, 1500, 1200], dur: 2.9, vol: 0.18, attack: 0.1, release: 0.3, vibrato: [6, 30] });
    tone({ freq: [3200, 400, 2400, 1000], dur: 2.9, vol: 0.12, type: "square", attack: 0.1, release: 0.3, filter: { type: "lowpass", freq: 2500 } });
  }),
  effect("radio", "noticias", "Cortina de noticias", 3.8, ({ tone, kick, crash }) => {
    [74, 69, 77, 69, 74, 69, 79, 69, 74, 69, 81, 69].forEach((note, index) =>
      tone({ freq: hz(note), at: index * 0.13, dur: 0.12, vol: 0.4, type: "sawtooth", decay: true, filter: { type: "lowpass", freq: 3000 } }),
    );
    [0, 0.52, 1.04].forEach((at) => tone({ freq: hz(38), at, dur: 0.45, vol: 0.6, type: "triangle", decay: true }));
    kick(1.56, 1);
    minor(62).forEach((freq) => tone({ freq, at: 1.56, dur: 2.1, vol: 0.3, type: "sawtooth", decay: true, filter: { type: "lowpass", freq: 2600 }, wet: 0.4 }));
    crash(1.56, 0.5, 2);
  }),
  effect("radio", "jingle", "Jingle de la radio", 3.2, ({ tone, chord }) => {
    [[72, 0], [76, 0.14], [79, 0.28], [81, 0.5], [79, 0.72]].forEach(([note, at]) =>
      tone({ freq: hz(note), at, dur: at === 0.72 ? 2.2 : 0.5, vol: 0.5, decay: true, fm: [4, 0.8], wet: 0.4 }),
    );
    chord([...major(C4), hz(C4 + 9)], { at: 0.72, dur: 2.4, vol: 0.4, type: "triangle", attack: 0.2, release: 1, wet: 0.5 });
  }),
  effect("radio", "separador", "Separador", 1.6, ({ noise, tone }) => {
    noise({ dur: 0.5, vol: 0.7, color: "pink", attack: 0.25, release: 0.25, filter: { type: "bandpass", freq: [400, 3000], q: 1.5 } });
    tone({ freq: 1568, at: 0.45, dur: 1.1, vol: 0.5, decay: true, fm: [3, 1], wet: 0.3 });
  }),
  effect("radio", "al-aire", "Al aire (bip)", 0.5, ({ tone }) => tone({ freq: 1000, dur: 0.32, vol: 0.6, attack: 0.004, release: 0.02 })),
  effect("radio", "teletipo", "Teletipo", 3.2, ({ noise, tone, rand }) => {
    for (let at = 0; at < 2.6; at += rand(0.03, 0.07)) noise({ at, dur: 0.008, vol: rand(0.4, 0.8), decay: true, filter: { type: "bandpass", freq: rand(2000, 3200), q: 4 } });
    tone({ freq: 2093, at: 2.7, dur: 0.5, vol: 0.4, decay: true, fm: [3, 1] });
  }),
  effect("radio", "interferencia", "Interferencia", 2.0, ({ tone, noise }) => {
    tone({ freq: 120, dur: 1.95, vol: 0.4, type: "square", attack: 0.02, release: 0.1, am: [17, 0.9], filter: { type: "lowpass", freq: 1800 } });
    noise({ dur: 1.95, vol: 0.4, attack: 0.02, release: 0.1, am: [6, 1], filter: { type: "bandpass", freq: 2500, q: 0.7 } });
  }),
  effect("radio", "cierre-bloque", "Cierre de bloque", 2.8, ({ chord, tone }) => {
    chord(major(C4 + 7), { dur: 0.25, vol: 0.5, type: "sawtooth", decay: true, filter: { type: "lowpass", freq: 3000 } });
    chord(major(C4), { at: 0.3, dur: 2.4, vol: 0.5, type: "sawtooth", decay: true, filter: { type: "lowpass", freq: [3000, 700] }, wet: 0.5 });
    tone({ freq: [80, 40], at: 0.3, dur: 1.2, vol: 0.8, decay: true });
  }),
  effect("radio", "tono-prueba", "Tono de prueba (1 kHz)", 2.0, ({ tone }) => tone({ freq: 1000, dur: 1.95, vol: 0.5, attack: 0.01, release: 0.05 })),

  /* ------------------------------------------------------------ Tecnología */
  effect("tecnologia", "laser", "Láser", 0.5, ({ tone }) => {
    tone({ freq: [2200, 180], dur: 0.35, vol: 0.5, type: "square", decay: true, filter: { type: "lowpass", freq: 4000 } });
    tone({ freq: [1800, 150], at: 0.08, dur: 0.3, vol: 0.2, type: "sawtooth", decay: true });
  }),
  effect("tecnologia", "moneda", "Moneda", 0.7, ({ tone }) => {
    tone({ freq: hz(83), dur: 0.08, vol: 0.4, type: "square", attack: 0.002, release: 0.01 });
    tone({ freq: hz(88), at: 0.08, dur: 0.55, vol: 0.4, type: "square", decay: true });
  }),
  effect("tecnologia", "salto", "Salto (8 bits)", 0.4, ({ tone }) => tone({ freq: [280, 900], dur: 0.28, vol: 0.4, type: "square", attack: 0.004, release: 0.05, linear: true })),
  effect("tecnologia", "power-up", "Power-up", 1.0, ({ tone }) => {
    for (let i = 0; i < 14; i++) tone({ freq: hz(60 + i * 2), at: i * 0.045, dur: 0.05, vol: 0.35, type: "square", attack: 0.002, release: 0.008 });
    tone({ freq: hz(88), at: 0.63, dur: 0.3, vol: 0.35, type: "square", attack: 0.004, release: 0.1, vibrato: [12, 20] });
  }),
  effect("tecnologia", "game-over", "Game over", 2.8, ({ tone }) => {
    [[67, 0, 0.28], [63, 0.32, 0.28], [60, 0.64, 0.28]].forEach(([note, at, dur]) => tone({ freq: hz(note), at, dur, vol: 0.4, type: "square", attack: 0.004, release: 0.04 }));
    tone({ freq: [hz(55), hz(53)], at: 0.96, dur: 1.6, vol: 0.4, type: "square", attack: 0.004, release: 0.3, vibrato: [6, 5] });
    tone({ freq: hz(43), at: 0.96, dur: 1.6, vol: 0.35, type: "triangle", attack: 0.004, release: 0.3 });
  }),
  effect("tecnologia", "teletransporte", "Teletransporte", 1.6, ({ tone, noise }) => {
    tone({ freq: [200, 2200], dur: 1.5, vol: 0.4, attack: 0.05, release: 0.3, vibrato: [32, 220] });
    noise({ dur: 1.5, vol: 0.25, attack: 0.1, release: 0.3, filter: { type: "highpass", freq: [600, 7000] } });
  }),
  effect("tecnologia", "robot", "Robot", 1.6, ({ tone, rand }) => {
    for (let i = 0; i < 12; i++) tone({ freq: [400, 600, 800, 1000, 1200][Math.floor(rand(0, 5))], at: i * 0.12, dur: 0.09, vol: 0.4, type: "square", attack: 0.003, release: 0.02, am: [55, 0.8] });
  }),
  effect("tecnologia", "encendido", "Encendido", 1.6, ({ tone, noise }) => {
    noise({ dur: 0.02, vol: 0.6, decay: true, filter: { type: "bandpass", freq: 3000, q: 2 } });
    tone({ freq: [55, 420], dur: 1.5, vol: 0.4, type: "sawtooth", attack: 1.2, release: 0.25, filter: { type: "lowpass", freq: [200, 3200] } });
  }),
  effect("tecnologia", "apagado", "Apagado", 1.6, ({ tone }) => {
    tone({ freq: [420, 38], dur: 1.5, vol: 0.45, type: "sawtooth", decay: true, filter: { type: "lowpass", freq: [3200, 100] } });
  }),
  effect("tecnologia", "escaner", "Escáner", 2.0, ({ tone }) => {
    [0, 0.5, 1, 1.5].forEach((at) => tone({ freq: [800, 1700], at, dur: 0.42, vol: 0.35, attack: 0.02, release: 0.08 }));
  }),
  effect("tecnologia", "clic", "Clic", 0.2, ({ noise, tone }) => {
    noise({ dur: 0.012, vol: 0.8, decay: true, filter: { type: "bandpass", freq: 4000, q: 2 } });
    tone({ freq: 2500, dur: 0.012, vol: 0.4, decay: true });
  }),
  effect("tecnologia", "teclado", "Teclado", 2.6, ({ noise, rand }) => {
    for (let at = 0; at < 2.4; at += rand(0.06, 0.16)) noise({ at, dur: 0.015, vol: rand(0.4, 0.8), decay: true, filter: { type: "bandpass", freq: rand(2500, 4500), q: 3 } });
  }),

  /* ------------------------------------------------------------ Naturaleza */
  effect("naturaleza", "lluvia", "Lluvia", 12, ({ noise, tone, rand }) => {
    noise({ dur: 11.9, vol: 0.5, attack: 1, release: 1.2, filter: { type: "bandpass", freq: 2500, q: 0.4 } });
    noise({ dur: 11.9, vol: 0.25, color: "pink", attack: 1, release: 1.2, filter: { type: "lowpass", freq: 900 } });
    for (let i = 0; i < 160; i++) tone({ freq: [rand(2500, 4500), rand(1200, 2000)], at: rand(0.5, 11), dur: 0.015, vol: rand(0.05, 0.2), decay: true });
  }),
  effect("naturaleza", "viento", "Viento", 10, ({ noise }) => {
    noise({ dur: 9.9, vol: 0.9, color: "pink", attack: 2, release: 2, filter: { type: "bandpass", freq: [350, 800, 450, 950, 500, 700], q: 1.6 }, am: [0.25, 0.4] });
  }),
  effect("naturaleza", "olas", "Olas del mar", 12, ({ noise }) => {
    [0, 3.8, 7.6].forEach((at) =>
      noise({ at, dur: 4.4, vol: 0.9, color: "pink", attack: 1.8, release: 2.4, filter: { type: "lowpass", freq: [300, 1800, 450] } }),
    );
    noise({ dur: 11.9, vol: 0.15, color: "brown", attack: 1, release: 1, filter: { type: "lowpass", freq: 400 } });
  }),
  effect("naturaleza", "pajaros", "Pajaritos", 8, ({ tone, rand }) => {
    for (let group = 0; group < 9; group++) {
      const start = rand(0, 7.2);
      const base = rand(2800, 4200);
      const notes = Math.floor(rand(2, 6));
      for (let i = 0; i < notes; i++) tone({ freq: [base, base * rand(1.2, 1.5), base * rand(0.9, 1.1)], at: start + i * rand(0.09, 0.14), dur: rand(0.05, 0.1), vol: rand(0.2, 0.4), attack: 0.005, release: 0.02, wet: 0.3 });
    }
  }),
  effect("naturaleza", "fogata", "Fogata", 10, ({ noise, rand }) => {
    noise({ dur: 9.9, vol: 0.35, color: "brown", attack: 1, release: 1, filter: { type: "lowpass", freq: 500 } });
    for (let i = 0; i < 140; i++) noise({ at: rand(0.3, 9.6), dur: rand(0.004, 0.02), vol: rand(0.15, 0.7), decay: true, filter: { type: "highpass", freq: rand(1500, 4000) } });
  }),
  effect("naturaleza", "arroyo", "Arroyo", 10, ({ noise, tone, rand }) => {
    [[1200, 3.1], [2200, 5.3], [3400, 7.7]].forEach(([freq, rate]) =>
      noise({ dur: 9.9, vol: 0.35, attack: 1, release: 1, filter: { type: "bandpass", freq, q: 1.2 }, am: [rate, 0.6] }),
    );
    for (let i = 0; i < 40; i++) tone({ freq: [rand(500, 900), rand(1200, 2200)], at: rand(0.5, 9.4), dur: rand(0.03, 0.06), vol: rand(0.05, 0.15), decay: true });
  }),
  effect("naturaleza", "noche", "Noche con grillos", 10, ({ crickets, noise }) => {
    crickets(0, 10, 4600, 0.25);
    crickets(0.3, 9.6, 4250, 0.18);
    crickets(0.15, 9.8, 5000, 0.1);
    noise({ dur: 9.9, vol: 0.08, color: "pink", attack: 2, release: 2, filter: { type: "lowpass", freq: 500 } });
  }),
  effect("naturaleza", "tormenta", "Tormenta lejana", 10, ({ noise, thunder }) => {
    noise({ dur: 9.9, vol: 0.4, attack: 1.5, release: 1.5, filter: { type: "bandpass", freq: 2200, q: 0.4 } });
    thunder(2.5, 0.6, 5);
    thunder(7, 0.4, 2.8);
  }),

  /* ------------------------------------------------------------- Musicales */
  effect("musicales", "guitarra", "Acorde de guitarra", 3.2, ({ pluck }) => {
    [43, 47, 50, 55, 59, 67].forEach((note, index) => pluck(hz(note), index * 0.025, { dur: 3.1, vol: 0.45, damp: 0.997, bright: 0.5, wet: 0.2 }));
  }),
  effect("musicales", "piano-arpegio", "Arpegio de piano", 3.4, ({ tone }) => {
    [60, 64, 67, 72, 76].forEach((note, index) => {
      tone({ freq: hz(note), at: index * 0.12, dur: 3 - index * 0.2, vol: 0.5, decay: true, fm: [1, 0.4], wet: 0.3 });
      tone({ freq: hz(note) * 2, at: index * 0.12, dur: 1.2, vol: 0.12, type: "triangle", decay: true });
    });
  }),
  effect("musicales", "acorde-brillante", "Acorde brillante", 2.6, ({ chord }) => {
    [-0.004, 0.004].forEach((detune) => chord([...major(C4), hz(72)].map((freq) => freq * (1 + detune)), { dur: 2.5, vol: 0.5, type: "sawtooth", decay: true, filter: { type: "lowpass", freq: [6000, 1200] }, wet: 0.4 }));
  }),
  effect("musicales", "acorde-menor", "Acorde dramático (menor)", 3.2, ({ chord }) => {
    chord([hz(45), ...minor(57), hz(69)], { dur: 3.1, vol: 0.6, type: "sawtooth", attack: 0.1, release: 1.4, filter: { type: "lowpass", freq: 2200 }, wet: 0.5 });
  }),
  effect("musicales", "bajo", "Bajo deslizante", 1.6, ({ tone }) => tone({ freq: [41.2, 82.4], dur: 1.5, vol: 0.8, type: "sawtooth", attack: 0.01, release: 0.3, filter: { type: "lowpass", freq: 700, q: 3 } })),
  effect("musicales", "remate-bateria", "Remate de batería", 2.4, ({ tom, kick, snare, crash }) => {
    snare(0, 0.6);
    snare(0.12, 0.7);
    tom(0.24, 200);
    tom(0.36, 150);
    tom(0.48, 110);
    kick(0.62, 1);
    crash(0.62, 0.7, 1.7);
  }),
  effect("musicales", "xilofono", "Xilófono que sube", 2.0, ({ tone }) => {
    [72, 74, 76, 77, 79, 81, 83, 84].forEach((note, index) => {
      tone({ freq: hz(note), at: index * 0.09, dur: 0.6, vol: 0.5, decay: true });
      tone({ freq: hz(note) * 4, at: index * 0.09, dur: 0.12, vol: 0.15, decay: true });
    });
  }),
  effect("musicales", "cristal", "Copa de cristal", 3.2, ({ tone }) => {
    tone({ freq: 1760, dur: 3.1, vol: 0.5, attack: 0.003, decay: true, wet: 0.5 });
    tone({ freq: 1760 * 2.7, dur: 1.5, vol: 0.15, attack: 0.003, decay: true, wet: 0.5 });
  }),
  effect("musicales", "kalimba", "Kalimba", 3.0, ({ pluck }) => {
    [72, 76, 79, 76, 81, 79, 84].forEach((note, index) => pluck(hz(note), index * 0.18, { dur: 1.6, vol: 0.5, damp: 0.994, bright: 0.25, wet: 0.3 }));
  }),
];

/** What the «Botonera básica» loads in one click. */
export const STARTER_EFFECTS = [
  "aplausos",
  "redoble",
  "tada",
  "risa",
  "boing",
  "trombon-triste",
  "ba-dum-tss",
  "dun-dun",
  "whoosh",
  "aviso",
  "ding",
  "campana-grande",
  "coro",
  "jingle",
  "noticias",
  "separador",
];

/** Renders an effect: mono, 44.1 kHz, leveled to the same loudness with peaks under -1 dBFS. */
export async function renderEffect(item: FactoryEffect): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, Math.ceil(item.seconds * SR), SR);
  item.make(createKit(ctx, item.seconds, item.id));
  const buffer = await ctx.startRendering();
  const data = buffer.getChannelData(0);
  let peak = 0;
  let sum = 0;
  for (const value of data) {
    peak = Math.max(peak, Math.abs(value));
    sum += value * value;
  }
  if (peak > 0) {
    const gain = Math.min(0.89 / peak, 0.2 / Math.max(Math.sqrt(sum / data.length), 1e-6));
    const fade = Math.min(data.length, Math.round(SR * 0.02));
    for (let i = 0; i < data.length; i++) data[i] *= gain * (i >= data.length - fade ? (data.length - i) / fade : 1);
  }
  return buffer;
}

/** 16-bit PCM WAV of a mono buffer. */
export function wavFile(buffer: AudioBuffer, name: string): File {
  const data = buffer.getChannelData(0);
  const bytes = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + data.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 0x7fff, true);
  return new File([bytes], name, { type: "audio/wav" });
}

/**
 * Content version of an effect: a 32-bit FNV-1a hash (8 hex characters) of its recipe. The server
 * keeps one file per effect and version for the whole platform, so a changed recipe is stored anew.
 */
export function effectVersion(item: FactoryEffect): string {
  let hash = 0x811c9dc5;
  for (const char of `${SR}|${item.id}|${item.seconds}|${item.make.toString()}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

const rendered = new Map<string, Promise<AudioBuffer>>();

export function effectBuffer(item: FactoryEffect) {
  let buffer = rendered.get(item.id);
  if (!buffer) {
    buffer = renderEffect(item);
    buffer.catch(() => rendered.delete(item.id));
    rendered.set(item.id, buffer);
  }
  return buffer;
}

let previewContext: AudioContext | null = null;
let previewSource: AudioBufferSourceNode | null = null;
let previewTurn = 0;

/** Plays an effect on this computer only; onEnd runs when it ends, fails or another preview starts. */
export async function previewEffect(item: FactoryEffect, onEnd: () => void) {
  stopPreview();
  const turn = previewTurn;
  let buffer: AudioBuffer;
  try {
    previewContext ??= new AudioContext();
    await previewContext.resume();
    buffer = await effectBuffer(item);
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
  source.connect(previewContext.destination);
  source.onended = () => {
    if (previewSource === source) previewSource = null;
    onEnd();
  };
  previewSource = source;
  source.start();
}

export function stopPreview() {
  previewTurn++;
  previewSource?.stop();
  previewSource = null;
}
