import { Square } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { SAMPLER_SLOTS } from "@/lib/dj/constants";
import type { DjEngine } from "@/lib/dj/engine";
import { DJ_KINDS, samplerSlot } from "@/lib/dj/sources";
import type { DjState } from "@/lib/dj/types";
import { shortTitle } from "@/lib/radio/format";
import type { BroadcastTrack } from "@/types/studio";
import { TrackPicker } from "../console/track-picker";

/** Eight sampler slots that sound inside the mix (the pad bank of the console fills them at first). */
export function SamplerPanel({ engine, state, library }: { engine: DjEngine; state: DjState; library: BroadcastTrack[] }) {
  return (
    <section aria-label="Sampler" className="@container flex min-w-0 flex-col gap-2.5 rounded-xl border border-line bg-surface p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-ink">Sampler</h3>
          <p className="text-[11px] text-muted">Suena dentro de tu mezcla. También desde los pads en modo «Sampler».</p>
        </div>
        <Button size="sm" variant="ghost" icon={<Square className="size-3 fill-current" />} onClick={() => engine.stopSample()}>
          Detener
        </Button>
      </header>
      <div className="grid flex-1 auto-rows-fr items-center gap-x-2 gap-y-1.5 @lg:grid-cols-2">
        {Array.from({ length: SAMPLER_SLOTS }, (_, index) => {
          const slot = state.sampler[index];
          return (
            <div key={index} className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!slot}
                onPointerDown={(event) => {
                  event.preventDefault();
                  void engine.fireSample(index);
                }}
                title={slot ? `Disparar «${slot.title}»` : "Elige un audio para esta ranura"}
                className="flex h-8 w-20 shrink-0 items-center justify-center truncate rounded-lg border border-line bg-raised px-1.5 text-[11px] font-semibold text-ink transition active:scale-95 disabled:text-faint"
              >
                {slot ? shortTitle(slot.title, 12) : `S${index + 1}`}
              </button>
              <TrackPicker
                library={library}
                value={slot?.id ?? ""}
                onChange={(id) => engine.setSample(index, samplerSlot(library.find((track) => track.id === id)))}
                kinds={DJ_KINDS}
                placeholder="Vacía"
                className="h-8 min-w-0 flex-1 rounded-lg border-line bg-raised px-2.5 pr-7 text-xs"
                label={`Audio de la ranura ${index + 1} del sampler`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
