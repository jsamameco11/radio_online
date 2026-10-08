import { router } from "@inertiajs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { http, HttpError } from "@/lib/http";
import { FACTORY_EFFECTS, STARTER_EFFECTS, type FactoryEffect } from "@/lib/radio/effects";
import type { BroadcastTrack } from "@/types/studio";
import { isFactoryTrack, storeEffect } from "./use-sounds";

export const inBank = (pads: BroadcastTrack[], item: FactoryEffect) => pads.some((pad) => isFactoryTrack(pad, item));

export const starterEffects = () => STARTER_EFFECTS.map((id) => FACTORY_EFFECTS.find((item) => item.id === id)).filter((item): item is FactoryEffect => item !== undefined);

type PadResult = { pads?: BroadcastTrack[]; error?: string };

export type PadLoading = { current: FactoryEffect | null; queued: string[]; done: number; total: number; stopping: boolean };

export type PadReport = { tone: "info" | "error"; text: string };

export type PadsApi = ReturnType<typeof usePads>;

const failure = (error: unknown, fallback: string) => (error instanceof HttpError ? error.firstError() : fallback);

interface PadsOptions {
  base: string;
  initial: BroadcastTrack[];
  max: number;
  /** A brand-new bank: the basic factory effects load into it in the background, once. */
  starter: boolean;
  /** Every factory effect stored on the way joins the console's sounds. */
  onStored: (track: BroadcastTrack) => void;
}

/**
 * The pad bank of the console. Every change runs one after the other on the latest bank, so the
 * factory effects load in the background (with the effects window closed) while the operator keeps
 * dropping sounds or working on the rest of the console.
 */
