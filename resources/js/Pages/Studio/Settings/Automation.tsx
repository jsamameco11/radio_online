import { Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { FallbackNotice, SourcePicker } from "@/Components/studio/console/source-picker";
import { RadioHeader } from "@/Components/studio/radio-header";
import { Button } from "@/Components/ui/button";
import { Field, Switch } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import type { Autopilot, BroadcastPlaylist } from "@/types/studio";

interface Settings {
  autofill: boolean;
  playlist: string | null;
  shuffle: boolean;
  repeat: boolean;
}

export default function AutomationSettings({ settings, autopilot, playlists }: { settings: Settings; autopilot: Autopilot; playlists: BroadcastPlaylist[] }) {
  const url = useStudioUrl();
  const can = useStudioCan();
  const form = useForm<Settings>(settings);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/configuracion/automatizacion"), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Automatización">
      <div className="space-y-6">
        <RadioHeader title="Automatización" description="La música automática llena los espacios sin programación y los bloques en vivo sin nadie al aire." />

        <form onSubmit={submit} className="max-w-4xl space-y-6">
          <FallbackNotice autopilot={autopilot} />

          <Panel
            title="Música automática"
            description={`Ahora suena: ${autopilot.label}${autopilot.paused ? " (detenida)" : ""}.`}
            footer={
              <Button type="submit" loading={form.processing} disabled={!form.isDirty}>
                Guardar cambios
              </Button>
            }
          >
            <div className="space-y-5">
              <Switch
                checked={form.data.autofill}
                onChange={(value) => form.setData("autofill", value)}
                label="Piloto automático (música 24/7)"
                description="Los espacios libres de la pista principal se llenan con la música automática: la lista que elijas aquí, en Programación o en la consola (o todas tus listas y las canciones de la música continua), empalmadas y sin repetir hasta completar cada vuelta. Si lo apagas, esos espacios quedan en silencio."
              />
              <Field label="Qué suena" hint="Un cambio de música entra cuando termina la canción que está al aire, sin cortes. Si la lista elegida se queda sin canciones, la radio queda en silencio." error={form.errors.playlist ?? form.errors.shuffle}>
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
              {can("schedule.manage") && (
                <p className="rounded-xl border border-line bg-raised px-4 py-3 text-xs leading-5 text-muted">
                  Las canciones que se repiten solas con «Canciones aleatorias» se eligen en{" "}
                  <Link href={url("/programacion")} className="font-semibold text-ink underline hover:text-signal">
                    Programación › Música continua
                  </Link>
                  .
                </p>
              )}
            </div>
          </Panel>
        </form>
      </div>
    </StudioLayout>
  );
}
