import type { ProgramItem, ProgramLayer, ProgramMix, ReserveSong } from "@/types/studio";
import type { ServerClock } from "./clock";
import { currentItem } from "./format";

let silentUrl = "";

function silence(): string {
  if (silentUrl) return silentUrl;
  const rate = 8000;
  const samples = 800;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  silentUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return silentUrl;
}

function absolute(src: string): string {
  return new URL(src, window.location.href).href;
}

/** Plays a silent clip inside a click so iOS lets the element play later on its own. */
export function unlock(element: HTMLAudioElement): Promise<void> {
  element.src = silence();
  return element.play().then(() => element.pause()).catch(() => undefined);
}

/**
 * A player of the program. Its watchdog: `errored` (the file failed to load or decode),
 * `progressAt` (last time the audio moved, to catch loads and streams that hang), `retries`
 * of the same file, and `covering` when a reserve song sounds in place of a failed one.
 */
interface Deck {
  el: HTMLAudioElement;
  gain: GainNode;
  item: ProgramItem | null;
  fadingUntil: number;
  errored: boolean;
  progressAt: number;
  lastTime: number;
  retries: number;
  covering: boolean;
  covers: number;
}

/** A layer sounding: an effect kept decoded in memory plays from its `buffer`, anything else streams through `el`. */
interface Voice {
  layer: ProgramLayer;
  el: HTMLAudioElement | null;
  source: MediaElementAudioSourceNode | null;
  buffer: AudioBuffer | null;
  node: AudioBufferSourceNode | null;
  gain: GainNode;
  started: boolean;
  done: boolean;
}

/** Layers up to this long are effects: they always play from the start, unless they arrive too late. */
const SHORT_LAYER = 20000;

const LATE_EFFECT = 6000;

const PRELOAD = 25000;

/** A file that has not started sounding after this long is failing. */
const LOAD_TIMEOUT = 15000;

/** Audio that should be playing but has not moved for this long is stuck. */
const STALL_TIMEOUT = 10000;

/** A file that ends this long before its time on the program was shorter than the library says. */
const EARLY_END = 3000;

/** Failed reserve songs tolerated for one item before giving up on it. */
const MAX_COVERS = 4;

/** Share of the program volume while the host speaks, when the server mix does not say. */
const VOICE_LEVEL = 0.25;

/** iPhone, iPad and Safari can leave a remote voice silent inside Web Audio, so there it keeps its own element. */
function mixesRemoteVoice(): boolean {
  const agent = navigator.userAgent;
  const apple = /iP(hone|ad|od)/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(agent) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(agent);
  return !apple && !safari;
}

/**
 * The program as every listener hears it: two decks that follow the server timeline
 * (crossfading songs that overlap), a music bus driven by the console faders, and the
 * layers bus where pads, players and overlay blocks sound at the same time, lowering
 * the music while a layer that asks for it plays.
 *
 * The program never goes silent because of a file: a deck that fails (load error, a load or
 * playback that hangs, a file shorter than announced) tries the same file once more, then
 * reports it and covers the rest of its time with a reserve song from the server. When the
 * server stops answering and the queue runs out, the reserve songs keep the music going.
 */
export class ProgramPlayer {
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  readonly clock: ServerClock;
  onItem?: (item: ProgramItem | null) => void;
  onBlocked?: () => void;
  onLayers?: (playing: string[]) => void;
  /** A library audio failed after its retry: the station checks it. */
  onFailure?: (item: ProgramItem) => void;

  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private duckBus: GainNode | null = null;
  private fxBus: GainNode | null = null;
  /** The pad bank, with its own fader next to the rest of the layers. */
  private padBus: GainNode | null = null;
  /** Music and layers together, dropped while the host's voice is detected. */
  private voiceBus: GainNode | null = null;
  /** Program and live voice summed before the volume, so together they never clip. */
  private limiter: DynamicsCompressorNode | null = null;
  private liveVoice: MediaStreamAudioSourceNode | null = null;
  private speaking = false;
  private decks: Deck[] = [];
  private active = -1;
  private queue: ProgramItem[] = [];
  private layers: ProgramLayer[] = [];
  private voices = new Map<string, Voice>();
  private skipped = new Set<string>();
  private ducking = false;
  private mix: ProgramMix = { music: 1, fx: 0.9, bed: 0.22, duck: 0.25, voice: VOICE_LEVEL };
  private volume = 0.9;
  private timer = 0;
  private lastItem: string | null = null;
  private lastPlaying = "";
  private reserve: ReserveSong[] = [];
  private reserveTurn = 0;
  private badSources = new Set<string>();
  private reported = new Set<string>();
  private readonly latency: AudioContextLatencyCategory;
  /** Effects decoded ahead (the pad bank), by absolute address, so they sound the instant they fire. */
  private decoded = new Map<string, AudioBuffer>();
  private decoding = new Set<string>();
  private warmed = new Set<string>();