export function usePads({ base, initial, max, starter, onStored }: PadsOptions) {
  const [pads, setBank] = useState(initial);
  const [loading, setLoading] = useState<PadLoading | null>(null);
  const [report, setReport] = useState<PadReport | null>(null);
  const bank = useRef(initial);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const waiting = useRef<FactoryEffect[]>([]);
  const current = useRef<FactoryEffect | null>(null);
  const progress = useRef({ done: 0, total: 0, overflow: false, stopping: false });
  const running = useRef(false);
  const mounted = useRef(true);
  const offered = useRef(false);
  const busy = loading !== null;

  const setPads = useCallback((next: BroadcastTrack[]) => {
    bank.current = next;
    setBank(next);
  }, []);

  /** Runs a change of the bank once the previous ones finished, with the bank as it is by then. */
  const exclusive = useCallback(
    <T extends PadResult>(job: (now: BroadcastTrack[]) => Promise<T>): Promise<T> => {
      const run = chain.current.then(() => job(bank.current)).then((result) => {
        if (result.pads) setPads(result.pads);
        return result;
      });
      chain.current = run.catch(() => undefined);
      return run;
    },
    [setPads],
  );

  /** Saves the bank as given (order included). */
  const save = useCallback(
    (ids: string[]) =>
      exclusive(async (): Promise<PadResult> => {
        try {
          return { pads: (await http.put<{ pads: BroadcastTrack[] }>(`${base}/botonera`, { tracks: ids })).pads };
        } catch (error) {
          return { error: failure(error, "No pudimos guardar la botonera.") };
        }
      }),
    [base, exclusive],
  );

  /** One more library audio at the end of the bank. */
  const add = useCallback(
    (track: BroadcastTrack) =>
      exclusive(async (now): Promise<PadResult> => {
        if (now.some((pad) => pad.id === track.id)) return { error: `«${track.title}» ya está en la botonera.` };
        if (now.length >= max) return { error: `La botonera tiene hasta ${max} botones. Quita uno con «Editar» para sumar otro.` };
        try {
          return { pads: (await http.put<{ pads: BroadcastTrack[] }>(`${base}/botonera`, { tracks: [...now.map((pad) => pad.id), track.id] })).pads };
        } catch (error) {
          return { error: failure(error, "No pudimos guardar la botonera.") };
        }
      }),
    [base, exclusive, max],
  );

  function sync() {
    const { done, total, stopping } = progress.current;
    setLoading(current.current || waiting.current.length ? { current: current.current, queued: waiting.current.map((item) => item.id), done, total, stopping } : null);
  }

  async function addEffect(item: FactoryEffect): Promise<PadResult> {
    try {
      const data = await storeEffect(base, item, true);
      onStored(data.track);
      return { pads: data.pads ?? undefined };
    } catch (error) {
      return { error: failure(error, `No se pudo agregar «${item.title}». Revisa tu conexión e inténtalo de nuevo.`) };
    }
  }

  async function drain() {
    running.current = true;
    let added = 0;
    let last = "";
    let error = "";
    while (waiting.current.length && !progress.current.stopping) {
      const item = waiting.current.shift();
      if (!item) break;
      current.current = item;
      sync();
      const result = await exclusive((now) =>
        inBank(now, item)
          ? Promise.resolve<PadResult>({})
          : now.length >= max
            ? Promise.resolve<PadResult>({ error: `La botonera llegó a ${max} botones.` })
            : addEffect(item).then((value) => {
                if (!value.error) {
                  added += 1;
                  last = item.title;
                }
                return value;
              }),
      );
      if (result.error) {
        error = result.error;
        break;
      }
      progress.current.done += 1;
    }

    const left = waiting.current.length;
    const { total, overflow, stopping } = progress.current;
    waiting.current = [];
    current.current = null;
    progress.current = { done: 0, total: 0, overflow: false, stopping: false };
    running.current = false;
    sync();
    if (!mounted.current) return;
    if (added) router.reload({ only: ["library"] });

    const count = added === 1 ? "1 efecto" : `${added} efectos`;
    if (error) {
      setReport({ tone: "error", text: `${error}${added ? ` Se agregaron ${count} antes.` : ""}${left ? ` Quedaron ${left} sin agregar: vuelve a intentarlo.` : ""}` });
    } else if (stopping) {
      setReport({ tone: "info", text: `Carga detenida: se agregaron ${count} de ${total}.` });
    } else if (overflow) {
      setReport({ tone: "info", text: `Se cargaron los que entraban: la botonera llegó a ${max} botones.` });
    } else if (added === 1 && total === 1) {
      setReport({ tone: "info", text: `«${last}» ya está en la botonera.` });
    } else if (added) {
      setReport({ tone: "info", text: `Listo: ${count} nuevos en la botonera. Tócalos con las teclas 1–0.` });
    }
  }

  /** Queues factory effects to add in the background; false when none could be queued (the reason goes to the report). */
  function load(items: FactoryEffect[]): boolean {
    const pending = new Set([...waiting.current.map((item) => item.id), ...(current.current ? [current.current.id] : [])]);
    const fresh = items.filter((item) => !inBank(bank.current, item) && !pending.has(item.id));
    if (!fresh.length) {
      if (!pending.size) setReport({ tone: "info", text: items.length > 1 ? "Esos efectos ya están en la botonera." : `«${items[0]?.title}» ya está en la botonera.` });
      return false;
    }
    const room = max - bank.current.length - pending.size;
    if (room <= 0) {
      setReport({ tone: "error", text: `La botonera ya tiene ${max} botones${pending.size ? " con los que se están cargando" : ""}. Quita algunos con «Editar» para sumar otros.` });
      return false;
    }
    const batch = fresh.slice(0, room);
    waiting.current.push(...batch);
    progress.current.total += batch.length;
    progress.current.overflow ||= batch.length < fresh.length;
    progress.current.stopping = false;
    setReport(null);
    sync();
    if (!running.current) void drain();
    return true;
  }

  /** Lets the effect being added finish and drops the ones still waiting. */
  function stop() {
    progress.current.stopping = true;
    sync();
  }

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    mounted.current = true;
    if (starter && !offered.current) {
      offered.current = true;
      loadRef.current(starterEffects());
    }
    return () => {
      mounted.current = false;
    };
  }, [starter]);

  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  useEffect(() => {
    if (report?.tone !== "info") return;
    const timer = window.setTimeout(() => setReport((value) => (value === report ? null : value)), 8000);
    return () => window.clearTimeout(timer);
  }, [report]);

  return { pads, max, save, add, loading, report, dismiss: () => setReport(null), load, stop };
}
