import type { BroadcastTrack } from "@/types/studio";
import type { SamplerSlot, TrackSource } from "./types";

/** Kinds of library audio the DJ console can play. */
export const DJ_KINDS: BroadcastTrack["kind"][] = ["song", "program", "jingle", "effect", "commercial"];

export const playableInDj = (track: BroadcastTrack): boolean => track.playable && Boolean(track.src) && DJ_KINDS.includes(track.kind);

export function trackSource(track: BroadcastTrack | null | undefined): TrackSource | null {
  return track?.src ? { id: track.id, title: track.title, artist: track.artist, src: track.src } : null;
}

export function fileSource(file: File): TrackSource {
  return { id: null, title: file.name.replace(/\.[^.]+$/, ""), artist: null, file };
}

export function samplerSlot(track: BroadcastTrack | null | undefined): SamplerSlot | null {
  return track?.src ? { id: track.id, title: track.title, src: track.src } : null;
}
