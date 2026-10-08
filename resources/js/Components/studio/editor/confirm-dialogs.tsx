import type { ReactNode } from "react";
import { Button } from "@/Components/ui/button";
import { Modal } from "@/Components/ui/modal";
import { duration as clock } from "@/lib/format";
import { plural } from "@/lib/media/editor/describe";
import { isPlain, soundChanged, type Recipe } from "@/lib/media/editor/recipe";
import type { EditorTrack } from "@/types/media";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-20 shrink-0 text-muted">{label}</span>
      <span className="text-ink">{children}</span>
    </li>
  );
}

interface SaveProps {
  open: boolean;
  track: EditorTrack;
  recipe: Recipe;
  total: number;
  length: number;
  treatments: string[];
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** What the save will do: length before and after, cuts, fades, sound, and the schedule and episodes it reaches. */
export function SaveDialog({ open, track, recipe, total, length, treatments, busy, onClose, onConfirm }: SaveProps) {
  const plain = isPlain(recipe);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="¿Guardar la edición?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Seguir editando
          </Button>
          <Button onClick={onConfirm} loading={busy} disabled={plain}>
            {busy ? "Guardando…" : "Guardar edición"}
          </Button>
        </>
      }
    >
      <ul className="space-y-2 text-[13.5px]">
        <Row label="Duración">
          {clock(total)} → <b>{clock(length)}</b>
        </Row>
        {recipe.cuts.length > 0 && (
          <Row label="Cortes">
            {plural(recipe.cuts.length, "parte cortada", "partes cortadas")}
            {recipe.join > 0 ? `, unidas con fundido de ${recipe.join.toFixed(2)} s` : ""}
          </Row>
        )}
        {(recipe.fadeIn > 0 || recipe.fadeOut > 0) && (
          <Row label="Fundidos">{[recipe.fadeIn > 0 && `entrada ${recipe.fadeIn.toFixed(1)} s`, recipe.fadeOut > 0 && `salida ${recipe.fadeOut.toFixed(1)} s`].filter(Boolean).join(" · ")}</Row>
        )}
        {soundChanged(recipe) && <Row label="Sonido">{treatments.join(" · ")}</Row>}
        {plain && <Row label="Resultado">Sin cambios: usa «Restaurar original» para volver al audio original.</Row>}
      </ul>
      <div className="mt-4 space-y-2 rounded-xl bg-raised p-3.5 text-[12.5px] leading-5 text-muted">
        <p>El original queda guardado aparte: podrás reabrir esta edición para ajustarla o restaurar el original cuando quieras.</p>
        {track.upcoming > 0 && (
          <p>
            Lo programado con este audio ({plural(track.upcoming, "bloque", "bloques")}) sonará editado y tomará la nueva duración.
            {length > track.duration + 0.5 ? " Queda más largo: revisa la programación por si se cruza con lo siguiente." : ""}
          </p>
        )}
        {track.episodes > 0 && <p>{track.episodes === 1 ? "El episodio que usa" : `Los ${track.episodes} episodios que usan`} este audio sonarán con la versión editada.</p>}
      </div>
    </Modal>
  );
}

export function RestoreDialog({ open, title, total, busy, onClose, onConfirm }: { open: boolean; title: string; total: number; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="¿Restaurar el audio original?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {busy ? "Restaurando…" : "Restaurar original"}
          </Button>
        </>
      }
    >
      <p className="text-[13.5px] leading-6 text-muted">
        «{title}» volverá a sonar como cuando lo subiste ({clock(total)}), en la biblioteca y en todo lo programado. Se descartan los cortes y los ajustes de sonido guardados.
      </p>
    </Modal>
  );
}

export function LeaveDialog({ open, onStay, onLeave }: { open: boolean; onStay: () => void; onLeave: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onStay}
      size="sm"
      title="¿Salir sin guardar?"
      footer={
        <>
          <Button variant="secondary" onClick={onStay}>
            Seguir editando
          </Button>
          <Button variant="danger" onClick={onLeave}>
            Salir sin guardar
          </Button>
        </>
      }
    >
      <p className="text-[13.5px] leading-6 text-muted">Tienes cambios sin guardar en el editor. Si sales ahora, se pierden.</p>
    </Modal>
  );
}
