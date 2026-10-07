/**
 * Contract between the listener engine (resources/js/lib/radio/listener.ts,
 * owned by the studio core) and the public player UI.
 */
export type ListenerStatus = "idle" | "connecting" | "playing" | "paused" | "offline" | "error";

export interface NowPlaying {
  kind: "song" | "jingle" | "effect" | "commercial" | "program" | "live";
  title: string;
  artist: string | null;
  cover_url: string | null;
  started_at: string;
  duration: number | null;
}

export interface ListenerState {
  status: ListenerStatus;
  /** True while a host is on air through the live microphone. */
  live: boolean;
  liveTitle: string | null;
  nowPlaying: NowPlaying | null;
  next: NowPlaying | null;
  recent: NowPlaying[];
  listeners: number;
  volume: number;
  muted: boolean;
  error: string | null;
}

export interface StationListener {
  readonly frequencySlug: string;
  start(): Promise<void>;
  stop(): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  getState(): ListenerState;
  /** Returns an unsubscribe function. */
  subscribe(listener: (state: ListenerState) => void): () => void;
}