  /** The console asks for an `interactive` output so what the operator fires is heard at once. */
  constructor(clock: ServerClock, latency: AudioContextLatencyCategory = "playback") {
    this.clock = clock;
    this.latency = latency;
  }

  get running(): boolean {
    return this.timer !== 0;
  }

  /** Must be called from a click or tap. */
  async start(): Promise<void> {
    const ctx = this.ctx ?? this.build();
    await ctx.resume();
    this.decodeWarmed();
    await Promise.all(this.decks.map((deck) => unlock(deck.el)));
    this.decks.forEach((deck) => (deck.item = null));
    this.active = -1;
    this.lastItem = null;
    this.applyGains(0);
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 400);
    this.tick();
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
    this.decks.forEach((deck) => {
      deck.el.pause();
      deck.item = null;
    });
    [...this.voices.keys()].forEach((id) => this.release(id, 0));
    this.active = -1;
    this.lastItem = null;
    void this.ctx?.suspend();
  }

  /** Releases the audio device for good. */
  close(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
    this.decks = [];
  }

  setQueue(queue: ProgramItem[]): void {
    this.queue = queue;
    if (this.running) this.tick();
  }

  /** Healthy songs from the server to cover failures; an empty list means silence is intended. */
  setReserve(songs: ReserveSong[]): void {
    this.reserve = songs;
  }

  setMix(mix: ProgramMix): void {
    this.mix = mix;
    this.applyGains(0.25);
    if (this.speaking) this.setVoice(true);
  }

  /** The host's voice: everything drops to the mix's voice level at once and comes back gently when it stops. */
  setVoice(on: boolean): void {
    this.speaking = on;
    if (!this.ctx || !this.voiceBus) return;
    this.voiceBus.gain.setTargetAtTime(on ? (this.mix.voice ?? VOICE_LEVEL) : 1, this.ctx.currentTime, on ? 0.012 : 0.25);
  }

  /** The live microphone joins the mix above the dropped program; false when it must play on its own. */
  attachVoice(stream: MediaStream | null): boolean {
    this.liveVoice?.disconnect();
    this.liveVoice = null;
    if (!stream || !this.ctx || !this.limiter || !mixesRemoteVoice()) return false;
    try {
      this.liveVoice = this.ctx.createMediaStreamSource(stream);
      this.liveVoice.connect(this.limiter);
      return true;
    } catch {
      return false;
    }
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
  }

  /** Layers from the server state: pads and players of the console and overlay blocks. */
  setLayers(layers: ProgramLayer[]): void {
    const pushed = this.layers.filter((layer) => layer.source === "live" && !layers.some((item) => item.id === layer.id) && this.clock.now() - layer.start < 8000);
    this.layers = [...layers, ...pushed];
    if (this.running) this.syncLayers(this.clock.now());
  }

  /** A layer that arrived before the next poll (fired here or through the live link). */
  pushLayer(layer: ProgramLayer): void {
    this.layers = [...this.layers.filter((item) => item.id !== layer.id), layer];
    if (this.running) this.syncLayers(this.clock.now());
  }

  /** Effects to keep downloaded and decoded (the pad bank); long audios and the ones no longer listed are left out. */
  warm(sounds: { src: string | null; duration: number }[]): void {
    this.warmed = new Set(sounds.filter((sound) => sound.src && sound.duration * 1000 <= SHORT_LAYER).map((sound) => absolute(sound.src as string)));
    [...this.decoded.keys()].forEach((key) => {
      if (!this.warmed.has(key)) this.decoded.delete(key);
    });
    this.decodeWarmed();
  }

  dropLayers(ids: string[]): void {
    this.layers = this.layers.filter((layer) => !ids.includes(layer.id));
    ids.forEach((id) => this.release(id, 0.25));
    if (this.running) this.syncLayers(this.clock.now());
  }

  currentItem(): ProgramItem | null {
    return currentItem(this.queue, this.clock.now());
  }

  private build(): AudioContext {
    const Context = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Context({ latencyHint: this.latency });
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.duckBus = ctx.createGain();
    this.fxBus = ctx.createGain();
    this.padBus = ctx.createGain();
    this.voiceBus = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.78;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.12;
    this.musicBus.connect(this.duckBus).connect(this.voiceBus);
    this.fxBus.connect(this.voiceBus);
    this.padBus.connect(this.voiceBus);
    this.voiceBus.connect(this.limiter).connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(ctx.destination);
    const musicBus = this.musicBus;
    this.decks = [0, 1].map(() => {
      const el = new Audio();
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain);
      gain.connect(musicBus);
      const deck: Deck = { el, gain, item: null, fadingUntil: 0, errored: false, progressAt: 0, lastTime: -1, retries: 0, covering: false, covers: 0 };
      el.addEventListener("error", () => {
        if (deck.item && el.error && el.error.code !== el.error.MEDIA_ERR_ABORTED) deck.errored = true;
      });
      return deck;
    });
    return ctx;
  }

  private decodeWarmed(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.warmed.forEach((key) => {
      if (this.decoded.has(key) || this.decoding.has(key)) return;
      this.decoding.add(key);
      fetch(key)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => {
          if (this.warmed.has(key)) this.decoded.set(key, buffer);
        })
        .catch(() => undefined)
        .finally(() => this.decoding.delete(key));
    });
  }

  private gainFor(item: ProgramItem | null): number {
    if (!item) return 0;
    return item.bed ? this.mix.bed : 1;
  }

  private applyGains(seconds: number): void {
    if (!this.ctx || !this.musicBus || !this.fxBus || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volume, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.mix.music, t, Math.max(0.01, seconds / 3));
    this.fxBus.gain.setTargetAtTime(this.mix.fx, t, 0.05);
    this.padBus?.gain.setTargetAtTime(this.mix.pads ?? this.mix.fx, t, 0.05);
    this.duckBus?.gain.setTargetAtTime(this.ducking ? this.mix.duck : 1, t, this.ducking ? 0.12 : 0.45);
    this.decks.forEach((deck, index) => {
      if (index === this.active) deck.gain.gain.setTargetAtTime(this.gainFor(deck.item), t, Math.max(0.01, seconds / 3));
    });
  }

  private tick(): void {
    if (!this.ctx) return;
    const now = this.clock.now();
    this.syncLayers(now);
    const item = currentItem(this.queue, now) ?? this.stranded(now);
    if ((item?.id ?? null) !== this.lastItem) {
      this.lastItem = item?.id ?? null;
      this.onItem?.(item);
    }

    const playing = this.active >= 0 ? this.decks[this.active] : null;
    if (!item || !item.src) {
      if (playing) this.fadeOut(this.active, item?.kind === "live" ? 1.5 : 0.4);
      this.active = -1;
      this.preload(now);
      return;
    }

    if (playing && playing.item?.id === item.id) {
      const el = playing.el;
      if (this.failing(playing, item, now)) {
        this.recover(playing, item, now);
      } else if (!playing.covering) {
        const expected = (now - item.origin) / 1000;
        if (el.readyState >= 2 && !el.seeking && Math.abs(el.currentTime - expected) > 1.5) el.currentTime = Math.max(0, expected);
      }
      if (el.paused && el.readyState >= 2 && !el.ended) this.play(el);
      this.preload(now);
      return;
    }

    const outgoing = playing?.item;
    const overlap = outgoing && outgoing.end > now + 400 && now - item.start < 2000 ? (outgoing.end - now) / 1000 : 0;
    const fade = Math.min(12, Math.max(0.35, overlap));
    const target = this.decks.findIndex((deck) => deck.item?.id === item.id);
    const index = target >= 0 ? target : this.active === 0 ? 1 : 0;
    if (playing) this.fadeOut(this.active, fade);
    this.active = index;
    const deck = this.decks[index];
    if (deck.item?.id !== item.id) this.load(deck, item);
    this.begin(deck, item, fade);
  }

  private load(deck: Deck, item: ProgramItem): void {
    deck.item = item;
    deck.retries = 0;
    deck.covering = false;
    deck.covers = 0;
    this.watchFrom(deck);
    deck.el.src = item.src ?? "";
    deck.el.load();
  }

  /** Only the browser blocking autoplay asks the listener to tap play; a broken file is the watchdog's job. */
  private play(el: HTMLAudioElement): void {
    void el.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "NotAllowedError") this.onBlocked?.();
    });
  }

  private watchFrom(deck: Deck): void {
    deck.errored = false;
    deck.progressAt = performance.now();
    deck.lastTime = -1;
  }

  /**
   * Whether the deck on air is failing its item: the file errored, it has not sounded or has
   * stopped moving for too long while it should play, or it ended well before its time.
   * Pauses that are not the file's fault (autoplay blocked, the audio context suspended by
   * the system) only restart the watch.
   */
  private failing(deck: Deck, item: ProgramItem, now: number): boolean {
    const el = deck.el;
    const at = performance.now();
    if (deck.covers > MAX_COVERS) return false;
    if (deck.errored) return true;
    if (el.ended) return item.end - now > EARLY_END;
    if (this.ctx?.state !== "running" || (el.paused && el.readyState >= 2)) {
      deck.progressAt = at;
      return false;
    }
    if (el.currentTime !== deck.lastTime) {
      if (deck.lastTime >= 0 || el.readyState >= 2) deck.progressAt = at;
      deck.lastTime = el.currentTime;
      return false;
    }
    return at - deck.progressAt > (el.readyState >= 2 ? STALL_TIMEOUT : LOAD_TIMEOUT);
  }

  /** The same file once more; then the station is told and a reserve song covers the rest of the item. */
  private recover(deck: Deck, item: ProgramItem, now: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const ended = deck.el.ended && !deck.errored;
    if (!deck.covering && !ended && deck.retries < 1) {
      deck.retries += 1;
      this.watchFrom(deck);
      deck.el.load();
      this.begin(deck, item, 0.6);
      return;
    }
    if (!deck.covering && !ended && item.track && !this.reported.has(item.track)) {
      this.reported.add(item.track);
      this.onFailure?.(item);
    }
    const failed = deck.covering ? deck.el.currentSrc : item.src;
    if (!ended && failed) this.badSources.add(absolute(failed));
    if (!ended) deck.covers += 1;
    const song = deck.covers <= MAX_COVERS ? this.nextReserve(item.src) : null;
    if (!song) {
      deck.covers = MAX_COVERS + 1;
      deck.errored = false;
      deck.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      return;
    }
    deck.covering = true;
    this.watchFrom(deck);
    deck.el.src = song.src;
    deck.el.load();
    const start = () => {
      if (deck.item?.id !== item.id || !deck.covering) return;
      deck.el.currentTime = 0;
      deck.gain.gain.cancelScheduledValues(ctx.currentTime);
      deck.gain.gain.setValueAtTime(0, ctx.currentTime);
      deck.gain.gain.linearRampToValueAtTime(this.gainFor(item), ctx.currentTime + Math.min(1.5, Math.max(0.3, (item.end - now) / 4000)));
      this.play(deck.el);
    };
    if (deck.el.readyState >= 1) start();
    else deck.el.addEventListener("loadedmetadata", start, { once: true });
  }

  /** The next reserve song that has not failed here, in turns, never the file being replaced. */
  private nextReserve(avoid: string | null): ReserveSong | null {
    const count = this.reserve.length;
    for (let step = 0; step < count; step += 1) {
      const song = this.reserve[(this.reserveTurn + step) % count];
      if (song.src !== avoid && !this.badSources.has(absolute(song.src))) {
        this.reserveTurn = (this.reserveTurn + step + 1) % count;
        return song;
      }
    }
    return null;
  }

  /**
   * When the queue ran out (the server stopped answering) and music is expected, the reserve
   * songs keep it going, one after another, until the server's program arrives again.
   */
  private stranded(now: number): ProgramItem | null {
    if (!this.reserve.length || this.queue.some((item) => item.end > now)) return null;
    const song = this.nextReserve(null);
    if (!song) return null;
    const item: ProgramItem = {
      id: `reserve-${song.id}-${now}`,
      kind: "song",
      title: song.title,
      artist: song.artist,
      src: song.src,
      start: now,
      end: now + song.ms,
      origin: now,
      seek: 0,
      bed: false,
      block: null,
      slot: null,
      track: song.id,
    };
    this.queue = [item];
    return item;
  }

  private begin(deck: Deck, item: ProgramItem, fade: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const start = () => {
      if (deck.item?.id !== item.id) return;
      deck.el.currentTime = Math.max(0, (this.clock.now() - item.origin) / 1000);
      deck.gain.gain.cancelScheduledValues(ctx.currentTime);
      deck.gain.gain.setValueAtTime(0, ctx.currentTime);
      deck.gain.gain.linearRampToValueAtTime(this.gainFor(item), ctx.currentTime + fade);
      this.play(deck.el);
    };
    if (deck.el.readyState >= 1) start();
    else deck.el.addEventListener("loadedmetadata", start, { once: true });
  }

  private fadeOut(index: number, seconds = 0.4): void {
    const deck = this.decks[index];
    if (!deck || !this.ctx) return;
    const t = this.ctx.currentTime;
    deck.gain.gain.cancelScheduledValues(t);
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, t);
    deck.gain.gain.linearRampToValueAtTime(0, t + seconds);
    deck.fadingUntil = performance.now() + seconds * 1000 + 100;
    const item = deck.item;
    window.setTimeout(() => {
      if (deck.item === item && index !== this.active) deck.el.pause();
    }, seconds * 1000 + 50);
  }

  /** Loads the next song in the free deck a few seconds before it starts (never over a song fading out). */
  private preload(now: number): void {
    const next = this.queue.find((item) => item.start > now && item.src);
    if (!next || next.start - now > PRELOAD) return;
    if (this.decks.some((deck) => deck.item?.id === next.id)) return;
    const free = this.decks[this.active === 0 ? 1 : 0];
    if (!free || free.fadingUntil > performance.now()) return;
    this.load(free, next);
  }

  /** Starts, follows and stops the layer voices, and lowers the music while a ducking layer sounds. */
  private syncLayers(now: number): void {
    if (!this.ctx || !this.fxBus) return;
    const wanted = new Map(this.layers.filter((layer) => layer.src && layer.end > now).map((layer) => [layer.id, layer]));

    this.voices.forEach((voice, id) => {
      const short = voice.layer.end - voice.layer.start <= SHORT_LAYER;
      const stopped = !wanted.has(id) && voice.layer.end > now + 300;
      const ended = !short && voice.layer.end <= now;
      if (voice.done || stopped || ended) this.release(id, stopped ? 0.25 : 0.6);
    });

    wanted.forEach((layer) => {
      const existing = this.voices.get(layer.id);
      if (existing) {
        existing.layer = layer;
        this.follow(existing, now);
        return;
      }
      if (this.skipped.has(layer.id) || layer.start - now > PRELOAD) return;
      const short = layer.end - layer.start <= SHORT_LAYER;
      if (short && now - layer.start > LATE_EFFECT) {
        this.skipped.add(layer.id);
        return;
      }
      const created = this.voice(layer);
      this.voices.set(layer.id, created);
      this.follow(created, now);
    });

    const playing = [...this.voices.values()].filter((voice) => voice.started && !voice.done);
    const ducking = playing.some((voice) => voice.layer.duck);
    if (ducking !== this.ducking) {
      this.ducking = ducking;
      this.applyGains(0.25);
    }
    const ids = playing.map((voice) => voice.layer.id).join(",");
    if (ids !== this.lastPlaying) {
      this.lastPlaying = ids;
      this.onLayers?.(playing.map((voice) => voice.layer.id));
    }
  }

  private voice(layer: ProgramLayer): Voice {
    const ctx = this.ctx as AudioContext;
    const gain = ctx.createGain();
    gain.gain.value = this.envelope(layer, this.clock.now());
    gain.connect((layer.lane === "pad" ? this.padBus : this.fxBus) as GainNode);
    const short = layer.end - layer.start <= SHORT_LAYER;
    const buffer = short && !layer.loop ? (this.decoded.get(absolute(layer.src)) ?? null) : null;
    if (buffer) return { layer, el: null, source: null, buffer, node: null, gain, started: false, done: false };

    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.src = layer.src;
    el.loop = Boolean(layer.loop);
    const source = ctx.createMediaElementSource(el);
    source.connect(gain);
    const voice: Voice = { layer, el, source, buffer: null, node: null, gain, started: false, done: false };
    el.onended = el.onerror = () => this.finished(voice);
    return voice;
  }

  private finished(voice: Voice): void {
    voice.done = true;
    if (this.running) this.syncLayers(this.clock.now());
  }

  /** Volume of a layer at a moment: its level shaped by the fade in after the start and the fade out before the end. */
  private envelope(layer: ProgramLayer, at: number): number {
    const fadeIn = (layer.fade_in ?? 0) * 1000;
    const fadeOut = (layer.fade_out ?? 0) * 1000;
    const into = fadeIn > 0 ? Math.min(1, Math.max(0, (at - layer.start) / fadeIn)) : 1;
    const left = fadeOut > 0 ? Math.min(1, Math.max(0, (layer.end - at) / fadeOut)) : 1;
    return (layer.volume / 100) * into * left;
  }

  /** Where the file should be: a looped layer wraps around its length. */
  private position(layer: ProgramLayer, el: HTMLAudioElement, at: number): number {
    const elapsed = Math.max(0, (at - layer.start) / 1000);
    const span = layer.loop ? (layer.length ?? 0) / 1000 || el.duration : 0;
    return span > 0 && Number.isFinite(span) ? elapsed % span : elapsed;
  }

  /** Effects start from the beginning when their time comes; long layers follow the clock like the program. */
  private follow(voice: Voice, now: number): void {
    const ctx = this.ctx as AudioContext;
    const { layer, el, gain } = voice;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(this.envelope(layer, now + 450), t + 0.45);
    if (now < layer.start - 60) return;
    const short = layer.end - layer.start <= SHORT_LAYER;
    if (!voice.started) {
      voice.started = true;
      if (voice.buffer) {
        const node = ctx.createBufferSource();
        node.buffer = voice.buffer;
        node.connect(gain);
        node.onended = () => this.finished(voice);
        node.start();
        voice.node = node;
        return;
      }
      if (!el) return;
      const begin = () => {
        if (!short) el.currentTime = this.position(layer, el, this.clock.now());
        void el.play().catch(() => this.onBlocked?.());
      };
      if (el.readyState >= 1) begin();
      else el.addEventListener("loadedmetadata", begin, { once: true });
      return;
    }
    if (short || !el || el.readyState < 2 || el.seeking) return;
    const expected = this.position(layer, el, now);
    let drift = Math.abs(el.currentTime - expected);
    if (layer.loop && Number.isFinite(el.duration)) drift = Math.min(drift, el.duration - drift);
    if (drift > 1.5) el.currentTime = expected;
  }

  private release(id: string, seconds: number): void {
    const voice = this.voices.get(id);
    if (!voice) return;
    this.voices.delete(id);
    const done = () => {
      voice.el?.pause();
      voice.el?.removeAttribute("src");
      voice.source?.disconnect();
      if (voice.node) {
        voice.node.onended = null;
        if (!voice.done) voice.node.stop();
        voice.node.disconnect();
      }
      voice.gain.disconnect();
    };
    if (!this.ctx || seconds <= 0 || voice.done) {
      done();
      return;
    }
    voice.gain.gain.setTargetAtTime(0, this.ctx.currentTime, seconds / 3);
    window.setTimeout(done, seconds * 1000 + 80);
  }
}
