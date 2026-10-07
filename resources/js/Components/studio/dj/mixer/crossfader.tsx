import type { DjEngine } from "@/lib/dj/engine";
import type { DjState } from "@/lib/dj/types";
import { Segmented } from "../controls/segmented";
import { CURVES } from "../labels";

/** The crossfader (double click centres it) and its curve. */
export function Crossfader({ engine, state }: { engine: DjEngine; state: DjState }) {
  return (
    <div className="space-y-1.5 border-t border-line pt-3">
      <div className="flex items-center justify-between text-[10px] font-bold tracking-wide text-muted uppercase">
        <span>1</span>
        <span>Crossfader</span>
        <span>2</span>
      </div>
      <input
        type="range"
        min={-1}
        max={1}
        step={0.005}
        value={state.crossfader}
        onChange={(event) => engine.setMixer({ crossfader: Number(event.target.value) })}
        onDoubleClick={() => engine.setMixer({ crossfader: 0 })}
        className="w-full accent-ink"
        aria-label="Crossfader"
        title="Crossfader · doble clic para centrar"
      />
      <Segmented label="Curva del crossfader" value={state.curve} options={CURVES} onChange={(curve) => engine.setMixer({ curve })} tone="ink" buttonClassName="h-6 flex-1 text-[10px] font-bold uppercase" />
    </div>
  );
}
