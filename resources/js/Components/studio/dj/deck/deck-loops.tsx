import { loopBeats } from "@/lib/dj/beat-grid";
import type { DjEngine } from "@/lib/dj/engine";
import type { DeckId, DeckState } from "@/lib/dj/types";
import { Pill } from "../controls/pill";
import { beatsLabel } from "../labels";

/** Manual loop (in, out, reloop), halve and double, and a 4-beat auto loop. */
export function DeckLoops({ engine, id, deck }: { engine: DjEngine; id: DeckId; deck: DeckState }) {
  const beats = loopBeats(deck);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-[10px] font-semibold tracking-wide text-faint uppercase">Loop</span>
      <Pill on={deck.loopIn !== null} onClick={() => engine.loopIn(id)} title="Inicio del loop" tone="onair">
        In
      </Pill>
      <Pill on={false} onClick={() => engine.loopOut(id)} title="Final del loop: empieza a repetir">
        Out
      </Pill>
      <Pill on={Boolean(deck.loop?.active)} onClick={() => engine.reloop(id)} title="Reloop / salir del loop" tone="onair">
        {deck.loop?.active ? "Salir" : "Reloop"}
      </Pill>
      <Pill on={false} onClick={() => engine.resizeLoop(id, 0.5)} title="Loop a la mitad">
        ½×
      </Pill>
      <Pill on={false} onClick={() => engine.resizeLoop(id, 2)} title="Loop al doble">
        2×
      </Pill>
      <Pill on={false} onClick={() => engine.beatLoop(id, 4)} title="Loop automático de 4 tiempos">
        4 beat
      </Pill>
      {beats !== null ? <span className="ml-auto font-mono text-[11px] text-onair">{beatsLabel(Math.round(beats * 100) / 100)} tiempos</span> : null}
    </div>
  );
}
