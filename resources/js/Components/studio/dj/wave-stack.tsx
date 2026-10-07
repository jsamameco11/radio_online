import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/Components/ui/button";
import { cn } from "@/lib/cn";
import { DECKS } from "@/lib/dj/constants";
import type { DjEngine } from "@/lib/dj/engine";
import type { DjState } from "@/lib/dj/types";
import { WaveScroller } from "./waveform/wave-scroller";

/** Seconds shown by the scrolling waveforms, from closest to widest. */
const ZOOMS = [2, 4, 8, 16, 32];
const DEFAULT_ZOOM = ZOOMS.indexOf(8);

interface WaveStackProps {
  engine: DjEngine;
  state: DjState;
  /** Title under the controller's library browser, when one is connected. */
  browsing: string | null;
}

/** Both decks' scrolling waveforms stacked, to line up the beats by eye, with zoom. */
export function WaveStack({ engine, state, browsing }: WaveStackProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <span className="font-semibold tracking-wide uppercase">Ondas</span>
        <Button size="icon" variant="ghost" className="size-6" disabled={zoom === 0} onClick={() => setZoom(zoom - 1)} aria-label="Acercar las ondas">
          <Plus className="size-3.5" />
        </Button>
        <span className="font-mono tabular">{ZOOMS[zoom]} s</span>
        <Button size="icon" variant="ghost" className="size-6" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom(zoom + 1)} aria-label="Alejar las ondas">
          <Minus className="size-3.5" />
        </Button>
        {browsing ? (
          <span className="ml-auto truncate">
            Navegador del controlador: <span className="font-medium text-ink">{browsing}</span>
          </span>
        ) : null}
      </div>
      {DECKS.map((id) => (
        <div key={id} className="flex items-center gap-2">
          <span className={cn("w-4 text-center font-display text-xs font-bold", state.decks[id].playing ? "text-onair" : "text-faint")}>{id + 1}</span>
          <WaveScroller engine={engine} id={id} deck={state.decks[id]} span={ZOOMS[zoom]} className="h-16" />
        </div>
      ))}
    </div>
  );
}
