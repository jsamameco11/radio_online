import { http, HttpError } from "@/lib/http";
import type { ListenerState, NowPlaying, StationListener } from "@/types/radio";
import type { BroadcastState, ProgramItem } from "@/types/studio";
import { newListenerId, ServerClock } from "./clock";
import { currentItem } from "./format";
import { ProgramPlayer, unlock } from "./program-player";
import { VoiceLink } from "./voice";

/** Presence in the audience: the server forgets a listener after about a minute without it. */
const HEARTBEAT_MS = 20000;

const POLL_MS = 2500;

/** While the live microphone connects, the handshake moves faster. */
const NEGOTIATING_MS = 1000;

const NOW_KINDS: NowPlaying["kind"][] = ["song", "jingle", "effect", "commercial", "program", "live"];

function csrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";
}

function failure(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 401) return "Inicia sesión para escuchar esta radio.";
    if (error.status === 409 || error.status === 403) return "Verifica tu correo para escuchar esta radio.";
    if (error.status === 404) return "Esta radio no está disponible ahora.";
    if (error.status === 429) return "Demasiados intentos. Espera un momento y vuelve a sintonizar.";
  }
  return "No pudimos sintonizar esta radio. Revisa tu conexión.";
}

/**
 * A station as one listener hears it: it polls the program the server computes, follows the
 * server clock, mixes the music, the layers and the live voice in the browser, keeps its
 * presence in the audience and reports the audios it could not play.
 */
class StationListenerEngine implements StationListener {
  readonly frequencySlug: string;

  private readonly base: string;
  private readonly id = newListenerId();
  private readonly clock = new ServerClock();
  private readonly subscribers = new Set<(state: ListenerState) => void>();
  private state: ListenerState = {
    status: "idle",
    live: false,
    liveTitle: null,
    nowPlaying: null,
    next: null,
    recent: [],
    listeners: 0,
    volume: 0.8,
    muted: false,
    error: null,
  };
  private radio: BroadcastState | null = null;
  private player: ProgramPlayer | null = null;
  private voice: VoiceLink | null = null;
  private stream: HTMLAudioElement | null = null;
  private feed: HTMLAudioElement | null = null;
  private feedUrl: string | null = null;
  private rev = 0;
  private running = false;
  private pollTimer = 0;
  private heartbeatTimer = 0;
  private tickTimer = 0;
  private readonly onHide = () => this.beacon("salir");

  constructor(frequencySlug: string) {
    this.frequencySlug = frequencySlug;
    this.base = `/radio/${encodeURIComponent(frequencySlug)}`;
  }

  /** Must be called from a click or tap: the audio is unlocked before the first answer arrives. */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.update({ status: "connecting", error: null });

    const player = new ProgramPlayer(this.clock, "interactive");
    player.onBlocked = () => this.update({ status: "paused", error: "Toca reproducir para escuchar." });
    player.onItem = () => this.refresh();
    player.onFailure = (item) => item.track && void http.post(`${this.base}/fallo`, { oyente: this.id, track: item.track }).catch(() => undefined);
    const voice = new VoiceLink(this.base, this.id);
    voice.onMix = (mix, rev) => {
      if (rev < this.rev) return;
      this.rev = rev;
      player.setMix(mix);
    };
    voice.onLayer = (layer) => player.pushLayer(layer);
    voice.onStop = (ids) => player.dropLayers(ids);
    voice.onVoice = (on) => player.setVoice(on);
    voice.route = (incoming) => player.attachVoice(incoming);
    this.player = player;
    this.voice = voice;
    this.stream = new Audio();
    this.feed = new Audio();
    const unlocking = Promise.all([player.start(), voice.unlock(), unlock(this.stream), unlock(this.feed)]);

    try {
      const first = await this.poll();
      await unlocking;
      if (!this.running) return;
      this.applyVolume();
      if (first.stream) {
        player.stop();
        this.stream.src = first.stream;
        await this.stream.play().catch(() => this.update({ status: "paused", error: "Toca reproducir para escuchar." }));
      }
      this.apply(first);
    } catch (error) {
      this.teardown();
      throw new Error(failure(error), { cause: error });
    }

