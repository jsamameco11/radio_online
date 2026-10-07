import { Cable, Eraser, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { Tabs } from "@/Components/ui/tabs";
import { MIDI_CONTROLS, MIDI_GROUPS, midiKeyLabel, type MidiGroup } from "@/lib/dj/midi/controls";
import { ddj400Mapping } from "@/lib/dj/midi/ddj-400";
import type { DjMidi } from "@/lib/dj/midi/dj-midi";

interface MidiPanelProps {
  open: boolean;
  onClose: () => void;
  midi: DjMidi;
  connected: boolean;
  supported: boolean;
  error: string | null;
  onConnect: () => void;
}

/** Connects a USB DJ controller and assigns its controls («Aprender»), saved on this computer. */
export function MidiPanel({ open, onClose, midi, connected, supported, error, onConnect }: MidiPanelProps) {
  const [group, setGroup] = useState<MidiGroup>("Deck 1");
  const controls = MIDI_CONTROLS.filter((control) => control.group === group);

  return (
    <Modal
      open={open}
      onClose={() => {
        midi.learn(null);
        onClose();
      }}
      size="xl"
      title="Controlador DJ (MIDI)"
      description="Conecta tu controlador por USB (Pioneer DDJ, Numark, Hercules, Traktor…) y maneja esta consola desde él. Usa Chrome o Edge."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {connected ? (
            <p className="text-sm text-ink">
              {midi.inputs.length ? (
                <>
                  Conectado: <span className="font-semibold">{midi.inputs.join(", ")}</span>
                </>
              ) : (
                "MIDI activo, pero no hay ningún controlador conectado. Enchúfalo por USB."
              )}
            </p>
          ) : (
            <Button icon={<Cable className="size-4" />} disabled={!supported} onClick={onConnect}>
              Conectar controlador
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" icon={<RotateCcw className="size-3.5" />} onClick={() => midi.setMapping(ddj400Mapping())}>
              Mapa Pioneer DDJ-400
            </Button>
            <Button size="sm" variant="ghost" icon={<Eraser className="size-3.5" />} onClick={() => window.confirm("¿Borrar todas las asignaciones MIDI de este equipo?") && midi.setMapping({})}>
              Borrar todo
            </Button>
          </div>
        </div>
        {!supported ? <p className="text-sm text-warning">Este navegador no tiene MIDI. Abre la consola en Chrome o Edge para usar tu controlador.</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <p className="text-xs text-muted">
          Para asignar un control toca «Aprender» y mueve la perilla o pulsa el botón del controlador. El mapa del DDJ-400 viene listo; si alguno no responde, vuelve a aprenderlo. Si tu
          controlador tiene tarjeta de sonido, elige su salida como «Auriculares» para escuchar la pre-escucha en el equipo.
        </p>
        <Checkbox label="Invertir el fader de tempo del controlador" checked={midi.invertTempo} onChange={(event) => midi.setInvertTempo(event.target.checked)} />

        <Tabs value={group} onChange={setGroup} items={MIDI_GROUPS.map((value) => ({ value, label: value }))} />

        <ul className="grid gap-1.5 sm:grid-cols-2">
          {controls.map((control) => {
            const assigned = midi.assignedTo(control.id);
            const learning = midi.learning === control.id;
            return (
              <li key={control.id} className="flex items-center gap-2 rounded-lg border border-line bg-raised px-3 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{control.label}</p>
                  <p className="text-[11px] text-muted">{learning ? "Mueve o pulsa el control…" : assigned ? midiKeyLabel(assigned) : "Sin asignar"}</p>
                </div>
                <Button size="sm" variant={learning ? "signal" : "secondary"} disabled={!connected} onClick={() => midi.learn(learning ? null : control.id)}>
                  {learning ? "Esperando" : "Aprender"}
                </Button>
                {assigned ? (
                  <Button size="sm" variant="ghost" onClick={() => midi.clear(control.id)} aria-label={`Quitar la asignación de ${control.label}`}>
                    Quitar
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
