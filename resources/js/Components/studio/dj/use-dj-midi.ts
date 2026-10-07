import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { DjEngine } from "@/lib/dj/engine";
import { dispatchMidi, type MidiContext } from "@/lib/dj/midi/dispatch";
import { DjMidi } from "@/lib/dj/midi/dj-midi";
import type { DjState } from "@/lib/dj/types";

type MidiActions = Pick<MidiContext, "browse" | "load" | "notice">;

/** Every LED in one string, so the lights are sent only when one of them changes. */
function lightsKey(state: DjState | null): string {
  if (!state) return "";
  const decks = state.decks.map((deck, index) => [deck.playing, deck.sync, deck.keylock, state.channels[index].cue, deck.track !== null && !deck.playing, ...deck.hotcues.map((cue) => cue !== null)].map(Number).join(""));
  return `${decks.join("|")}|${Number(state.fx.on)}`;
}

/** A USB DJ controller driving the engine, with the lights of its buttons following the console. */
export function useDjMidi(engine: DjEngine | null, state: DjState | null, actions: MidiActions) {
  const midi = useMemo(() => new DjMidi(), []);
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shift = useRef<[boolean, boolean]>([false, false]);
  const latest = useRef(actions);
  latest.current = actions;
  const current = useRef(state);
  current.current = state;

  useEffect(() => {
    midi.onChange = refresh;
    return () => {
      midi.onChange = undefined;
      midi.disconnect();
    };
  }, [midi]);

  useEffect(() => {
    if (!engine) return;
    midi.onEvent = (event) => dispatchMidi(engine, event, { ...latest.current, shift: shift.current, invertTempo: midi.invertTempo });
    return () => {
      midi.onEvent = undefined;
    };
  }, [engine, midi]);

  const lights = lightsKey(state);

  useEffect(() => {
    const state = current.current;
    if (!connected || !state) return;
    state.decks.forEach((deck, index) => {
      const p = `d${index + 1}`;
      midi.light(`${p}.play`, deck.playing);
      midi.light(`${p}.sync`, deck.sync);
      midi.light(`${p}.keylock`, deck.keylock);
      midi.light(`${p}.pfl`, state.channels[index].cue);
      midi.light(`${p}.cue`, deck.track !== null && !deck.playing);
      deck.hotcues.forEach((cue, k) => midi.light(`${p}.hotcue${k + 1}`, cue !== null));
    });
    midi.light("fxOn", state.fx.on);
  }, [lights, connected, midi]);

  async function connect() {
    setError(null);
    try {
      await midi.connect();
      setConnected(true);
    } catch {
      setError("El navegador no permitió usar MIDI. Acepta el permiso o usa Chrome o Edge actualizados.");
    }
  }

  return { midi, connected, error, connect, supported: DjMidi.supported() };
}
