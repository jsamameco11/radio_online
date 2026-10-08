import { Mic, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Panel } from "@/Components/ui/panel";
import { Switch } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import { LevelMeter } from "./level-meter";
import type { ConsoleApi } from "./use-console";

type FaderKey = "music" | "overlay" | "pads";

const FADERS: { key: FaderKey; label: string; hint: string }[] = [
  { key: "music", label: "Música", hint: "La programación y la música automática" },
  { key: "overlay", label: "Capas", hint: "Reproductores, fondos y bloques superpuestos" },
  { key: "pads", label: "Botonera", hint: "Efectos y jingles de la botonera" },
];

/** Console faders: every listener applies them at once (the change travels over the live link too). */
export function Mixer({ api }: { api: ConsoleApi }) {
  const { live, config } = api.snapshot;
  const { mic } = api;
  const [levels, setLevels] = useState<Record<FaderKey, number>>({ music: live.music, overlay: live.overlay, pads: live.pads });
  const dragging = useRef(false);
  const timer = useRef(0);

  useEffect(() => {
    if (!dragging.current) setLevels({ music: live.music, overlay: live.overlay, pads: live.pads });
  }, [live.music, live.overlay, live.pads]);

  function move(key: FaderKey, value: number) {
    dragging.current = true;
    setLevels((current) => ({ ...current, [key]: value }));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await api.mix({ [key]: value });
      dragging.current = false;
    }, 120);
  }

  const micPercent = Math.round(api.mic.level * 100);
  const monitorPercent = Math.round(api.monitorLevel * 100);
  const canTalk = Boolean(api.snapshot.live.session) && api.mic.input !== "none";

  return (
    <Panel dense title="Mezclador" description="Lo que oyen todos, tu micrófono y el monitor de cabina.">
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-1 rounded-lg bg-canvas/60 px-1.5 py-2">
          <label className="flex flex-col items-center gap-1.5 text-center" title="Nivel de tu micrófono o de la línea">
            <Mic className={cn("size-3.5", api.talking ? "text-signal" : "text-muted")} />
            <span className="flex items-stretch gap-1">
              <input
                type="range"
                min={0}
                max={200}
                value={micPercent}
                disabled={api.mic.input === "none"}
                onChange={(event) => api.changeMic({ level: Number(event.target.value) / 100 })}
                className="desk-fader"
                aria-label="Volumen del micrófono"
              />
              <LevelMeter vertical analyser={api.micOpen ? (api.caster.current?.analyser ?? null) : null} label="Señal del micrófono" />
            </span>
            <span className="text-[10px] font-semibold tracking-wide text-faint uppercase">Mic</span>
            <span className="font-mono text-[10px] text-muted tabular">{micPercent}%</span>
          </label>
          {FADERS.map((fader) => (
            <label key={fader.key} className="flex flex-col items-center gap-1.5 text-center" title={fader.hint}>
              <span className="size-3.5" />
              <input
                type="range"
                min={0}
                max={100}
                value={levels[fader.key]}
                onChange={(event) => move(fader.key, Number(event.target.value))}
                className="desk-fader"
                aria-label={`Volumen de ${fader.label.toLowerCase()}`}
              />
              <span className="text-[10px] font-semibold tracking-wide text-faint uppercase">{fader.label}</span>
              <span className="font-mono text-[10px] text-muted tabular">{levels[fader.key]}%</span>
            </label>
          ))}
          <label className="flex flex-col items-center gap-1.5 text-center" title="Lo que escuchas tú en esta computadora">
            <Volume2 className={cn("size-3.5", api.monitor ? "text-royal" : "text-muted")} />
            <span className="flex items-stretch gap-1">
              <input
                type="range"
                min={0}
                max={100}
                value={monitorPercent}
                onChange={(event) => api.changeMonitorLevel(Number(event.target.value) / 100)}
                className="desk-fader"
                aria-label="Volumen del monitor"
              />
              <LevelMeter vertical analyser={api.monitor ? (api.player.current?.analyser ?? null) : null} label="Señal del monitor" />
            </span>
            <span className="text-[10px] font-semibold tracking-wide text-faint uppercase">Monitor</span>
            <span className="font-mono text-[10px] text-muted tabular">{monitorPercent}%</span>
          </label>
        </div>
        {canTalk ? (
          <button
            type="button"
            onClick={() => void api.talk(!api.talking)}
            disabled={!api.micOpen}
            aria-pressed={api.talking}
            className={cn("h-8 w-full rounded-lg text-xs font-semibold", api.talking ? "bg-danger text-white" : "bg-onair text-white")}
          >
            {api.talking ? (api.speaking ? "Al aire · hablando" : "Micrófono al aire") : "Hablar"}
          </button>
        ) : null}
        {api.mic.input === "mic" ? (
          <div className="grid grid-cols-3 gap-1" role="group" aria-label="Micrófono">
            <MicToggle on={mic.voiceDuck} onClick={() => api.changeMic({ voiceDuck: !mic.voiceDuck })} title="La música baja sola mientras se oye tu voz">
              Detectar voz
            </MicToggle>
            <MicToggle on={mic.autoBed} onClick={() => api.changeMic({ autoBed: !mic.autoBed })} title="Con el micrófono abierto la música queda de fondo">
              Auto fondo
            </MicToggle>
            <MicToggle on={mic.selfMonitor} onClick={() => api.changeMic({ selfMonitor: !mic.selfMonitor })} title="Te escuchas en los audífonos (usa audífonos para evitar acoples)">
              Retorno
            </MicToggle>
          </div>
        ) : null}
        <Switch checked={live.muted} onChange={(muted) => void api.mix({ muted })} label="Silenciar música" description="La música calla para todos; las capas y la voz siguen." />
        <Switch checked={live.bed} onChange={(bed) => void api.mix({ bed })} label="Música de fondo" description={`La música baja al ${config.bed_level}% (nivel de fondo de Ajustes).`} />
        <p className="text-[11px] break-words text-faint">Capas y botonera suenan como máximo al {config.fx_level}% de su volumen, según los Ajustes de la radio.</p>
        <div className="space-y-1.5 border-t border-line pt-3">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Empalme de la consola</span>
            <span className="tabular">{api.blend} s</span>
          </div>
          <input type="range" min={0} max={12} step={0.5} value={api.blend} onChange={(event) => api.setBlend(Number(event.target.value))} className="desk-slider w-full" aria-label="Segundos del empalme" />
        </div>
      </div>
    </Panel>
  );
}

function MicToggle({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} title={title} className={cn("h-7 min-w-0 truncate rounded-md border px-1 text-[10px] font-semibold", on ? "border-signal/40 bg-signal-soft text-signal" : "border-line bg-surface text-muted hover:text-ink")}>
      {children}
    </button>
  );
}
