import { Headphones } from "lucide-react";
import { cn } from "@/lib/cn";
import { EQ_RANGE, TRIM_DB } from "@/lib/dj/constants";
import type { DjEngine } from "@/lib/dj/engine";
import type { ChannelState, DeckId } from "@/lib/dj/types";
import { Knob } from "../controls/knob";
import { eqLabel, filterLabel, signedLabel } from "../labels";
import { LevelMeter } from "./level-meter";

interface MixerStripProps {
  engine: DjEngine;
  id: DeckId;
  channel: ChannelState;
  meter: (element: HTMLSpanElement | null) => void;
}

/** One channel of the mixer: trim, three-band EQ, filter, headphones cue, meter and fader. */
export function MixerStrip({ engine, id, channel, meter }: MixerStripProps) {
  const set = (patch: Partial<ChannelState>) => engine.setChannel(id, patch);
  const eq = { min: EQ_RANGE.min, max: EQ_RANGE.max, defaultValue: 0, bipolar: true, format: eqLabel, size: "sm" } as const;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="font-display text-sm font-bold text-ink">{id + 1}</span>
      <Knob label="Trim" value={channel.trim} min={-TRIM_DB} max={TRIM_DB} defaultValue={0} bipolar onChange={(trim) => set({ trim })} format={signedLabel} size="sm" tone="ink" />
      <Knob label="Hi" value={channel.high} onChange={(high) => set({ high })} {...eq} />
      <Knob label="Mid" value={channel.mid} onChange={(mid) => set({ mid })} {...eq} />
      <Knob label="Low" value={channel.low} onChange={(low) => set({ low })} {...eq} />
      <Knob label="Filtro" value={channel.filter} min={-1} max={1} defaultValue={0} bipolar onChange={(filter) => set({ filter })} format={filterLabel} size="sm" tone="info" />
      <button
        type="button"
        onClick={() => set({ cue: !channel.cue })}
        aria-pressed={channel.cue}
        title="Escuchar este canal en los auriculares"
        className={cn("flex h-7 w-12 items-center justify-center gap-1 rounded-md border text-[10px] font-bold uppercase transition", channel.cue ? "border-gold/60 bg-gold-soft text-gold" : "border-line bg-raised text-muted hover:text-ink")}
      >
        <Headphones className="size-3" /> Cue
      </button>
      <div className="flex items-end gap-1.5">
        <LevelMeter cover={meter} label={`Nivel del canal ${id + 1}`} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={channel.fader}
          onChange={(event) => set({ fader: Number(event.target.value) })}
          className="h-36 w-6 accent-signal [writing-mode:vertical-lr] [direction:rtl]"
          aria-label={`Fader del canal ${id + 1}`}
        />
      </div>
    </div>
  );
}
