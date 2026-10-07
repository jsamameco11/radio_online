import { FileAudio, ImagePlus } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { NamesInput } from "@/Components/studio/library/names-input";
import { ProgressBar } from "@/Components/studio/upload/progress-bar";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { Tabs } from "@/Components/ui/tabs";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { dateTime, duration as formatDuration } from "@/lib/format";
import { probeDuration } from "@/lib/media/duration";
import { fieldErrors } from "@/lib/media/errors";
import { appendField, sendAudio } from "@/lib/media/upload";
import type { EpisodeAudio, EpisodeItem, EpisodeLimits, EpisodeStatus, Option, ReadyRecording } from "@/types/media";
import { BrowserRecording } from "./browser-recording";

type Source = "keep" | "upload" | "record" | "library" | "recording";

interface Props {
  episode: EpisodeItem | null;
  statuses: Option<EpisodeStatus>[];
  programs: string[];
  audios: EpisodeAudio[];
  recordings: ReadyRecording[];
  limits: EpisodeLimits;
  onClose: () => void;
  onSaved: () => void;
}

/** «2026-10-07T18:30:00-05:00» → value of a datetime-local input. */
function localInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** Creates or edits an episode: its audio (uploaded, recorded here, from the library or a console recording) and its details. */
export function EpisodeForm({ episode, statuses, programs, audios, recordings, limits, onClose, onSaved }: Props) {
  const url = useStudioUrl();
  const [source, setSource] = useState<Source>(episode ? "keep" : "upload");
  const [file, setFile] = useState<{ file: File; duration: number | null } | null>(null);
  const [trackId, setTrackId] = useState("");
  const [recordingId, setRecordingId] = useState(recordings[0]?.id ?? "");
  const [audioQuery, setAudioQuery] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [data, setData] = useState({
    title: episode?.title ?? "",
    program: episode?.program ?? "",
    description: episode?.description ?? "",
    season: episode?.season ? String(episode.season) : "",
    number: episode?.number ? String(episode.number) : "",
    aired_on: episode?.aired_on ?? new Date().toLocaleDateString("en-CA"),
    hashtags: episode?.hashtags ?? [],
    status: episode?.status.value ?? ("draft" as EpisodeStatus),
    publish_at: localInput(episode?.publish_at ?? null),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const coverPreview = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);
  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);
  const shownCover = coverPreview ?? (removeCover ? null : episode?.cover_url ?? null);

  const foundAudios = useMemo(() => {
    const needle = audioQuery.trim().toLowerCase();
    return audios.filter((audio) => !needle || audio.title.toLowerCase().includes(needle)).slice(0, 100);
  }, [audios, audioQuery]);

  const set = <K extends keyof typeof data>(key: K, value: (typeof data)[K]) => setData((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setMessage(null);
    const fields = new FormData();
    appendField(fields, "title", data.title.trim());
    appendField(fields, "program", data.program.trim());
    appendField(fields, "description", data.description.trim());
    appendField(fields, "season", data.season);
    appendField(fields, "number", data.number);
    appendField(fields, "aired_on", data.aired_on);
    appendField(fields, "hashtags", data.hashtags);
    appendField(fields, "status", data.status);
    if (data.status === "scheduled" && data.publish_at) appendField(fields, "publish_at", new Date(data.publish_at).toISOString());
    if (cover) fields.append("cover", cover);
    if (removeCover) appendField(fields, "remove_cover", true);

    const uploading = source === "upload" || source === "record";
    if (uploading) {
      if (!file) {
        setErrors({ audio: source === "record" ? "Graba el episodio antes de guardarlo." : "Elige el archivo de audio." });
        return;
      }
      appendField(fields, "source", "upload");
      appendField(fields, "duration", file.duration);
    } else if (source === "library") {
      appendField(fields, "source", "library");
      appendField(fields, "track_id", trackId);
    } else if (source === "recording") {
      appendField(fields, "source", "recording");
      appendField(fields, "recording_id", recordingId);
    }

    setProgress(0);
    try {
      await sendAudio({
        url: url(episode ? `/episodios/${episode.id}` : "/episodios"),
        uploadsUrl: url("/biblioteca/subidas"),
        fields,
        file: uploading ? (file?.file ?? null) : null,
        kind: "program",
        direct: limits.direct,
        onProgress: setProgress,
      });
      onSaved();
    } catch (error) {
      const result = fieldErrors(error);
      setErrors(result.fields);
      setMessage(result.message);
      setProgress(null);
    }
  };

  const saving = progress !== null;
  const sourceTabs: { value: Source; label: string }[] = [
    ...(episode ? [{ value: "keep" as Source, label: "Mantener audio" }] : []),
    { value: "upload", label: "Subir archivo" },
    { value: "record", label: "Grabar aquí" },
    { value: "library", label: "De la biblioteca" },
    ...(recordings.length ? [{ value: "recording" as Source, label: "Grabación de la consola" }] : []),
  ];
  const audioError = errors.audio ?? errors.duration ?? errors.upload ?? errors.source ?? errors.track_id ?? errors.recording_id;

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      size="xl"
      title={episode ? "Editar episodio" : "Nuevo episodio"}
      description="Los oyentes lo escuchan cuando quieran desde la página de tu radio."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="episode-form" loading={saving}>
            {episode ? "Guardar cambios" : "Crear episodio"}
          </Button>
        </>
      }
    >
      <form id="episode-form" onSubmit={submit} className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Audio</h3>
          <Tabs
            value={source}
            onChange={(next) => {
              setSource(next);
              setFile(null);
            }}
            items={sourceTabs}
          />
          {source === "keep" && episode && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <FileAudio className="size-4" /> «{episode.track.title}» · {formatDuration(episode.duration)}
            </p>
          )}
          {source === "upload" && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong p-4 text-sm hover:bg-raised">
              <FileAudio className="size-5 text-muted" />
              <span className="min-w-0 flex-1 truncate">
                {file ? `${file.file.name}${file.duration ? ` · ${formatDuration(file.duration)}` : ""}` : `Elige el audio (${limits.types.join(", ")}, hasta ${limits.max_mb} MB)`}
              </span>
              <input
                type="file"
                accept={limits.types.map((type) => `.${type}`).join(",")}
                className="sr-only"
                onChange={async (event) => {
                  const chosen = event.target.files?.[0];
                  event.target.value = "";
                  if (chosen) setFile({ file: chosen, duration: await probeDuration(chosen) });
                }}
              />
            </label>
          )}
          {source === "record" &&
            (file ? (
              <div className="space-y-2 rounded-xl border border-line bg-raised p-4">
                <LocalAudio file={file.file} />
                <Button size="sm" variant="ghost" onClick={() => setFile(null)}>
                  Descartar y grabar de nuevo
                </Button>
              </div>
            ) : (
              <BrowserRecording maxDuration={limits.max_duration} onRecorded={(recorded, seconds) => setFile({ file: recorded, duration: seconds })} />
            ))}
          {source === "library" && (
            <div className="space-y-2">
              <Input value={audioQuery} onChange={(event) => setAudioQuery(event.target.value)} placeholder="Buscar en la biblioteca" aria-label="Buscar audio" />
              <Select value={trackId} onChange={(event) => setTrackId(event.target.value)} size={6} className="h-auto py-1" aria-label="Audio de la biblioteca">
                {foundAudios.map((audio) => (
                  <option key={audio.id} value={audio.id}>
                    {audio.title} · {audio.kind} · {formatDuration(audio.duration)}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {source === "recording" && (
            <Select value={recordingId} onChange={(event) => setRecordingId(event.target.value)} aria-label="Grabación de la consola">
              {recordings.map((recording) => (
                <option key={recording.id} value={recording.id}>
                  {recording.started_at ? dateTime(recording.started_at) : "Grabación"} · {formatDuration(recording.duration)}
                </option>
              ))}
            </Select>
          )}
          {audioError && <p className="text-xs text-danger">{audioError}</p>}
          {saving && <ProgressBar value={progress ?? 0} />}
        </section>

        <section className="grid gap-5 sm:grid-cols-[8rem_1fr]">
          <div className="space-y-2">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-line bg-raised">
              {shownCover ? <img src={shownCover} alt="" className="size-full object-cover" /> : <ImagePlus className="size-7 text-faint" />}
            </div>
            <label className="block cursor-pointer text-center text-xs font-medium text-signal hover:underline">
              {shownCover ? "Cambiar portada" : "Elegir portada"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const chosen = event.target.files?.[0];
                  event.target.value = "";
                  if (chosen) {
                    setCover(chosen);
                    setRemoveCover(false);
                  }
                }}
              />
            </label>
            {shownCover && (
              <button
                type="button"
                className="block w-full text-center text-xs text-muted hover:text-ink"
                onClick={() => {
                  setCover(null);
                  setRemoveCover(true);
                }}
              >
                Quitar portada
              </button>
            )}
            {errors.cover && <p className="text-xs text-danger">{errors.cover}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" className="sm:col-span-2" error={errors.title}>
              {(id, invalid) => <Input id={id} invalid={invalid} value={data.title} maxLength={160} onChange={(event) => set("title", event.target.value)} />}
            </Field>
            <Field label="Programa (opcional)" error={errors.program}>
              {(id, invalid) => (
                <>
                  <Input id={id} invalid={invalid} value={data.program} maxLength={120} list="episode-programs" onChange={(event) => set("program", event.target.value)} />
                  <datalist id="episode-programs">
                    {programs.map((program) => (
                      <option key={program} value={program} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Fecha de emisión" error={errors.aired_on}>
              {(id, invalid) => <Input id={id} invalid={invalid} type="date" value={data.aired_on} onChange={(event) => set("aired_on", event.target.value)} />}
            </Field>
            <Field label="Temporada (opcional)" error={errors.season}>
              {(id, invalid) => <Input id={id} invalid={invalid} type="number" min={1} max={999} value={data.season} onChange={(event) => set("season", event.target.value)} />}
            </Field>
            <Field label="Episodio n.º (opcional)" error={errors.number}>
              {(id, invalid) => <Input id={id} invalid={invalid} type="number" min={1} max={9999} value={data.number} onChange={(event) => set("number", event.target.value)} />}
            </Field>
            <Field label="Descripción (opcional)" className="sm:col-span-2" error={errors.description}>
              {(id, invalid) => <Textarea id={id} invalid={invalid} value={data.description} maxLength={2000} onChange={(event) => set("description", event.target.value)} />}
            </Field>
            <Field label="Hashtags" className="sm:col-span-2" hint={`Hasta ${limits.max_hashtags}. Ayudan a que te encuentren en Descubrir.`} error={errors.hashtags}>
              {(id) => <NamesInput id={id} value={data.hashtags} max={limits.max_hashtags} maxLength={limits.hashtag_length} prefix="#" placeholder="#entrevista" onChange={(hashtags) => set("hashtags", hashtags)} />}
            </Field>
            <Field label="Estado" error={errors.status}>
              {(id, invalid) => (
                <Select id={id} invalid={invalid} value={data.status} onChange={(event) => set("status", event.target.value as EpisodeStatus)}>
                  {statuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {data.status === "scheduled" && (
              <Field label="Publicar el" error={errors.publish_at}>
                {(id, invalid) => <Input id={id} invalid={invalid} type="datetime-local" value={data.publish_at} onChange={(event) => set("publish_at", event.target.value)} />}
              </Field>
            )}
          </div>
        </section>

        {message && !Object.keys(errors).length && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{message}</p>}
      </form>
    </Modal>
  );
}

function LocalAudio({ file }: { file: File }) {
  const source = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(source), [source]);
  return <audio controls src={source} className="h-10 w-full" />;
}
