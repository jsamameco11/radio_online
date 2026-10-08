import { useCallback, useMemo, useRef, useState } from "react";
import { http, HttpError } from "@/lib/http";
import { EFFECT_CATEGORIES, FACTORY_EFFECTS, effectBuffer, effectVersion, wavFile, type FactoryEffect } from "@/lib/radio/effects";
import type { BroadcastTrack } from "@/types/studio";
import { EFFECT_MIME, TRACK_MIME } from "./drag";
import type { ConsoleApi } from "./use-console";

/** Artist the server files every factory effect under (App\Domain\Studio\Actions\AddFactoryEffect::ARTIST). */
const ARTIST = "Efectos de fábrica";

export const EFFECT_LABELS = new Map(EFFECT_CATEGORIES.map((category) => [category.id, category.label]));

const effectArtist = (item: FactoryEffect) => `${ARTIST} · ${EFFECT_LABELS.get(item.category) ?? item.category}`;

/** Whether a library audio is that factory effect, stored by this station. */
export const isFactoryTrack = (track: BroadcastTrack, item: FactoryEffect) => track.kind === "effect" && track.title === item.title && track.artist === effectArtist(item);

export const isAnyFactoryTrack = (track: BroadcastTrack) => track.kind === "effect" && (track.artist ?? "").startsWith(`${ARTIST} · `);

export type EffectAnswer = { message: string | null; track: BroadcastTrack; pads: BroadcastTrack[] | null };

/**
 * Keeps a factory effect in the station library (and at the end of the pad bank with `pad`). The
 * server first looks for the platform's copy; only when nobody stored that effect yet is it
 * rendered here and uploaded.
 */
export async function storeEffect(base: string, item: FactoryEffect, pad: boolean): Promise<EffectAnswer> {
  const form = (audio?: { file: File; seconds: number }) => {
    const body = new FormData();
    body.set("id", item.id);
    body.set("version", effectVersion(item));
    body.set("title", item.title);
    body.set("category", EFFECT_LABELS.get(item.category) ?? item.category);
    body.set("duration", (audio?.seconds ?? item.seconds).toFixed(2));
    if (pad) body.set("pad", "1");
    if (audio) body.set("audio", audio.file);
    return body;
  };
  try {
    return await http.post<EffectAnswer>(`${base}/efectos`, form());
  } catch (error) {
    if (!(error instanceof HttpError && error.status === 409 && error.body.code === "audio")) throw error;
  }
  const buffer = await effectBuffer(item);
  return http.post<EffectAnswer>(`${base}/efectos`, form({ file: wavFile(buffer, `${item.id}.wav`), seconds: buffer.duration }));
}

export type Sounds = ReturnType<typeof useSounds>;

/**
 * Everything the console can play: the station library plus the factory effects, which are
 * available from the first day and join the library the first time they are used.
 */
export function useSounds(api: ConsoleApi, initial: BroadcastTrack[]) {
  const { base, setNotice } = api;
  const [added, setAdded] = useState<BroadcastTrack[]>([]);
  const [storing, setStoring] = useState<string[]>([]);
  const library = useMemo(() => [...initial, ...added.filter((track) => !initial.some((item) => item.id === track.id))], [added, initial]);
  const current = useRef(library);
  current.current = library;
  const inflight = useRef(new Map<string, Promise<BroadcastTrack | null>>());

  const remember = useCallback((track: BroadcastTrack) => setAdded((list) => (list.some((item) => item.id === track.id) ? list : [...list, track])), []);

  const stored = useCallback((item: FactoryEffect) => library.find((track) => isFactoryTrack(track, item)) ?? null, [library]);

  /** The library audio of a factory effect, storing it first when this station never used it. */
  const ensure = useCallback(
    (item: FactoryEffect): Promise<BroadcastTrack | null> => {
      const have = current.current.find((track) => isFactoryTrack(track, item));
      if (have) return Promise.resolve(have);
      const running = inflight.current.get(item.id);
      if (running) return running;
      setStoring((list) => [...list, item.id]);
      const job = storeEffect(base, item, false)
        .then((data) => {
          remember(data.track);
          return data.track;
        })
        .catch((error: unknown) => {
          setNotice({ tone: "error", text: error instanceof HttpError ? error.firstError() : `No pudimos preparar «${item.title}». Revisa tu conexión e inténtalo de nuevo.` });
          return null;
        })
        .finally(() => {
          inflight.current.delete(item.id);
          setStoring((list) => list.filter((id) => id !== item.id));
        });
      inflight.current.set(item.id, job);
      return job;
    },
    [base, remember, setNotice],
  );

  /** The sound a drag carries; read at once, since the drop data is gone after the event. */
  const resolve = useCallback(
    (data: DataTransfer): Promise<BroadcastTrack | null> => {
      const id = data.getData(TRACK_MIME);
      const effect = FACTORY_EFFECTS.find((item) => item.id === data.getData(EFFECT_MIME));
      if (id) return Promise.resolve(current.current.find((track) => track.id === id) ?? null);
      return effect ? ensure(effect) : Promise.resolve(null);
    },
    [ensure],
  );

  return { library, stored, ensure, resolve, remember, storing };
}
