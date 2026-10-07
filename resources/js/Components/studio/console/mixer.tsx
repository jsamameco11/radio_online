import { useEffect, useRef, useState } from "react";
import { Panel } from "@/Components/ui/panel";
import { Switch } from "@/Components/ui/field";
import type { ConsoleApi } from "./use-console";

type FaderKey = "music" | "overlay" | "pads";

const FADERS: { key: FaderKey; label: string; hint: string }[] = [
  { key: "music", label: "Música", hint: "La programación y la música automática" },
  { key: "overlay", label: "Capas", hint: "Reproductores, fondos y bloques superpuestos" },
  { key: "pads", label: "Botonera", hint: "Efectos y jingles de la botonera" },
];

/** Console faders: every listener applies them at once (the change travels over the live link too). */
export function Mixer({ api }: { api: ConsoleApi }) {
  const { live } = api.snapshot;
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

  return (
    <Panel title="Mezcla" description="Lo que oyen todos los oyentes.">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {FADERS.map((fader) => (
            <label key={fader.key} className="flex flex-col items-center gap-2 text-center" title={fader.hint}>
              <span className="font-mono text-xs text-muted tabular">{levels[fader.key]}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={levels[fader.key]}
                onChange={(event) => move(fader.key, Number(event.target.value))}
                className="h-32 w-6 accent-signal [writing-mode:vertical-lr] [direction:rtl]"
                aria-label={`Volumen de ${fader.label.toLowerCase()}`}
              />
              <span className="text-xs font-medium text-ink">{fader.label}</span>
            </label>
          ))}
        </div>
        <Switch checked={live.muted} onChange={(muted) => void api.mix({ muted })} label="Silenciar música" description="La música calla para todos; las capas y la voz siguen." />
        <Switch checked={live.bed} onChange={(bed) => void api.mix({ bed })} label="Música de fondo" description="La música baja al nivel de fondo configurado." />
        <div className="space-y-1.5 border-t border-line pt-3">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Empalme de la consola</span>
            <span className="tabular">{api.blend} s</span>
          </div>
          <input type="range" min={0} max={12} step={0.5} value={api.blend} onChange={(event) => api.setBlend(Number(event.target.value))} className="w-full accent-signal" aria-label="Segundos del empalme" />
          {api.monitor ? (
            <>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Volumen del monitor</span>
                <span className="tabular">{Math.round(api.monitorLevel * 100)}%</span>
              </div>
              <input type="range" min={0} max={1} step={0.05} value={api.monitorLevel} onChange={(event) => api.changeMonitorLevel(Number(event.target.value))} className="w-full accent-signal" aria-label="Volumen del monitor" />
            </>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
