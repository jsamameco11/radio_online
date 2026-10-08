import { usePage } from "@inertiajs/react";
import { Cable, Circle, Disc3, Mic, MicOff, Radio, Square } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/Components/ui/button";
import { Checkbox, Field, Input, Select } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import { cn } from "@/lib/cn";
import type { InputMode } from "@/lib/radio/voice";
import type { SharedProps } from "@/types";
import { LevelMeter } from "./level-meter";
import type { ConsoleApi } from "./use-console";

const INPUTS: { value: InputMode; label: string; hint: string; icon: ReactNode }[] = [
  { value: "mic", label: "Micrófono", hint: "Tu voz, con ecualizador y compresor", icon: <Mic className="size-4" /> },
  { value: "line", label: "Entrada de línea", hint: "Controlador o mezcladora DJ por cable, en estéreo", icon: <Cable className="size-4" /> },
  { value: "none", label: "Solo consola DJ", hint: "Sin micrófono: sale la mezcla de los decks", icon: <Disc3 className="size-4" /> },
];

/**
 * The live transmission of this console: open it with the host and program names, choose the
 * input (microphone, line input from a DJ setup by cable, or the DJ decks alone), talk on air,
 * the input chain and the recording of the transmission.
 */
export function LivePanel({ api }: { api: ConsoleApi }) {
  const { snapshot, mic } = api;
  const { auth } = usePage<SharedProps>().props;
  const session = snapshot.live.session;
  const mine = session !== null && snapshot.live.host_id === auth.user?.id;
  const external = snapshot.config.live_source === "external";
  const line = mic.input === "line";
  const [record, setRecord] = useState(!external);

  return (
    <Panel
      dense
      title="Transmisión en vivo"
      description={session ? "Estás al aire. La voz llega a cada oyente por una conexión directa." : "Abre la transmisión para hablar al aire con tu micrófono."}
      actions={api.capturing ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger"><Circle className="size-2.5 animate-pulse fill-current" /> Grabando</span> : null}
    >
      <div className="space-y-3">
        <div className="grid gap-2 @xs:grid-cols-2">
          <Field label="Locutor">{(id) => <Input id={id} value={api.hostName} maxLength={80} onChange={(event) => api.setHostName(event.target.value)} onBlur={() => session && void api.saveTitles()} />}</Field>
          <Field label="Programa">
            {(id) => <Input id={id} value={api.title} maxLength={120} placeholder="Por ejemplo «Mañanas al día»" onChange={(event) => api.setTitle(event.target.value)} onBlur={() => session && void api.saveTitles()} />}
          </Field>
        </div>

        <div role="radiogroup" aria-label="Entrada de la consola" className="grid gap-1.5 @lg:grid-cols-3">
          {INPUTS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={mic.input === option.value}
              onClick={() => api.changeMic({ input: option.value })}
              title={option.hint}
              className={cn(
                "flex min-w-0 items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition",
                mic.input === option.value ? "border-signal/50 bg-signal-soft text-ink" : "border-line bg-raised text-muted hover:text-ink",
              )}
            >
              <span className="mt-0.5 shrink-0">{option.icon}</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold break-words">{option.label}</span>
                <span className="block text-[11px] leading-snug break-words text-muted">{option.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {session ? (
          <div className="flex flex-wrap items-center gap-2">
            {mic.input !== "none" ? (
              <Button
                variant={api.talking ? "danger" : "primary"}
                icon={api.talking ? <Mic className="size-5" /> : <MicOff className="size-5" />}
                onClick={() => void api.talk(!api.talking)}
                disabled={!api.micOpen || !mine}
                aria-pressed={api.talking}
              >
                {line ? (api.talking ? "Línea al aire" : "Abrir línea") : api.talking ? (api.speaking ? "Al aire · hablando" : "Al aire") : "Hablar"}
              </Button>
            ) : null}
            {mine && !api.micOpen ? (
              <Button variant="secondary" onClick={() => void api.openMic()}>
                {line ? "Activar entrada de línea" : mic.input === "none" ? "Activar la consola" : "Activar micrófono"}
              </Button>
            ) : null}
            <Button variant="ghost" icon={<Square className="size-4" />} onClick={() => void api.stopLive()} loading={api.busy} className="ml-auto">
              Terminar transmisión
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button variant="signal" icon={<Radio className="size-4" />} loading={api.busy} onClick={() => void api.startLive(record && !external)}>
              Abrir transmisión en vivo
            </Button>
            <Checkbox label="Grabar la transmisión" checked={record && !external} disabled={external} onChange={(event) => setRecord(event.target.checked)} />
          </div>
        )}
        {session && !mine ? <p className="text-xs text-warning">La transmisión la conduce {snapshot.live.host || "otro locutor"} desde otra consola: solo su micrófono sale al aire.</p> : null}
        {external ? <p className="text-xs text-muted">La fuente del vivo es una señal externa (OBS, Icecast): esta consola no graba ese audio.</p> : null}

        {mic.input !== "none" ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{line ? "Nivel de la línea" : "Nivel del micrófono"}</span>
                <span className="tabular">{Math.round(mic.level * 100)}%</span>
              </div>
              <input type="range" min={0} max={2} step={0.05} value={mic.level} onChange={(event) => api.changeMic({ level: Number(event.target.value) })} className="w-full accent-signal" aria-label={line ? "Nivel de la línea" : "Nivel del micrófono"} />
              <LevelMeter analyser={api.micOpen ? (api.caster.current?.analyser ?? null) : null} label={line ? "Señal de la línea" : "Señal del micrófono"} />
            </div>

            <div className="grid gap-2 @xs:grid-cols-2">
              {api.devices.length > 1 ? (
                <Field label={line ? "Entrada de la mezcladora o interfaz" : "Micrófono"} className="@xs:col-span-2">
                  {(id) => (
                    <Select id={id} value={mic.deviceId} onChange={(event) => api.changeMic({ deviceId: event.target.value })}>
                      <option value="">Predeterminado del sistema</option>
                      {api.devices.map((device, index) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Entrada ${index + 1}`}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ) : null}
              {line ? null : <Checkbox label="Detectar voz (baja la música al hablar)" checked={mic.voiceDuck} onChange={(event) => api.changeMic({ voiceDuck: event.target.checked })} />}
              {line ? null : <Checkbox label="Música de fondo al hablar" checked={mic.autoBed} onChange={(event) => api.changeMic({ autoBed: event.target.checked })} />}
              <Checkbox label={line ? "Abrir la línea al iniciar" : "Hablar al abrir la transmisión"} checked={mic.talkOnStart} onChange={(event) => api.changeMic({ talkOnStart: event.target.checked })} />
              {line ? null : <Checkbox label="Reducir eco y ruido" checked={mic.processing} onChange={(event) => api.changeMic({ processing: event.target.checked })} />}
              <Checkbox label={line ? "Escuchar la línea" : "Escuchar mi micrófono"} checked={mic.selfMonitor} onChange={(event) => api.changeMic({ selfMonitor: event.target.checked })} />
            </div>
            {line ? (
              <p className="text-xs text-muted">
                Conecta la salida master de tu controlador o mezcladora a la entrada de línea de la computadora (o usa la tarjeta de sonido del controlador). Sale tal cual, en estéreo y sin
                procesamiento de voz. Corta la música automática para que solo se oiga tu mezcla.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-muted">Sin micrófono: a los oyentes les llega solo la mezcla de la consola DJ cuando la pones al aire.</p>
        )}
      </div>
    </Panel>
  );
}
