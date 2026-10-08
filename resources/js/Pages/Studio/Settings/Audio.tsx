import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { RadioHeader } from "@/Components/studio/radio-header";
import { Button } from "@/Components/ui/button";
import { Field } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";

interface Settings {
  crossfade: number;
  bed_level: number;
  fx_level: number;
  duck_level: number;
}

type Level = Exclude<keyof Settings, "crossfade">;

const LEVELS: { key: Level; label: string; hint: string }[] = [
  { key: "bed_level", label: "Volumen de la música de fondo", hint: "Cuánto baja la música al ponerla «De fondo» o durante un bloque en vivo con fondo. Recomendado: 18–28 %." },
  { key: "duck_level", label: "Música bajo anuncios y capas", hint: "A qué nivel queda la música mientras suena un audio que «baja la música» (anuncios, programas, capas y reproductores). Recomendado: 20–35 %." },
  { key: "fx_level", label: "Volumen general de efectos y capas", hint: "Tope de la botonera, los reproductores simultáneos y las capas programadas. Recomendado: 80–100 %." },
];

function Slider({ id, value, min, max, step, suffix, invalid, onChange }: { id: string; value: number; min: number; max: number; step: number; suffix: string; invalid: boolean; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-10 text-right font-mono text-xs text-faint tabular">{min}</span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-invalid={invalid || undefined} onChange={(event) => onChange(Number(event.target.value))} className="w-full max-w-md accent-signal" />
      <span className="w-10 font-mono text-xs text-faint tabular">{max}</span>
      <span className="w-16 rounded-lg bg-raised px-2 py-1 text-right font-mono text-sm text-ink tabular">
        {value}
        {suffix}
      </span>
    </div>
  );
}

export default function AudioSettings({ settings, maxFade, ranges }: { settings: Settings; maxFade: number; ranges: Record<Level, [number, number]> }) {
  const url = useStudioUrl();
  const form = useForm<Settings>(settings);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/configuracion/audio"), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Audio">
      <div className="space-y-6">
        <RadioHeader title="Audio" description="Cómo se mezclan las canciones, la música de fondo y los efectos para tus oyentes. Son los niveles que escuchan todos." />

        <form onSubmit={submit} className="max-w-4xl space-y-6">
          <Panel
            title="Mezcla"
            description="Los valores fuera de rango no se pueden guardar: debajo del mínimo la música no se oye, encima del máximo tapa la voz."
            footer={
              <Button type="submit" loading={form.processing} disabled={!form.isDirty}>
                Guardar cambios
              </Button>
            }
          >
            <div className="space-y-7">
              <Field label="Empalme entre canciones" hint="Segundos en que una canción de la música automática se funde con la siguiente. 0 = sin fundido. Recomendado: 3–5 s." error={form.errors.crossfade}>
                {(id, invalid) => <Slider id={id} invalid={invalid} min={0} max={maxFade} step={0.5} suffix=" s" value={form.data.crossfade} onChange={(value) => form.setData("crossfade", value)} />}
              </Field>
              {LEVELS.map((level) => (
                <Field key={level.key} label={level.label} hint={level.hint} error={form.errors[level.key]}>
                  {(id, invalid) => <Slider id={id} invalid={invalid} min={ranges[level.key][0]} max={ranges[level.key][1]} step={1} suffix="%" value={form.data[level.key]} onChange={(value) => form.setData(level.key, value)} />}
                </Field>
              ))}
            </div>
          </Panel>
        </form>
      </div>
    </StudioLayout>
  );
}
