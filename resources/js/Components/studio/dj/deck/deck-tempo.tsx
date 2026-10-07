import { TEMPO_RANGES } from "@/lib/dj/constants";
import type { DjEngine } from "@/lib/dj/engine";
import type { DeckId, DeckState } from "@/lib/dj/types";
import { Pill } from "../controls/pill";

interface DeckTempoProps {
  engine: DjEngine;
  id: DeckId;
  deck: DeckState;
  onNotice: (text: string) => void;
}

/** Tempo fader with its range, reset, sync and tap tempo. */
export function DeckTempo({ engine, id, deck, onNotice }: DeckTempoProps) {
  const nextRange = TEMPO_RANGES[(TEMPO_RANGES.indexOf(deck.range) + 1) % TEMPO_RANGES.length];

  function sync() {
    const problem = engine.toggleSync(id);
    if (problem) onNotice(problem);
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button type="button" onClick={() => engine.setRange(id, nextRange)} title="Rango del fader de tempo" className="h-6 rounded-md border border-line bg-raised px-1.5 font-mono text-[10px] text-muted hover:text-ink">
        {deck.range >= 0.5 ? "Ancho" : `±${Math.round(deck.range * 100)}%`}
      </button>
      <input
        type="range"
        min={-1}
        max={1}
        step={0.001}
        value={-deck.tempo}
        onChange={(event) => engine.setTempo(id, -Number(event.target.value))}
        onDoubleClick={() => engine.resetTempo(id)}
        className="h-36 w-6 accent-gold [writing-mode:vertical-lr] [direction:rtl]"
        aria-label={`Tempo del deck ${id + 1} (arriba más lento, abajo más rápido)`}
        title="Tempo · doble clic para volver a 0"
      />
      <button type="button" onClick={() => engine.resetTempo(id)} className="text-[10px] font-semibold text-muted uppercase hover:text-ink" title="Tempo a 0 %">
        0 %
      </button>
      <Pill on={deck.sync} onClick={sync} title="Sincronizar tempo y fase con el otro deck" tone="onair" className="w-14">
        Sync
      </Pill>
      <Pill on={false} onClick={() => engine.tap(id)} title="Marca el pulso con toques para fijar el BPM" className="w-14">
        Tap
      </Pill>
    </div>
  );
}
