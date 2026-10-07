import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { FallbackNotice, SourcePicker } from "@/Components/studio/console/source-picker";
import { Button } from "@/Components/ui/button";
import { Field, Switch } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import type { Autopilot, BroadcastPlaylist } from "@/types/studio";

interface Settings {
  autofill: boolean;
  playlist: string | null;
  shuffle: boolean;
  repeat: boolean;
}

export default function AutomationSettings({ settings, autopilot, playlists }: { settings: Settings; autopilot: Autopilot; playlists: BroadcastPlaylist[] }) {
  const url = useStudioUrl();
  const form = useForm<Settings>(settings);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/configuracion/automatizacion"), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Automatización">
      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <PageHeader eyebrow="Configuración" title="Automatización" description="La música automática llena los espacios sin programación y los bloques en vivo sin nadie al aire." />

        <FallbackNotice autopilot={autopilot} />

        <Panel
          title="Música automática"
          description={`Ahora suena: ${autopilot.label}.`}
          footer={
            <Button type="submit" loading={form.processing} disabled={!form.isDirty}>
              Guardar cambios
            </Button>
          }
        >
          <div className="space-y-5">
            <Switch checked={form.data.autofill} onChange={(value) => form.setData("autofill", value)} label="Llenar los espacios libres" description="Apagada, solo suena lo programado y lo demás queda en silencio." />
            <Field label="Qué suena" hint="Un cambio de música entra cuando termina la canción que está al aire, sin cortes." error={form.errors.playlist ?? form.errors.shuffle}>
              {() => (
                <SourcePicker
                  playlists={playlists}
                  playlist={form.data.playlist}
                  shuffle={form.data.shuffle}
                  onChange={(playlist, shuffle) => form.setData((data) => ({ ...data, playlist, shuffle }))}
                />
              )}
            </Field>
            <Switch checked={form.data.repeat} onChange={(value) => form.setData("repeat", value)} label="Repetir" description="Al terminar la lista vuelve a empezar. Apagado, suena una sola vez y luego silencio." />
          </div>
        </Panel>
      </form>
    </StudioLayout>
  );
}
