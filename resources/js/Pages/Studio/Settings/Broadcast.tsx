import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { RadioHeader } from "@/Components/studio/radio-header";
import { ChoiceCards } from "@/Components/studio/settings/choice-cards";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select, Switch } from "@/Components/ui/field";
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
  maxVoice: number;
}

/** Upload each listener of the live microphone takes, in kbps. */
const VOICE_KBPS = 64;

const MODE_TEXT: Record<LiveMode, string> = {
  auto: "A la hora de un bloque en vivo, en cuanto te conectas desde la consola la música se corta sola; al terminar el bloque (o si te desconectas) vuelve sola. Si nadie se conecta, sigue la música automática.",
  manual: "La música solo se corta con «Cortar música · ir al vivo» y vuelve con «Volver a la música», desde la consola.",
};

const SOURCE_TEXT: Record<LiveSource, string> = {
  console: "Hablas desde la consola del estudio con tu micrófono; tu voz llega directo a cada oyente.",
  external: "Transmites con OBS, BUTT, Mixxx o tu servidor (Icecast, Shoutcast, Zeno.fm…). Los oyentes escuchan esa señal mientras dure el vivo.",
};

export default function BroadcastSettings({ settings, liveModes, liveSources, bitrates, maxVoice }: Props) {
  const url = useStudioUrl();
  const form = useForm<Settings>({ ...settings, live_url: settings.live_url ?? "", stream_url: settings.stream_url ?? "" });
  const external = form.data.live_source === "external";
  const upload = ((form.data.max_voice || 0) * VOICE_KBPS) / 1000;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/configuracion/transmision"), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Transmisión">
      <div className="space-y-6">
        <RadioHeader title="Transmisión" description="Cuándo está al aire tu radio, qué ven tus oyentes y cómo entra la transmisión en vivo." />

        <form onSubmit={submit} className="max-w-4xl space-y-6">
          <Panel title="Al aire">
            <div className="space-y-5">
              <Switch checked={form.data.on_air} onChange={(value) => form.setData("on_air", value)} label="Radio al aire" description="Si la apagas, tus oyentes ven la radio «Fuera del aire» y no suena nada. Al abrir una transmisión en vivo se enciende sola." />
              <Switch
                checked={form.data.show_titles}
                onChange={(value) => form.setData("show_titles", value)}
                label="Mostrar la canción que suena"
                description="Los oyentes ven el nombre y el artista de cada canción en el reproductor y en «A continuación». Si lo apagas, solo ven que suena música; los programas, anuncios y el locutor se siguen mostrando."
              />
            </div>
          </Panel>

          <Panel title="En vivo" description="Cómo la música automática le da paso al locutor y cómo vuelve.">
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <ChoiceCards
                  legend="Interruptor"
                  name="live_mode"
                  value={form.data.live_mode}
                  choices={liveModes.map((mode) => ({ value: mode.value, title: mode.label, description: MODE_TEXT[mode.value] }))}
                  onChange={(value) => form.setData("live_mode", value)}
                />
                <div className="space-y-3">
                  <ChoiceCards
                    legend="¿Desde dónde sale el vivo?"
                    name="live_source"
                    value={form.data.live_source}
                    choices={liveSources.map((source) => ({ value: source.value, title: source.label, description: SOURCE_TEXT[source.value] }))}
                    onChange={(value) => form.setData("live_source", value)}
                  />
                  {external ? (
                    <Field
                      label="Enlace de la señal en vivo"
                      hint="El «mount» público de tu servidor: mientras OBS transmite, la música se corta; cuando deja de transmitir, vuelve. Debe ser https para que los navegadores lo reproduzcan."
                      error={form.errors.live_url}
                    >
                      {(id, invalid) => <Input id={id} invalid={invalid} type="url" value={form.data.live_url} maxLength={500} placeholder="https://stream.ejemplo.com/vivo" onChange={(event) => form.setData("live_url", event.target.value)} />}
                    </Field>
                  ) : null}
                  {form.errors.live_source && <p className="text-xs text-danger">{form.errors.live_source}</p>}
                  {form.errors.live_mode && <p className="text-xs text-danger">{form.errors.live_mode}</p>}
                </div>
              </div>
              <Field
                label="Oyentes con el micrófono en vivo (máximo)"
                hint={`Tu voz sale directo de la consola a cada oyente y consume la subida de tu internet: unos ${VOICE_KBPS} kbps por oyente (${form.data.max_voice || 0} oyentes ≈ ${upload.toLocaleString("es-PE", { maximumFractionDigits: 1 })} Mbps). Los demás siguen escuchando la programación. Ajústalo según tu conexión.`}
                error={form.errors.max_voice}
              >
                {(id, invalid) => <Input id={id} invalid={invalid} type="number" min={1} max={maxVoice} value={form.data.max_voice} onChange={(event) => form.setData("max_voice", Number(event.target.value))} className="max-w-32" />}
              </Field>
            </div>
          </Panel>

          <Panel
            title="Calidad y transmisión externa"
            footer={
              <Button type="submit" loading={form.processing} disabled={!form.isDirty}>
                Guardar cambios
              </Button>
            }
          >
            <div className="space-y-5">
              <Field label="Calidad de audio" hint="64 kbps es un buen equilibrio entre sonido y datos móviles; sube la calidad si tus oyentes tienen buena conexión." error={form.errors.bitrate_kbps}>
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
              <Field
                label="Transmisión externa permanente (opcional)"
                hint="Para audiencias grandes: si emites por un servidor de streaming (Icecast, Shoutcast, Radio.co, Zeno.fm…), pega aquí el enlace https del audio y los oyentes lo escuchan en lugar de la programación. Déjalo vacío para usar la radio integrada."
                error={form.errors.stream_url}
              >
                {(id, invalid) => <Input id={id} invalid={invalid} type="url" value={form.data.stream_url} maxLength={500} placeholder="https://stream.ejemplo.com/radio.mp3" onChange={(event) => form.setData("stream_url", event.target.value)} />}
              </Field>
            </div>
          </Panel>
        </form>
      </div>
    </StudioLayout>
  );
}
