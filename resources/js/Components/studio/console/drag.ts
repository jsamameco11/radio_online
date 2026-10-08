import { useState, type DragEvent } from "react";
import type { FactoryEffect } from "@/lib/radio/effects";
import type { BroadcastTrack } from "@/types/studio";
import type { Sounds } from "./use-sounds";

export const TRACK_MIME = "application/x-turadio-track";

export const EFFECT_MIME = "application/x-turadio-effect";

export function dragTrack(event: DragEvent, track: BroadcastTrack) {
  event.dataTransfer.setData(TRACK_MIME, track.id);
  event.dataTransfer.setData("text/plain", track.title);
  event.dataTransfer.effectAllowed = "copy";
}

/** A factory effect not stored yet travels by its id; where it lands, it is stored first. */
export function dragEffect(event: DragEvent, item: FactoryEffect) {
  event.dataTransfer.setData(EFFECT_MIME, item.id);
  event.dataTransfer.setData("text/plain", item.title);
  event.dataTransfer.effectAllowed = "copy";
}

function carriesSound(event: DragEvent): boolean {
  const types = Array.from(event.dataTransfer.types);
  return types.includes(TRACK_MIME) || types.includes(EFFECT_MIME);
}

/** Props for an element that accepts sounds dropped on it; `data-drop` lights it while one hovers. */
export function useSoundDrop(sounds: Sounds, onTrack: (track: BroadcastTrack) => void, enabled = true) {
  const [over, setOver] = useState(false);
  if (!enabled) return {};

  return {
    "data-drop": over || undefined,
    onDragOver(event: DragEvent) {
      if (!carriesSound(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setOver(true);
    },
    onDragLeave(event: DragEvent) {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
    },
    onDrop(event: DragEvent) {
      setOver(false);
      if (!carriesSound(event)) return;
      event.preventDefault();
      void sounds.resolve(event.dataTransfer).then((track) => track && onTrack(track));
    },
  };
}
