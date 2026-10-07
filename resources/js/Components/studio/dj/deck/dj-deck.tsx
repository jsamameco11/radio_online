import { cn } from "@/lib/cn";
import type { DjEngine } from "@/lib/dj/engine";
import type { DeckId, DeckState, SamplerSlot } from "@/lib/dj/types";
import type { BroadcastTrack } from "@/types/studio";
import { Pill } from "../controls/pill";
import { WaveOverview } from "../waveform/wave-overview";
import { DeckClock } from "./deck-clock";
import { DeckGridTools } from "./deck-grid-tools";
import { DeckHeader } from "./deck-header";
import { DeckLoader } from "./deck-loader";
import { DeckLoops } from "./deck-loops";
import { DeckPads } from "./deck-pads";
import { DeckTempo } from "./deck-tempo";
import { DeckTransport } from "./deck-transport";
import { JogWheel } from "./jog-wheel";

interface DjDeckProps {
  engine: DjEngine;
  id: DeckId;
  deck: DeckState;
  sampler: (SamplerSlot | null)[];
  library: BroadcastTrack[];
  onNotice: (text: string) => void;
}

/** One deck: load, overview, platter, tempo and sync, loops, pads in four modes and the transport. */
export function DjDeck({ engine, id, deck, sampler, library, onNotice }: DjDeckProps) {
  return (
    <section aria-label={`Deck ${id + 1}`} className={cn("space-y-3 rounded-2xl border bg-surface p-4", deck.playing ? "border-onair/40" : "border-line")}>
      <DeckHeader engine={engine} id={id} deck={deck} />
      <DeckLoader engine={engine} id={id} deck={deck} library={library} />
      <WaveOverview engine={engine} id={id} deck={deck} />
      <DeckClock engine={engine} id={id} deck={deck} />

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex flex-col items-center gap-2">
          <JogWheel engine={engine} id={id} deck={deck} />
          <div className="flex flex-wrap justify-center gap-1">
            <Pill on={deck.vinyl} onClick={() => engine.setVinyl(id, !deck.vinyl)} title="Modo vinilo: la parte superior del plato hace scratch">
              Vinilo
            </Pill>
            <Pill on={deck.reverse} onClick={() => engine.setReverse(id, !deck.reverse)} title="Reproducir al revés" tone="gold">
              Rev
            </Pill>
            <Pill on={deck.keylock} onClick={() => engine.setKeylock(id, !deck.keylock)} title="Key lock (master tempo): cambia el tempo sin cambiar el tono" tone="info">
              Key lock
            </Pill>
          </div>
        </div>
        <DeckTempo engine={engine} id={id} deck={deck} onNotice={onNotice} />
      </div>

      <DeckLoops engine={engine} id={id} deck={deck} />
      <DeckPads engine={engine} id={id} deck={deck} sampler={sampler} />

      <div className="flex items-center gap-2">
        <DeckTransport engine={engine} id={id} deck={deck} />
        <div className="ml-auto">
          <DeckGridTools engine={engine} id={id} />
        </div>
      </div>
    </section>
  );
}
