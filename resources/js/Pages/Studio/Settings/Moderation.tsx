import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { fieldError } from "@/Components/forms/field-error";
import { RadioHeader } from "@/Components/studio/radio-header";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";

interface Settings {
  blocked_words: string[];
  slow_mode_seconds: number;
  block_links: boolean;
  auto_hide_reported: boolean;
  auto_hide_threshold: number;
  notify_team_on_report: boolean;
}

export default function ModerationSettings({ settings, slowModeOptions }: { settings: Settings; slowModeOptions: number[] }) {
  const url = useStudioUrl();
  const form = useForm({ ...settings, words: settings.blocked_words.join("\n") });

  form.transform(({ words, ...data }) => ({
    ...data,
    blocked_words: words
      .split(/[\n,]/)
      .map((word) => word.trim())
      .filter(Boolean),
  }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/configuracion/moderacion"), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Moderación">
      <div className="space-y-6">
        <RadioHeader title="Moderación" description="Reglas para los mensajes y la participación de tus oyentes." />
        <form onSubmit={submit} className="max-w-3xl space-y-6">
          <Panel
            title="Reglas"
            footer={
              <Button type="submit" loading={form.processing} disabled={!form.isDirty}>
                Guardar cambios
              </Button>
            }
          >
            <div className="space-y-5">
              <Field label="Palabras bloqueadas" hint="Una por línea. Los mensajes que las contengan se ocultan." error={fieldError(form.errors, "blocked_words")}>
                {(id, invalid) => <Textarea id={id} invalid={invalid} rows={5} value={form.data.words} onChange={(event) => form.setData("words", event.target.value)} />}
              </Field>
              <Field label="Modo lento" hint="Tiempo mínimo entre dos mensajes de un mismo oyente." error={form.errors.slow_mode_seconds}>
                {(id, invalid) => (
                  <Select id={id} invalid={invalid} value={form.data.slow_mode_seconds} onChange={(event) => form.setData("slow_mode_seconds", Number(event.target.value))} className="max-w-xs">
                    {slowModeOptions.map((seconds) => (
                      <option key={seconds} value={seconds}>
                        {seconds === 0 ? "Desactivado" : seconds < 60 ? `${seconds} segundos` : `${seconds / 60} min`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Switch checked={form.data.block_links} onChange={(value) => form.setData("block_links", value)} label="Bloquear enlaces" description="Los mensajes con enlaces no se publican." />
              <Switch checked={form.data.auto_hide_reported} onChange={(value) => form.setData("auto_hide_reported", value)} label="Ocultar contenido muy reportado" description="Se oculta hasta que lo revises." />
              {form.data.auto_hide_reported && (
                <Field label="Reportes para ocultar" error={form.errors.auto_hide_threshold}>
                  {(id, invalid) => (
                    <Input id={id} invalid={invalid} type="number" min={1} max={20} value={form.data.auto_hide_threshold} onChange={(event) => form.setData("auto_hide_threshold", Number(event.target.value))} className="max-w-24" />
                  )}
                </Field>
              )}
              <Switch checked={form.data.notify_team_on_report} onChange={(value) => form.setData("notify_team_on_report", value)} label="Avisar al equipo de cada reporte" />
            </div>
          </Panel>
        </form>
      </div>
    </StudioLayout>
  );
}
