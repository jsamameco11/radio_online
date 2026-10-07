import { useEffect, useState, type RefObject } from "react";
import { DjEngine } from "@/lib/dj/engine";
import type { DjState } from "@/lib/dj/types";
import type { Broadcaster } from "@/lib/radio/voice";

/** The DJ engine of this console, built on the broadcaster's audio context and torn down with the page. */
export function useDjEngine(caster: RefObject<Broadcaster | null>) {
  const [engine, setEngine] = useState<DjEngine | null>(null);
  const [state, setState] = useState<DjState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const broadcaster = caster.current;
    if (!broadcaster || typeof AudioWorkletNode === "undefined") {
      setFailed(true);
      return;
    }
    const instance = new DjEngine(broadcaster);
    const off = instance.subscribe(setState);
    let alive = true;
    instance
      .init()
      .then(() => alive && setEngine(instance))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      off();
      instance.dispose();
      setEngine(null);
    };
  }, [caster]);

  return { engine, state, failed };
}
