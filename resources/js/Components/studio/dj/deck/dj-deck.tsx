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

/**
 * One deck: load, overview, platter, tempo and sync, loops, pads in four modes and the transport.
 * The second deck is mirrored, so both records sit on the outer edges of the booth.
 */
export function DjDeck({ engine, id, deck, sampler, library, onNotice }: DjDeckProps) {
  const mirrored = id === 1;

  return (
    <section aria-label={`Deck ${id + 1}`} className={cn("@container min-w-0 space-y-2.5 rounded-xl border bg-surface p-3", deck.playing ? "border-onair/40" : "border-line")}>
      <DeckHeader engine={engine} id={id} deck={deck} />
      <DeckLoader engine={engine} id={id} deck={deck} library={library} />
      <WaveOverview engine={engine} id={id} deck={deck} />
      <DeckClock engine={engine} id={id} deck={deck} />

      <div
        className={cn(
          "grid items-start gap-3",
          mirrored ? "grid-cols-[auto_minmax(0,1fr)] @xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,12rem)]" : "grid-cols-[minmax(0,1fr)_auto] @xl:grid-cols-[minmax(0,12rem)_auto_minmax(0,1fr)]",
        )}
      >
        <div className={cn("flex w-full max-w-48 flex-col items-center gap-2 justify-self-center", mirrored ? "order-2 @xl:order-3 @xl:justify-self-end" : "@xl:justify-self-start")}>
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
        <div className={cn(mirrored && "order-1 @xl:order-2")}>
          <DeckTempo engine={engine} id={id} deck={deck} onNotice={onNotice} />
        </div>
        <div className={cn("col-span-2 min-w-0 space-y-2.5 @xl:col-span-1", mirrored && "order-3 @xl:order-1")}>
          <DeckLoops engine={engine} id={id} deck={deck} />
          <DeckPads engine={engine} id={id} deck={deck} sampler={sampler} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DeckTransport engine={engine} id={id} deck={deck} />
        <div className="ml-auto">
          <DeckGridTools engine={engine} id={id} />
        </div>
      </div>
    </section>
  );
}
