import type { DjEngine } from "@/lib/dj/engine";
import type { DeckId } from "@/lib/dj/types";
import { Pill } from "../controls/pill";

/** Corrections of the analysed tempo and beat grid, and a long jump back. */
export function DeckGridTools({ engine, id }: { engine: DjEngine; id: DeckId }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      <Pill on={false} onClick={() => engine.scaleBpm(id, 0.5)} title="BPM a la mitad">
        ½ BPM
      </Pill>
      <Pill on={false} onClick={() => engine.scaleBpm(id, 2)} title="BPM al doble">
        2× BPM
      </Pill>
      <Pill on={false} onClick={() => engine.gridHere(id)} title="El tiempo bajo la aguja pasa a ser el primero del compás">
        Compás
      </Pill>
      <Pill on={false} onClick={() => engine.nudgeGrid(id, -10)} title="Mover la grilla 10 ms antes">
        ◀ Grilla
      </Pill>
      <Pill on={false} onClick={() => engine.nudgeGrid(id, 10)} title="Mover la grilla 10 ms después">
        Grilla ▶
      </Pill>
      <Pill on={false} onClick={() => engine.beatJump(id, -32)} title="Saltar 32 tiempos atrás">
        ◀ 32
      </Pill>
    </div>
  );
}
