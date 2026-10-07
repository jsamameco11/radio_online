import { Power } from "lucide-react";
import { cn } from "@/lib/cn";
import { DECKS, EFFECTS, FX_BEATS } from "@/lib/dj/constants";
import type { DjEngine } from "@/lib/dj/engine";
import type { DjState } from "@/lib/dj/types";
import { Knob } from "./controls/knob";
import { Segmented } from "./controls/segmented";
import { beatsLabel, FX_TARGETS } from "./labels";

const KINDS = EFFECTS.map((effect) => ({ value: effect.kind, label: effect.label, hint: effect.hint }));
const BEATS = FX_BEATS.map((beats) => ({ value: beats, label: beatsLabel(beats) }));

/** Beat FX: one effect at a time, synced to the BPM, on channel 1, channel 2 or the master. */
export function FxUnit({ engine, state }: { engine: DjEngine; state: DjState }) {
  const { fx } = state;
  const source = fx.target === "1" ? 0 : fx.target === "2" ? 1 : DECKS.find((id) => state.decks[id].playing && state.decks[id].bpm);
  const bpm = source !== undefined ? engine.effectiveBpm(source) : null;

  return (
    <section aria-label="Efectos" className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Beat FX</h3>
          <p className="text-xs text-muted">{bpm ? `Sincronizado a ${bpm.toFixed(1)} BPM` : "A 120 BPM hasta que suene un deck con BPM"}</p>
        </div>
        <button
          type="button"
          onClick={() => engine.setFx({ on: !fx.on })}
          aria-pressed={fx.on}
          className={cn("flex h-10 items-center gap-1.5 rounded-xl border-2 px-4 text-sm font-bold transition", fx.on ? "border-info bg-info text-white" : "border-info/50 bg-info-soft text-info")}
        >
          <Power className="size-4" /> {fx.on ? "FX ON" : "FX OFF"}
        </button>
      </header>
      <Segmented label="Efecto" value={fx.kind} options={KINDS} onChange={(kind) => engine.setFx({ kind })} tone="info" className="grid grid-cols-3 gap-1.5" buttonClassName="h-8 rounded-lg text-xs" />
      <div className="flex items-end gap-4">
        <div className="flex-1 space-y-1.5">
          <span className="text-[10px] font-bold tracking-wide text-muted uppercase">Tiempos</span>
          <Segmented label="Tiempos del efecto" value={fx.beats} options={BEATS} onChange={(beats) => engine.setFx({ beats })} tone="info" className="flex flex-wrap gap-1" buttonClassName="h-7 min-w-9 px-1.5 font-mono text-[11px] font-normal" />
          <span className="block pt-1 text-[10px] font-bold tracking-wide text-muted uppercase">Aplicar en</span>
          <Segmented label="Aplicar el efecto en" value={fx.target} options={FX_TARGETS} onChange={(target) => engine.setFx({ target })} tone="info" buttonClassName="h-7 flex-1 text-[11px]" />
        </div>
        <Knob label="Nivel" value={fx.depth} min={0} max={1} defaultValue={0.5} onChange={(depth) => engine.setFx({ depth })} format={(value) => `${Math.round(value * 100)}%`} tone="info" />
      </div>
    </section>
  );
}
