import { FileAudio, Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { ProgressBar } from "@/Components/studio/upload/progress-bar";
import { Button } from "@/Components/ui/button";
import { Modal } from "@/Components/ui/modal";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { duration as formatDuration } from "@/lib/format";
import { http } from "@/lib/http";
import { probeDuration } from "@/lib/media/duration";
import { fieldErrors } from "@/lib/media/errors";
import { sendAudio } from "@/lib/media/upload";
import type { GenreBrief, Identification, LibraryLimits, LibraryTrack, Option, TrackKind } from "@/types/media";
import { applyIdentification, draftForm, draftFromTrack } from "./track-draft";
import { TrackFields } from "./track-fields";

interface Props {
  track: LibraryTrack;
  kinds: Option<TrackKind>[];
  genres: GenreBrief[];
  families: Option[];
  limits: LibraryLimits;
  onClose: () => void;
  onSaved: () => void;
}

/** Changes the details of an audio and, optionally, replaces its file. */
export function TrackEditModal({ track, kinds, genres, families, limits, onClose, onSaved }: Props) {
  const url = useStudioUrl();
  const [draft, setDraft] = useState(() => draftFromTrack(track));
  const [file, setFile] = useState<{ file: File; duration: number | null } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [identifying, setIdentifying] = useState(false);

  const identify = async () => {
    setIdentifying(true);
    setMessage(null);
    try {
      const found = await http.post<Identification>(url("/biblioteca/identificar"), {
        title: draft.title,
        artist: draft.artist,
        featured: draft.featured,
        duration: file?.duration ?? track.duration,
      });
      setDraft((current) => applyIdentification(current, found, limits.max_genres));
      if (!found.found) setMessage("No encontramos esta canción en los catálogos de música. Completa los datos a mano.");
    } catch (error) {
      setMessage(fieldErrors(error).message);
    } finally {
      setIdentifying(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setMessage(null);
    setProgress(0);
    const fields = draftForm(draft, file ? file.duration : null);
    try {
      await sendAudio({
        url: url(`/biblioteca/${track.id}`),
        uploadsUrl: url("/biblioteca/subidas"),
        fields,
        file: file?.file ?? null,
        kind: draft.kind,
        direct: limits.direct,
        onProgress: setProgress,
      });
      onSaved();
    } catch (error) {
      const { fields: invalid, message: general } = fieldErrors(error);
      setErrors(invalid);
      setMessage(general);
      setProgress(null);
    }
  };

  const saving = progress !== null;

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      size="lg"
      title="Editar audio"
      description={`${track.kind_label} · ${formatDuration(track.duration)}`}
      footer={
        <>
          {draft.kind === "song" && (
            <Button variant="ghost" className="mr-auto" icon={<Sparkles className="size-4" />} loading={identifying} disabled={saving || !draft.title.trim()} onClick={identify}>
              Identificar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="track-edit" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="track-edit" onSubmit={submit} className="space-y-5">
        <TrackFields draft={draft} onChange={setDraft} kinds={kinds} genres={genres} families={families} limits={limits} currentCover={track.cover_url} errors={errors} />

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-line-strong p-3 text-sm">
          <FileAudio className="size-4 text-muted" />
          <span className="min-w-0 flex-1 truncate text-muted">
            {file ? `${file.file.name}${file.duration ? ` · ${formatDuration(file.duration)}` : ""}` : "Reemplazar el archivo de audio (opcional). Las ediciones hechas se pierden."}
          </span>
          <label className="cursor-pointer text-xs font-medium text-signal hover:underline">
            {file ? "Elegir otro" : "Elegir archivo"}
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
        </div>
        {errors.audio || errors.duration || errors.upload ? <p className="text-xs text-danger">{errors.audio ?? errors.duration ?? errors.upload}</p> : null}

        {saving && <ProgressBar value={progress ?? 0} />}
        {message && !Object.keys(errors).length && <p className="rounded-xl bg-raised px-3 py-2 text-sm text-muted">{message}</p>}
      </form>
    </Modal>
  );
}
