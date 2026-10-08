import { Redo2, RotateCcw, Save, Undo2 } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { duration as clock } from "@/lib/format";

interface Props {
  processing: boolean;
  dirty: boolean;
  edited: boolean;
  length: number;
  treatments: string[];
  canUndo: boolean;
  canRedo: boolean;
  canSave: boolean;
  busy: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDiscard: () => void;
  onRestore: () => void;
  onSave: () => void;
}

/** Always at hand at the bottom: undo and redo, what changed and the save, discard and restore actions. */
export function SaveBar({ processing, dirty, edited, length, treatments, canUndo, canRedo, canSave, busy, onUndo, onRedo, onDiscard, onRestore, onSave }: Props) {
  return (
    <div className="sticky bottom-0 z-20 -mx-1 rounded-t-2xl border border-b-0 border-line bg-surface/90 px-4 py-3 shadow-2xl backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <Button size="icon" variant="ghost" aria-label="Deshacer (Ctrl+Z)" title="Deshacer (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
          <Undo2 className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Rehacer (Ctrl+Y)" title="Rehacer (Ctrl+Y)" disabled={!canRedo} onClick={onRedo}>
          <Redo2 className="size-4" />
        </Button>
        <p className="mr-auto ml-1 min-w-0 flex-1 truncate text-[13px]">
          {processing ? (
            <span className="font-semibold text-warning">Procesando…</span>
          ) : dirty ? (
            <span>
              <b className="text-signal">Cambios sin guardar</b>
              <span className="hidden text-muted sm:inline">
                {" "}
                · {clock(length)}
                {treatments.length ? ` · ${treatments.slice(0, 3).join(", ")}${treatments.length > 3 ? "…" : ""}` : ""}
              </span>
            </span>
          ) : (
            <span className="text-muted">{edited ? "Esta es la edición guardada." : "Sin cambios."}</span>
          )}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {edited && (
            <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={onRestore} disabled={processing || busy} className="text-danger hover:text-danger">
              Restaurar original
            </Button>
          )}
          {dirty && (
            <Button variant="secondary" onClick={onDiscard} disabled={processing}>
              Descartar cambios
            </Button>
          )}
          <Button icon={<Save className="size-4" />} onClick={onSave} disabled={!canSave}>
            Guardar edición
          </Button>
        </div>
      </div>
    </div>
  );
}
