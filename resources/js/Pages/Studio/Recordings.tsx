import { router, useForm } from "@inertiajs/react";
import { Disc3, Library, Mic, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Field, Input, Select, Switch, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { bytes, dateTime, duration as formatDuration } from "@/lib/format";
import type { Paginated } from "@/types";
import type { Option, RecordingItem, TrackKind } from "@/types/media";

interface Props {
  recordings: Paginated<RecordingItem>;
  kinds: Option<TrackKind>[];
  canEpisodes: boolean;
}

const TONES = { recording: "danger", ready: "signal", saving: "info", saved: "onair", discarded: "neutral" } as const;

export default function Recordings({ recordings, kinds, canEpisodes }: Props) {
  const url = useStudioUrl();
  const [converting, setConverting] = useState<RecordingItem | null>(null);

  const remove = (recording: RecordingItem) => {
    if (!window.confirm("¿Eliminar esta grabación? El archivo se borra y no se puede recuperar.")) return;
    router.delete(url(`/grabaciones/${recording.id}`), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Grabaciones">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Contenido"
          title="Grabaciones"
          description="Todo lo que grabas desde la consola en vivo. Escúchalo y guárdalo en la biblioteca o conviértelo en un episodio."
        />

        {recordings.data.length === 0 ? (
          <EmptyState icon={<Mic className="size-6" />} title="Todavía no hay grabaciones" description="Activa «Grabar» en la consola en vivo y tu transmisión aparecerá aquí al terminar." />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {recordings.data.map((recording) => {
              const tone = TONES[recording.status.value as keyof typeof TONES] ?? "neutral";
              return (
                <li key={recording.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-raised text-muted">
                      <Disc3 className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{recording.started_at ? dateTime(recording.started_at) : "Grabación"}</p>
                      <p className="text-xs text-muted">
                        {[recording.host, recording.duration ? formatDuration(recording.duration) : null, recording.bytes ? bytes(recording.bytes) : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Badge tone={tone}>{recording.status.label}</Badge>
                  </div>

                  {recording.audio_url && <audio controls preload="none" src={recording.audio_url} className="h-10 w-full" />}

                  {recording.track && (
                    <p className="flex items-center gap-2 rounded-xl bg-raised px-3 py-2 text-sm">
                      <Library className="size-4 text-onair" /> En la biblioteca como «{recording.track.title}» ({recording.track.kind})
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2">
                    {recording.convertible && (
                      <Button size="sm" icon={<Library className="size-3.5" />} onClick={() => setConverting(recording)}>
                        Guardar en la biblioteca
                      </Button>
                    )}
                    {recording.deletable && (
                      <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => remove(recording)}>
                        Eliminar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Pagination page={recordings} />
      </div>

      {converting && <ConvertModal recording={converting} kinds={kinds} canEpisodes={canEpisodes} onClose={() => setConverting(null)} />}
    </StudioLayout>
  );
}

function ConvertModal({ recording, kinds, canEpisodes, onClose }: { recording: RecordingItem; kinds: Option<TrackKind>[]; canEpisodes: boolean; onClose: () => void }) {
  const url = useStudioUrl();
  const form = useForm({
    title: recording.started_at ? `Programa del ${dateTime(recording.started_at, { dateStyle: "long" })}` : "",
    kind: "program" as TrackKind,
    episode: false,
    program: "",
    description: "",
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(url(`/grabaciones/${recording.id}/convertir`), { preserveScroll: true, onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Guardar grabación"
      description="La grabación se copia a la biblioteca y desde ahí puedes editarla o programarla."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="convert-recording" loading={form.processing}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="convert-recording" onSubmit={submit} className="space-y-4">
        <Field label="Nombre" error={form.errors.title}>
          {(id, invalid) => <Input id={id} invalid={invalid} value={form.data.title} maxLength={160} onChange={(event) => form.setData("title", event.target.value)} />}
        </Field>
        <Field label="Tipo" error={form.errors.kind}>
          {(id, invalid) => (
            <Select id={id} invalid={invalid} value={form.data.kind} onChange={(event) => form.setData("kind", event.target.value as TrackKind)}>
              {kinds.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {canEpisodes && (
          <>
            <Switch
              checked={form.data.episode}
              onChange={(episode) => form.setData("episode", episode)}
              label="Crear también un episodio"
              description="Queda como borrador para que lo completes y publiques en Episodios."
            />
            {form.data.episode && (
              <>
                <Field label="Programa (opcional)" error={form.errors.program}>
                  {(id, invalid) => <Input id={id} invalid={invalid} value={form.data.program} maxLength={120} onChange={(event) => form.setData("program", event.target.value)} />}
                </Field>
                <Field label="Descripción (opcional)" error={form.errors.description}>
                  {(id, invalid) => <Textarea id={id} invalid={invalid} value={form.data.description} maxLength={2000} onChange={(event) => form.setData("description", event.target.value)} />}
                </Field>
              </>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