    window.addEventListener("pagehide", this.onHide);
    void this.heartbeat();
    this.heartbeatTimer = window.setInterval(() => void this.heartbeat(), HEARTBEAT_MS);
    this.tickTimer = window.setInterval(() => this.refresh(), 1000);
    this.schedule();
  }

  stop(): void {
    if (!this.running) return;
    this.beacon("salir");
    this.teardown();
    this.update({ status: "idle", error: null });
  }

  setVolume(volume: number): void {
    this.state = { ...this.state, volume: Math.min(1, Math.max(0, volume)) };
    this.applyVolume();
    this.notify();
  }

  setMuted(muted: boolean): void {
    this.state = { ...this.state, muted };
    this.applyVolume();
    this.notify();
  }

  getState(): ListenerState {
    return this.state;
  }

  subscribe(listener: (state: ListenerState) => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  private teardown(): void {
    this.running = false;
    window.clearTimeout(this.pollTimer);
    window.clearInterval(this.heartbeatTimer);
    window.clearInterval(this.tickTimer);
    window.removeEventListener("pagehide", this.onHide);
    this.player?.close();
    this.voice?.close();
    this.stream?.pause();
    this.feed?.pause();
    this.player = null;
    this.voice = null;
    this.stream = null;
    this.feed = null;
    this.feedUrl = null;
  }

  private async poll(): Promise<BroadcastState> {
    const sent = Date.now();
    const next = await http.get<BroadcastState>(`${this.base}/estado?oyente=${this.id}`, { cache: "no-store" });
    this.clock.sample(next.now, sent, Date.now());
    return next;
  }

  private schedule(): void {
    if (!this.running) return;
    const negotiating = this.radio?.voice && ["waiting", "offering", "offered"].includes(this.radio.voice.state);
    this.pollTimer = window.setTimeout(async () => {
      try {
        this.apply(await this.poll());
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) {
          this.teardown();
          this.update({ status: "offline", error: failure(error) });
          return;
        }
      }
      this.schedule();
    }, negotiating ? NEGOTIATING_MS : POLL_MS);
  }

  private apply(next: BroadcastState): void {
    this.radio = next;
    const player = this.player;
    if (player && !next.stream) {
      player.setReserve(next.fallback);
      player.setQueue(next.queue);
      if (next.live.rev >= this.rev) {
        this.rev = next.live.rev;
        player.setMix(next.mix);
      }
      player.setLayers(next.layers);
      this.follow(next.live.url);
      void this.voice?.update(next);
    }
    this.refresh();
  }

  /** The external live signal (OBS, Icecast) sounds while the station cuts the music for it. */
  private follow(url: string | null): void {
    if (url === this.feedUrl || !this.feed) return;
    this.feedUrl = url;
    if (!url) {
      this.feed.pause();
      this.feed.removeAttribute("src");
      this.feed.load();
      return;
    }
    this.feed.src = url;
    void this.feed.play().catch(() => undefined);
  }

  private refresh(): void {
    const radio = this.radio;
    if (!radio || !this.running) return;
    const now = this.clock.now();
    const current = currentItem(radio.queue, now);
    const upcoming = radio.queue.find((item) => item.start > now && item.id !== current?.id);
    const playing = this.state.status === "paused" ? "paused" : "playing";
    const next: ListenerState = {
      ...this.state,
      status: radio.on_air ? playing : "offline",
      live: radio.live.on,
      liveTitle: radio.live.on ? radio.live.title || null : null,
      nowPlaying: radio.live.on ? this.livePlaying(radio, now) : current ? this.present(radio, current) : null,
      next: upcoming ? this.present(radio, upcoming) : radio.next_show ? this.show(radio.next_show) : null,
      recent: radio.recent.map((item) => this.present(radio, item)),
      listeners: radio.listeners,
    };
    if (JSON.stringify(next) === JSON.stringify(this.state)) return;
    this.state = next;
    this.notify();
  }

  private livePlaying(radio: BroadcastState, now: number): NowPlaying {
    return {
      kind: "live",
      title: radio.live.title || "En vivo",
      artist: radio.live.host,
      cover_url: null,
      started_at: new Date(radio.live.started_at ?? now).toISOString(),
      duration: null,
    };
  }

  /** Songs keep their names to themselves when the station hides titles. */
  private present(radio: BroadcastState, item: ProgramItem): NowPlaying {
    const kind = NOW_KINDS.includes(item.kind as NowPlaying["kind"]) ? (item.kind as NowPlaying["kind"]) : "program";
    const hidden = !radio.show_titles && kind === "song";
    return {
      kind,
      title: hidden ? radio.station.name : item.title,
      artist: hidden ? null : item.artist,
      cover_url: hidden ? null : (item.cover ?? null),
      started_at: new Date(item.origin).toISOString(),
      duration: Math.round((item.end - item.origin) / 1000),
    };
  }

  private show(next: NonNullable<BroadcastState["next_show"]>): NowPlaying {
    const kind = NOW_KINDS.includes(next.kind as NowPlaying["kind"]) ? (next.kind as NowPlaying["kind"]) : "program";
    return { kind, title: next.title, artist: null, cover_url: null, started_at: new Date(next.start).toISOString(), duration: null };
  }

  private async heartbeat(): Promise<void> {
    try {
      const { listeners } = await http.post<{ listeners: number }>(`${this.base}/escucha`, { oyente: this.id });
      this.update({ listeners });
    } catch {
      return;
    }
  }

  /** Survives the page closing: the browser delivers it after the tab is gone. */
  private beacon(path: string): void {
    const body = new FormData();
    body.set("oyente", this.id);
    body.set("_token", csrfToken());
    if (!navigator.sendBeacon?.(`${this.base}/${path}`, body)) void http.post(`${this.base}/${path}`, { oyente: this.id }).catch(() => undefined);
  }

  private applyVolume(): void {
    const volume = this.state.muted ? 0 : this.state.volume;
    this.player?.setVolume(volume);
    this.voice?.setVolume(volume);
    if (this.stream) this.stream.volume = volume;
    if (this.feed) this.feed.volume = volume;
  }

  private update(patch: Partial<ListenerState>): void {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  private notify(): void {
    this.subscribers.forEach((listener) => listener(this.state));
  }
}

export function createStationListener(frequencySlug: string): StationListener {
  return new StationListenerEngine(frequencySlug);
}
