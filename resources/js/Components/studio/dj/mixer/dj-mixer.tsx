import { useRef } from "react";
import type { DjEngine } from "@/lib/dj/engine";
import type { DjState } from "@/lib/dj/types";
import { useAnimationFrame } from "../use-animation-frame";
import { Crossfader } from "./crossfader";
import { MixerMaster } from "./mixer-master";
import { MixerStrip } from "./mixer-strip";

/** The two-channel DJ mixer with master, headphones and crossfader; its meters move every frame. */
export function DjMixer({ engine, state }: { engine: DjEngine; state: DjState }) {
  const covers = useRef<(HTMLSpanElement | null)[]>([null, null, null, null]);

  useAnimationFrame(() => {
    const { channels, master } = engine.levels();
    [...channels, ...master].forEach((level, index) => {
      const cover = covers.current[index];
      if (cover) cover.style.height = `${Math.round((1 - level) * 100)}%`;
    });
  });

  const meter = (index: number) => (element: HTMLSpanElement | null) => {
    covers.current[index] = element;
  };

  return (
    <section aria-label="Mezclador DJ" className="h-full space-y-3 rounded-xl border border-line bg-surface p-3">
      <div className="grid grid-cols-[auto_auto_auto] justify-center gap-3">
        <MixerStrip engine={engine} id={0} channel={state.channels[0]} meter={meter(0)} />
        <MixerMaster engine={engine} state={state} meters={[meter(2), meter(3)]} />
        <MixerStrip engine={engine} id={1} channel={state.channels[1]} meter={meter(1)} />
      </div>
      <Crossfader engine={engine} state={state} />
    </section>
  );
}
