import { usePage } from "@inertiajs/react";
import { Cable, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/Components/ui/button";
import { Panel } from "@/Components/ui/panel";
import { SAMPLER_SLOTS } from "@/lib/dj/constants";
import { playableInDj, samplerSlot, trackSource } from "@/lib/dj/sources";
import type { SharedProps } from "@/types";
import type { BroadcastTrack } from "@/types/studio";
import type { ConsoleApi } from "../console/use-console";
import { AirBar } from "./air-bar";
import { Pill } from "./controls/pill";
import { DjDeck } from "./deck/dj-deck";
import { FxUnit } from "./fx-unit";
import { MidiPanel } from "./midi-panel";
import { DjMixer } from "./mixer/dj-mixer";
import { SamplerPanel } from "./sampler-panel";
import { useDjEngine } from "./use-dj-engine";
import { useDjMidi } from "./use-dj-midi";
import { WaveStack } from "./wave-stack";

interface DjConsoleProps {
  api: ConsoleApi;
  library: BroadcastTrack[];
  /** The console's pad bank, which fills the sampler at first. */
  pads: BroadcastTrack[];
}

/**
 * The DJ booth of the live console: two decks, the mixer, beat FX and sampler in this browser.
 * Until it goes on air the mix only sounds in the headphones; on air it reaches every listener
 * through the same live link as the microphone, in stereo and at the music bitrate.
 */
export function DjConsole({ api, library, pads }: DjConsoleProps) {
  const { engine, state, failed } = useDjEngine(api.caster);
  const { auth } = usePage<SharedProps>().props;
  const [notice, setNotice] = useState<string | null>(null);
  const [midiOpen, setMidiOpen] = useState(false);
  const [browse, setBrowse] = useState(0);
  const playable = useMemo(() => library.filter(playableInDj), [library]);
  const browsed = playable[Math.min(browse, playable.length - 1)] ?? null;

  const canAir = api.snapshot.live.session !== null && api.snapshot.live.host_id === auth.user?.id && api.micOpen;
  const onAir = state?.onAir ?? false;

  const midi = useDjMidi(engine, state, {
    browse: (steps) => setBrowse((index) => Math.min(Math.max(0, playable.length - 1), Math.max(0, index + steps))),
    load: (id) => {
      const source = trackSource(browsed);
      if (source) void engine?.load(id, source);
    },
    notice: setNotice,
  });
  const controller = midi.connected && midi.midi.inputs.length > 0;

  useEffect(() => {
    if (!engine || engine.getState().sampler.some(Boolean)) return;
    pads.slice(0, SAMPLER_SLOTS).forEach((pad, index) => {
      const slot = samplerSlot(pad);
      if (slot) engine.setSample(index, slot);
    });
  }, [engine, pads]);

  useEffect(() => {
    if (engine && onAir && !canAir) engine.setOnAir(false);
  }, [engine, onAir, canAir]);

  if (failed) {
    return (
      <Panel title="Consola DJ" dense>
        <p className="text-xs text-muted">Este navegador no puede abrir la consola DJ. Usa Chrome, Edge o Firefox actualizados en una computadora.</p>
      </Panel>
    );
  }

  return (
    <Panel
      dense
      title="Consola DJ"
      description="Dos vinilos, mezclador, efectos y sampler. Prepara en tus auriculares y pon la mezcla al aire cuando quieras."
      actions={
        <>
          <Button size="sm" variant={controller ? "signal" : "secondary"} icon={<Cable className="size-3.5" />} onClick={() => setMidiOpen(true)}>
            {controller ? "Controlador conectado" : "Controlador MIDI"}
          </Button>
          {state ? (
            <>
              <Pill on={state.quantize} onClick={() => engine?.setQuantize(!state.quantize)} title="Quantize: cues, loops y saltos caen exactos en el tiempo" tone="info">
                Quantize
              </Pill>
              <Pill on={state.autoGain} onClick={() => engine?.setMixer({ autoGain: !state.autoGain })} title="Ganancia automática: iguala el volumen de cada pista al cargarla" tone="info">
                Auto gain
              </Pill>
            </>
          ) : null}
        </>
      }
    >
      {!engine || !state ? (
        <p className="text-xs text-muted">Encendiendo la consola DJ…</p>
      ) : (
        <div className="space-y-2.5">
          <AirBar engine={engine} api={api} onAir={onAir} canAir={canAir} onNotice={setNotice} />

          {notice ? (
            <div role="status" className="flex items-start justify-between gap-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
              <p>{notice}</p>
              <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="opacity-70 hover:opacity-100">
                <X className="size-4" />
              </button>
            </div>
          ) : null}

          <WaveStack engine={engine} state={state} browsing={midi.connected ? (browsed?.title ?? null) : null} />

          <div className="grid gap-2.5 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <DjDeck engine={engine} id={0} deck={state.decks[0]} sampler={state.sampler} library={library} onNotice={setNotice} />
            <div className="lg:order-last lg:col-span-2 2xl:order-none 2xl:col-span-1">
              <DjMixer engine={engine} state={state} />
            </div>
            <DjDeck engine={engine} id={1} deck={state.decks[1]} sampler={state.sampler} library={library} onNotice={setNotice} />
          </div>

          <div className="grid gap-2.5 lg:grid-cols-2">
            <FxUnit engine={engine} state={state} />
            <SamplerPanel engine={engine} state={state} library={library} />
          </div>
        </div>
      )}

      <MidiPanel open={midiOpen} onClose={() => setMidiOpen(false)} midi={midi.midi} connected={midi.connected} supported={midi.supported} error={midi.error} onConnect={() => void midi.connect()} />
    </Panel>
  );
}
