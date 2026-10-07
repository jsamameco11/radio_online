import { Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/Components/ui/button";
import { Checkbox, Select } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import type { DjEngine } from "@/lib/dj/engine";
import type { ConsoleApi } from "../console/use-console";

const canChooseOutput = typeof AudioContext !== "undefined" && "setSinkId" in AudioContext.prototype;

interface AirBarProps {
  engine: DjEngine;
  api: ConsoleApi;
  onAir: boolean;
  /** The live link of this user is open, with any input. */
  canAir: boolean;
  onNotice: (text: string) => void;
}

/** Whether the mix is on air or only in the headphones, where the headphones sound, and the air switch. */
export function AirBar({ engine, api, onAir, canAir, onNotice }: AirBarProps) {
  const [cutOnAir, setCutOnAir] = useState(true);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [output, setOutput] = useState("");

  useEffect(() => {
    if (!canChooseOutput) return;
    void navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => setOutputs(devices.filter((device) => device.kind === "audiooutput")))
      .catch(() => undefined);
  }, [api.micOpen]);

  async function toggleAir() {
    if (onAir) {
      engine.setOnAir(false);
      return;
    }
    engine.setOnAir(true);
    if (cutOnAir && !api.snapshot.radio.live.cut) await api.cutMusic();
  }

  async function chooseOutput(deviceId: string) {
    setOutput(deviceId);
    if (!(await engine.setOutput(deviceId))) onNotice("El navegador no permitió cambiar la salida de los auriculares.");
  }

  return (
    <div className="space-y-1.5">
      <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3", onAir ? "border-onair/50 bg-onair-soft" : "border-line bg-raised")}>
        <span className={cn("inline-flex items-center gap-2 text-sm font-semibold", onAir ? "text-onair" : "text-muted")}>
          <span className={cn("size-2.5 rounded-full", onAir ? "animate-onair bg-onair" : "bg-faint")} />
          {onAir ? "La mezcla está al aire" : "Pre-escucha: la mezcla solo suena en tus auriculares"}
        </span>
        <Checkbox label="Cortar la música automática al salir al aire" checked={cutOnAir} onChange={(event) => setCutOnAir(event.target.checked)} className="text-xs" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canChooseOutput && outputs.length > 1 ? (
            <Select value={output} onChange={(event) => void chooseOutput(event.target.value)} className="h-9 w-56 text-xs" aria-label="Salida de los auriculares">
              <option value="">Auriculares: salida del sistema</option>
              {outputs.map((device, index) => (
                <option key={device.deviceId || index} value={device.deviceId}>
                  {device.label || `Salida ${index + 1}`}
                </option>
              ))}
            </Select>
          ) : null}
          <Button
            variant={onAir ? "danger" : "signal"}
            icon={<Radio className="size-4" />}
            disabled={!onAir && !canAir}
            title={canAir ? undefined : "Abre la transmisión en vivo (con cualquier entrada) para poner la mezcla al aire"}
            onClick={() => void toggleAir()}
          >
            {onAir ? "Quitar la mezcla del aire" : "Poner la mezcla al aire"}
          </Button>
        </div>
      </div>
      {!canAir && !onAir ? <p className="text-xs text-muted">Para salir al aire abre la transmisión en vivo arriba. Si no usarás micrófono, elige la entrada «Solo consola DJ».</p> : null}
    </div>
  );
}
