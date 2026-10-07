import { usePage } from "@inertiajs/react";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import type { SharedProps, Station } from "@/types";
import type { ListenerState } from "@/types/radio";
import { playerStore } from "./player-store";

export interface PlayerApi {
  station: Station | null;
  state: ListenerState;
  /** True while connecting to or playing a station. */
  active: boolean;
  isCurrent: (station: Pick<Station, "frequency">) => boolean;
  play: (station: Station) => void;
  stop: () => void;
  /** Plays `station` (or the current one) or stops it when it is already sounding. */
  toggle: (station?: Station) => void;
  dismiss: () => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
}

const PlayerContext = createContext<PlayerApi | null>(null);

function usePlayerApi(): PlayerApi {
  const { station, state } = useSyncExternalStore(playerStore.subscribe, playerStore.getSnapshot, playerStore.getSnapshot);

  return useMemo(() => {
    const active = state.status === "connecting" || state.status === "playing";
    const isCurrent = (other: Pick<Station, "frequency">) => station?.frequency.slug === other.frequency.slug;

    return {
      station,
      state,
      active,
      isCurrent,
      play: (next) => void playerStore.play(next),
      stop: () => playerStore.stop(),
      toggle: (next) => {
        const target = next ?? station;
        if (!target) return;
        if (active && isCurrent(target)) playerStore.stop();
        else void playerStore.play(target);
      },
      dismiss: () => playerStore.dismiss(),
      setVolume: (volume) => playerStore.setVolume(volume),
      setMuted: (muted) => playerStore.setMuted(muted),
    };
  }, [station, state]);
}

/** Shares the tab-wide live player with the public site and silences it when the session ends. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const api = usePlayerApi();
  const signedIn = Boolean(usePage<SharedProps>().props.auth.user);

  useEffect(() => {
    if (!signedIn) playerStore.dismiss();
  }, [signedIn]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const { station, state } = api;
    if (!station) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.live ? (state.liveTitle ?? "En vivo") : (state.nowPlaying?.title ?? station.display_name),
      artist: state.nowPlaying?.artist ?? station.display_name,
      album: station.display_name,
      artwork: station.logo_url ? [{ src: station.logo_url, sizes: "512x512" }] : [],
    });
    navigator.mediaSession.setActionHandler("play", () => void playerStore.play(station));
    navigator.mediaSession.setActionHandler("pause", () => playerStore.stop());
    navigator.mediaSession.setActionHandler("stop", () => playerStore.stop());
  }, [api]);

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

/** The live player: what is tuned in and the controls to change it. */
export function usePlayer(): PlayerApi {
  const context = useContext(PlayerContext);
  const fallback = usePlayerApi();
  return context ?? fallback;
}
