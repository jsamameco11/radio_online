import { usePage } from "@inertiajs/react";
import { Circle, Mic, MicOff, Radio, Square } from "lucide-react";
import { useState } from "react";
import { Button } from "@/Components/ui/button";
import { Checkbox, Field, Input, Select } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import type { SharedProps } from "@/types";
import { LevelMeter } from "./level-meter";
import type { ConsoleApi } from "./use-console";

/**
 * The live transmission of this console: open it with the host and program names, talk on air,
 * the microphone chain and the recording of the transmission.
 */
export function LivePanel({ api }: { api: ConsoleApi }) {
  const { snapshot, mic } = api;
  const { auth } = usePage<SharedProps>().props;
  const session = snapshot.live.session;
  const mine = session !== null && snapshot.live.host_id === auth.user?.id;
  const external = snapshot.config.live_source === "external";
  const [record, setRecord] = useState(!external);

  return (
    <Panel
      title="Transmisión en vivo"
      description={session ? "Estás al aire. La voz llega a cada oyente por una conexión directa." : "Abre la transmisión para hablar al aire con tu micrófono."}
      actions={api.capturing ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger"><Circle className="size-2.5 animate-pulse fill-current" /> Grabando</span> : null}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Locutor">{(id) => <Input id={id} value={api.hostName} maxLength={80} onChange={(event) => api.setHostName(event.target.value)} onBlur={() => session && void api.saveTitles()} />}</Field>
          <Field label="Programa">
            {(id) => <Input id={id} value={api.title} maxLength={120} placeholder="Por ejemplo «Mañanas al día»" onChange={(event) => api.setTitle(event.target.value)} onBlur={() => session && void api.saveTitles()} />}
          </Field>
        </div>

        {session ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="lg"
              variant={api.talking ? "danger" : "primary"}
              icon={api.talking ? <Mic className="size-5" /> : <MicOff className="size-5" />}
              onClick={() => void api.talk(!api.talking)}
              disabled={!api.micOpen || !mine}
              aria-pressed={api.talking}
            >
              {api.talking ? (api.speaking ? "Al aire · hablando" : "Al aire") : "Hablar"}
            </Button>
            {mine && !api.micOpen ? (
              <Button variant="secondary" onClick={() => void api.openMic()}>
                Activar micrófono
              </Button>
            ) : null}
            <Button variant="ghost" icon={<Square className="size-4" />} onClick={() => void api.stopLive()} loading={api.busy} className="ml-auto">
              Terminar transmisión
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" variant="signal" icon={<Radio className="size-5" />} loading={api.busy} onClick={() => void api.startLive(record && !external)}>
              Abrir transmisión en vivo
            </Button>
            <Checkbox label="Grabar la transmisión" checked={record && !external} disabled={external} onChange={(event) => setRecord(event.target.checked)} />
          </div>
        )}
        {session && !mine ? <p className="text-xs text-warning">La transmisión la conduce {snapshot.live.host || "otro locutor"} desde otra consola: solo su micrófono sale al aire.</p> : null}
        {external ? <p className="text-xs text-muted">La fuente del vivo es una señal externa (OBS, Icecast): esta consola no graba ese audio.</p> : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Nivel del micrófono</span>
            <span className="tabular">{Math.round(mic.level * 100)}%</span>
          </div>
          <input type="range" min={0} max={2} step={0.05} value={mic.level} onChange={(event) => api.changeMic({ level: Number(event.target.value) })} className="w-full accent-signal" aria-label="Nivel del micrófono" />
          <LevelMeter analyser={api.micOpen ? (api.caster.current?.analyser ?? null) : null} label="Señal del micrófono" />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {api.devices.length > 1 ? (
            <Field label="Micrófono" className="sm:col-span-2">
              {(id) => (
                <Select id={id} value={mic.deviceId} onChange={(event) => api.changeMic({ deviceId: event.target.value })}>
                  <option value="">Predeterminado del sistema</option>
                  {api.devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Micrófono ${index + 1}`}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <Checkbox label="Detectar voz (baja la música al hablar)" checked={mic.voiceDuck} onChange={(event) => api.changeMic({ voiceDuck: event.target.checked })} />
          <Checkbox label="Música de fondo al hablar" checked={mic.autoBed} onChange={(event) => api.changeMic({ autoBed: event.target.checked })} />
          <Checkbox label="Hablar al abrir la transmisión" checked={mic.talkOnStart} onChange={(event) => api.changeMic({ talkOnStart: event.target.checked })} />
          <Checkbox label="Reducir eco y ruido" checked={mic.processing} onChange={(event) => api.changeMic({ processing: event.target.checked })} />
          <Checkbox label="Escuchar mi micrófono" checked={mic.selfMonitor} onChange={(event) => api.changeMic({ selfMonitor: event.target.checked })} />
        </div>
      </div>
    </Panel>
  );
}
