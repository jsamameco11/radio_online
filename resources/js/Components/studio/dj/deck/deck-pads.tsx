import { useState } from "react";
import { cn } from "@/lib/cn";
import { loopBeats } from "@/lib/dj/beat-grid";
import { HOT_CUES, JUMP_PADS, LOOP_PADS } from "@/lib/dj/constants";
import type { DjEngine } from "@/lib/dj/engine";
import type { DeckId, DeckState, SamplerSlot } from "@/lib/dj/types";
import { shortTitle } from "@/lib/radio/format";
import { Pill } from "../controls/pill";
import { Segmented } from "../controls/segmented";
import { beatsLabel, deckTime, PAD_MODES } from "../labels";
import { HOT_CLASSES } from "../palette";

interface PadFace {
  text: string;
  lit: boolean;
  color: string | null;
}

const HINTS: Partial<Record<DeckState["padMode"], string>> = {
  hotcue: "Toca para guardar o saltar · clic derecho o Shift para borrar",
  sampler: "Toca para disparar · clic derecho o Shift para detener",
};

interface DeckPadsProps {
  engine: DjEngine;
  id: DeckId;
  deck: DeckState;
  sampler: (SamplerSlot | null)[];
}

/** Eight performance pads in four modes (hot cue, beat loop, beat jump, sampler) with shift. */
export function DeckPads({ engine, id, deck, sampler }: DeckPadsProps) {
  const [shift, setShift] = useState(false);
  const beats = loopBeats(deck);
  const erasable = deck.padMode === "hotcue" || deck.padMode === "sampler";

  function face(index: number): PadFace {
    if (deck.padMode === "hotcue") {
      const cue = deck.hotcues[index];
      return cue === null ? { text: String(index + 1), lit: false, color: null } : { text: deckTime(cue), lit: true, color: HOT_CLASSES[index] };
    }
    if (deck.padMode === "loop") return { text: beatsLabel(LOOP_PADS[index]), lit: beats !== null && Math.abs(beats - LOOP_PADS[index]) < 0.01, color: null };
    if (deck.padMode === "jump") {
      const jump = JUMP_PADS[index];
      return { text: jump < 0 ? `◀ ${-jump}` : `${jump} ▶`, lit: false, color: null };
    }
    const slot = sampler[index];
    return { text: slot ? shortTitle(slot.title, 14) : `S${index + 1}`, lit: slot !== null, color: null };
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Segmented
          label={`Modo de los pads del deck ${id + 1}`}
          value={deck.padMode}
          options={PAD_MODES}
          onChange={(mode) => engine.setPadMode(id, mode)}
          className="flex flex-1 gap-1"
          buttonClassName="h-6 flex-1 text-[10px] font-bold tracking-wide uppercase"
        />
        <Pill on={shift} onClick={() => setShift(!shift)} title="Shift: borra hot cues y detiene samples" tone="gold">
          Shift
        </Pill>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: HOT_CUES }, (_, index) => {
          const pad = face(index);
          return (
            <button
              key={index}
              type="button"
              disabled={!deck.track && deck.padMode !== "sampler"}
              onPointerDown={(event) => {
                event.preventDefault();
                engine.triggerPad(id, deck.padMode, index, shift);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                if (erasable) engine.triggerPad(id, deck.padMode, index, true);
              }}
              title={HINTS[deck.padMode]}
              className={cn(
                "relative flex h-11 items-center justify-center overflow-hidden rounded-lg border text-[11px] font-semibold transition active:scale-95 disabled:opacity-40",
                pad.lit ? "border-line-strong bg-raised text-ink" : "border-line bg-canvas text-muted hover:text-ink",
              )}
            >
              {pad.lit ? <span className={cn("absolute inset-x-0 top-0 h-1", pad.color ?? "bg-signal")} /> : null}
              <span className="truncate px-1 font-mono">{pad.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
