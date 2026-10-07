import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select, Switch } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import type { LiveMode, LiveSource, Option } from "@/types/studio";

interface Settings {
  on_air: boolean;
  show_titles: boolean;
  live_mode: LiveMode;
  live_source: LiveSource;
  live_url: string;
  max_voice: number;
  stream_url: string;
  bitrate_kbps: number;
}

interface Props {
  settings: Settings;
  liveModes: Option<LiveMode>[];
  liveSources: Option<LiveSource>[];
  bitrates: number[];
}

export default function BroadcastSettings({ settings, liveModes, liveSources, bitrates }: Props) {
  const url = useStudioUrl();
  const form = useForm<Settings>({ ...settings, live_url: settings.live_url ?? "", stream_url: settings.stream_url ?? "" });
  const external = form.data.live_source === "external";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/configuracion/transmision"), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Transmisión">
      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <PageHeader eyebrow="Configuración" title="Transmisión" description="Cuándo está al aire tu radio, qué ven tus oyentes y cómo entra la transmisión en vivo." />

        <Panel title="Al aire">
          <div className="space-y-5">
            <Switch checked={form.data.on_air} onChange={(value) => form.setData("on_air", value)} label="Radio al aire" description="Apagada, tus oyentes ven la radio fuera del aire y no suena nada." />
            <Switch checked={form.data.show_titles} onChange={(value) => form.setData("show_titles", value)} label="Mostrar el nombre de las canciones" description="Si lo apagas, los oyentes solo ven el nombre de la radio y del programa." />
          </div>
        </Panel>

        <Panel title="En vivo" description="Cómo entra tu voz cuando sales al aire desde la consola o con una señal externa.">
          <div className="space-y-5">
            <Field label="Al empezar una transmisión" error={form.errors.live_mode}>
              {(id, invalid) => (
                <Select id={id} invalid={invalid} value={form.data.live_mode} onChange={(event) => form.setData("live_mode", event.target.value as LiveMode)} className="max-w-sm">
                  {liveModes.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Fuente del vivo" error={form.errors.live_source}>
              {(id, invalid) => (
                <Select id={id} invalid={invalid} value={form.data.live_source} onChange={(event) => form.setData("live_source", event.target.value as LiveSource)} className="max-w-sm">
                  {liveSources.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {external ? (
              <Field label="Enlace de la señal externa" hint="El enlace público de tu OBS, Icecast o Shoutcast. Los oyentes lo escuchan mientras estás en vivo." error={form.errors.live_url}>
                {(id, invalid) => <Input id={id} invalid={invalid} type="url" value={form.data.live_url} placeholder="https://" onChange={(event) => form.setData("live_url", event.target.value)} />}
              </Field>
            ) : null}
            <Field label="Oyentes con el micrófono en vivo" hint="Cuántos oyentes reciben tu voz directa a la vez; el resto sigue escuchando la programación." error={form.errors.max_voice}>
              {(id, invalid) => <Input id={id} invalid={invalid} type="number" min={1} max={500} value={form.data.max_voice} onChange={(event) => form.setData("max_voice", Number(event.target.value))} className="max-w-32" />}
            </Field>
          </div>
        </Panel>

        <Panel
          title="Calidad y señal externa"
          footer={
            <Button type="submit" loading={form.processing} disabled={!form.isDirty}>
              Guardar cambios
            </Button>
          }
        >
          <div className="space-y-5">
            <Field label="Calidad de audio" error={form.errors.bitrate_kbps}>
              {(id, invalid) => (
                <Select id={id} invalid={invalid} value={form.data.bitrate_kbps} onChange={(event) => form.setData("bitrate_kbps", Number(event.target.value))} className="max-w-xs">
                  {bitrates.map((kbps) => (
                    <option key={kbps} value={kbps}>
                      {kbps} kbps
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Transmisión externa permanente (opcional)" hint="Si tu radio ya emite por un servidor propio, los oyentes escuchan ese enlace en lugar de la programación." error={form.errors.stream_url}>
              {(id, invalid) => <Input id={id} invalid={invalid} type="url" value={form.data.stream_url} placeholder="https://" onChange={(event) => form.setData("stream_url", event.target.value)} />}
            </Field>
          </div>
        </Panel>
      </form>
    </StudioLayout>
  );
}
