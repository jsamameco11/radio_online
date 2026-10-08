import { RotateCcw, Scissors, SquareDashed } from "lucide-react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { preciseTime, type Cut } from "@/lib/media/editor/recipe";

interface Props {
  selection: Cut | null;
  overlapsCut: boolean;
  canCutStart: boolean;
  canCutEnd: boolean;
  onCut: () => void;
  onKeep: () => void;
  onRestore: () => void;
  onClear: () => void;
  onCutStart: () => void;
  onCutEnd: () => void;
}

/** What can be done with the selection, or with the cursor when nothing is selected. */
export function EditActions({ selection, overlapsCut, canCutStart, canCutEnd, onCut, onKeep, onRestore, onClear, onCutStart, onCutEnd }: Props) {
  if (selection) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info" className="py-1 tabular">
          Selección {preciseTime(selection[0])} → {preciseTime(selection[1])} · {preciseTime(selection[1] - selection[0])}
        </Badge>
        <Button size="sm" variant="danger" icon={<Scissors className="size-3.5" />} onClick={onCut} title="Supr">
          Cortar selección
        </Button>
        <Button size="sm" variant="secondary" icon={<SquareDashed className="size-3.5" />} onClick={onKeep}>
          Quedarme solo con esto
        </Button>
        {overlapsCut && (
          <Button size="sm" variant="secondary" icon={<RotateCcw className="size-3.5" />} onClick={onRestore}>
            Recuperar lo cortado aquí
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClear}>
          Quitar selección (Esc)
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="mr-auto min-w-[16rem] flex-1 text-[12.5px] text-muted">
        <b className="text-ink">Arrastra sobre la onda</b> para seleccionar la parte que quieres quitar. Haz clic para mover el cursor. Las marcas rojas se pueden arrastrar para afinar un corte.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={<Scissors className="size-3.5" />} onClick={onCutStart} disabled={!canCutStart} title="Quita la introducción hasta el cursor">
          Quitar el inicio hasta aquí
        </Button>
        <Button size="sm" variant="secondary" icon={<Scissors className="size-3.5" />} onClick={onCutEnd} disabled={!canCutEnd} title="Quita el final desde el cursor">
          Quitar desde aquí hasta el final
        </Button>
      </div>
    </div>
  );
}
