import { createStationListener } from "@/lib/radio/listener";
import type { Station } from "@/types";
import type { ListenerState, StationListener } from "@/types/radio";

/**
 * The live player lives outside React: Inertia visits remount layouts, but
 * the station keeps sounding because the engine and its state are kept here,
 * once per browser tab.
 */
export interface PlayerSnapshot {
  station: Station | null;
  state: ListenerState;
}

const VOLUME_KEY = "turadio.player.volume";
const MUTED_KEY = "turadio.player.muted";

function storedVolume(): number {
  if (typeof window === "undefined") return 0.8;
  const value = Number(window.localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : 0.8;
}

function storedMuted(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(MUTED_KEY) === "1";
}

function idleState(): ListenerState {
  return {
    status: "idle",
    live: false,
    liveTitle: null,
    nowPlaying: null,
    next: null,
    recent: [],
    listeners: 0,
    volume: storedVolume(),
    muted: storedMuted(),
    error: null,
  };
}

let snapshot: PlayerSnapshot = { station: null, state: idleState() };
let engine: StationListener | null = null;
let detach: (() => void) | null = null;
let account: number | null = null;
const subscribers = new Set<() => void>();

function emit(next: PlayerSnapshot): void {
  snapshot = next;
  subscribers.forEach((notify) => notify());
}

function release(): void {
  detach?.();
  detach = null;
  engine?.stop();
  engine = null;
}

export const playerStore = {
  subscribe(notify: () => void): () => void {
    subscribers.add(notify);
    return () => subscribers.delete(notify);
  },

  getSnapshot(): PlayerSnapshot {
    return snapshot;
  },

  async play(station: Station): Promise<void> {
    const sameStation = snapshot.station?.frequency.slug === station.frequency.slug;
    if (sameStation && engine && ["connecting", "playing"].includes(snapshot.state.status)) return;

    release();
    const { volume, muted } = snapshot.state;
    const listener = createStationListener(station.frequency.slug);
    engine = listener;
    listener.setVolume(volume);
    listener.setMuted(muted);
    emit({ station, state: { ...listener.getState(), volume, muted, status: "connecting", error: null } });
    detach = listener.subscribe((state: ListenerState) => {
      if (engine === listener) emit({ station, state: { ...state, volume: snapshot.state.volume, muted: snapshot.state.muted } });
    });

    try {
      await listener.start();
    } catch (error) {
      if (engine !== listener) return;
      release();
      emit({ station, state: { ...snapshot.state, status: "error", error: error instanceof Error ? error.message : "No pudimos sintonizar esta radio." } });
    }
  },

  stop(): void {
    release();
    emit({ station: snapshot.station, state: { ...idleState(), volume: snapshot.state.volume, muted: snapshot.state.muted } });
  },

  /** Closes the player bar completely. */
  dismiss(): void {
    release();
    emit({ station: null, state: { ...idleState(), volume: snapshot.state.volume, muted: snapshot.state.muted } });
  },

  /** Guests listen too, but signing out closes the player so the account's listening session ends with it. */
  setAccount(id: number | null): void {
    if (account !== null && account !== id) this.dismiss();
    account = id;
  },

  setVolume(volume: number): void {
    const value = Math.min(1, Math.max(0, volume));
    window.localStorage.setItem(VOLUME_KEY, String(value));
    engine?.setVolume(value);
    const muted = value === 0;
    engine?.setMuted(muted);
    window.localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    emit({ ...snapshot, state: { ...snapshot.state, volume: value, muted } });
  },

  setMuted(muted: boolean): void {
    window.localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    engine?.setMuted(muted);
    emit({ ...snapshot, state: { ...snapshot.state, muted } });
  },
};
