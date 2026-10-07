import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { Button } from "@/Components/ui/button";
import { Field } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";

interface Settings {
  crossfade: number;
  bed_level: number;
  fx_level: number;
  duck_level: number;
}

const LEVELS: { key: Exclude<keyof Settings, "crossfade">; label: string; hint: string }[] = [
  { key: "bed_level", label: "Música de fondo", hint: "Volumen de la música automática mientras hablas en un bloque en vivo." },
  { key: "fx_level", label: "Efectos y capas", hint: "Volumen de la botonera y de las capas que suenan encima de la programación." },
  { key: "duck_level", label: "Música bajo las voces", hint: "A cuánto baja la música cuando suena un anuncio o un audio que la atenúa." },
];

function Slider({ id, value, min, max, step, suffix, invalid, onChange }: { id: string; value: number; min: number; max: number; step: number; suffix: string; invalid: boolean; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-4">
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-invalid={invalid || undefined} onChange={(event) => onChange(Number(event.target.value))} className="w-full max-w-md accent-signal" />
      <span className="w-16 text-right font-mono text-sm tabular">
        {value}
        {suffix}
      </span>
    </div>
  );
}

export default function AudioSettings({ settings, maxFade }: { settings: Settings; maxFade: number }) {
  const url = useStudioUrl();
  const form = useForm<Settings>(settings);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/configuracion/audio"), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Audio">
      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <PageHeader eyebrow="Configuración" title="Audio" description="Cómo se mezclan las canciones, la música de fondo y los efectos para tus oyentes." />

        <Panel
          title="Mezcla"
          footer={
            <Button type="submit" loading={form.processing} disabled={!form.isDirty}>
              Guardar cambios
            </Button>
          }
        >
          <div className="space-y-6">
            <Field label="Fundido entre canciones" hint="Segundos en los que una canción se funde con la siguiente. En 0, una empieza cuando termina la otra." error={form.errors.crossfade}>
              {(id, invalid) => <Slider id={id} invalid={invalid} min={0} max={maxFade} step={0.5} suffix=" s" value={form.data.crossfade} onChange={(value) => form.setData("crossfade", value)} />}
            </Field>
            {LEVELS.map((level) => (
              <Field key={level.key} label={level.label} hint={level.hint} error={form.errors[level.key]}>
                {(id, invalid) => <Slider id={id} invalid={invalid} min={0} max={100} step={1} suffix="%" value={form.data[level.key]} onChange={(value) => form.setData(level.key, value)} />}
              </Field>
            ))}
          </div>
        </Panel>
      </form>
    </StudioLayout>
  );
}
