import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "@/Components/ui/button";
import { Checkbox, Field, Input, Select, Switch } from "@/Components/ui/field";
import type { GenreBrief, LibraryLimits, Option, TrackKind } from "@/types/media";
import { GenrePicker } from "./genre-picker";
import { NamesInput } from "./names-input";
import { cleanYear } from "./song-tools";
import type { TrackDraft } from "./track-draft";

interface Props {
  draft: TrackDraft;
  onChange: (draft: TrackDraft) => void;
  kinds: Option<TrackKind>[];
  genres: GenreBrief[];
  families: Option[];
  limits: LibraryLimits;
  currentCover?: string | null;
  errors?: Record<string, string>;
}

/** The author field says what it holds for each kind of audio. */
function authorLabel(kind: TrackKind) {
  if (kind === "song") return "Autor";
  if (kind === "program") return "Programa o locutor (opcional)";
  return "Autor (opcional)";
}

/** The details of one audio: what it is, who made it, its genres, its cover and how it plays. */
export function TrackFields({ draft, onChange, kinds, genres, families, limits, currentCover = null, errors = {} }: Props) {
  const song = draft.kind === "song";
  const set = <K extends keyof TrackDraft>(key: K, value: TrackDraft[K]) => onChange({ ...draft, [key]: value });
  const preview = useMemo(() => (draft.cover ? URL.createObjectURL(draft.cover) : null), [draft.cover]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const cover = preview ?? draft.coverUrl ?? (draft.removeCover ? null : currentCover);

  return (
    <div className="grid gap-5 sm:grid-cols-[8rem_1fr]">
      <div className="space-y-2">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-line bg-raised">
          {cover ? <img src={cover} alt="" className="size-full object-cover" /> : <ImagePlus className="size-7 text-faint" />}
        </div>
        <label className="block cursor-pointer text-center text-xs font-medium text-signal hover:underline">
          {cover ? "Cambiar portada" : "Elegir portada"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onChange({ ...draft, cover: file, coverUrl: null, removeCover: false });
              event.target.value = "";
            }}
          />
        </label>
        {cover && (
          <Button size="sm" variant="ghost" className="w-full" icon={<Trash2 className="size-3.5" />} onClick={() => onChange({ ...draft, cover: null, coverUrl: null, removeCover: true })}>
            Quitar
          </Button>
        )}
        {errors.cover && <p className="text-xs text-danger">{errors.cover}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo" error={errors.kind}>
          {(id, invalid) => (
            <Select id={id} invalid={invalid} value={draft.kind} onChange={(event) => set("kind", event.target.value as TrackKind)}>
              {kinds.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={song ? "Nombre de la canción" : "Nombre"} error={errors.title}>
          {(id, invalid) => <Input id={id} invalid={invalid} value={draft.title} maxLength={160} onChange={(event) => set("title", event.target.value)} />}
        </Field>
        <Field label={authorLabel(draft.kind)} error={errors.artist}>
          {(id, invalid) => <Input id={id} invalid={invalid} value={draft.artist} maxLength={120} onChange={(event) => set("artist", event.target.value)} />}
        </Field>
        {song && (
          <>
            <Field label={`Artistas invitados (${draft.featured.length}/${limits.max_featured})`} error={errors.featured} hint="Escribe un nombre y pulsa Enter.">
              {(id) => <NamesInput id={id} value={draft.featured} max={limits.max_featured} placeholder="feat." onChange={(featured) => set("featured", featured)} />}
            </Field>
            <Field label="Álbum (opcional)" error={errors.album}>
              {(id, invalid) => <Input id={id} invalid={invalid} value={draft.album} maxLength={160} onChange={(event) => set("album", event.target.value)} />}
            </Field>
            <Field label="Año" error={errors.year}>
              {(id, invalid) => <Input id={id} invalid={invalid || (draft.year.length > 0 && draft.year.length !== 4)} inputMode="numeric" placeholder="2024" value={draft.year} onChange={(event) => set("year", cleanYear(event.target.value))} />}
            </Field>
            <div className="space-y-1.5 sm:col-span-2">
              <p className="text-sm font-medium text-ink">Géneros</p>
              <GenrePicker genres={genres} families={families} value={draft.genreIds} max={limits.max_genres} onChange={(ids) => set("genreIds", ids)} />
              {errors.genre_ids ? (
                <p className="text-xs text-danger">{errors.genre_ids}</p>
              ) : (
                <p className="text-xs text-muted">Hasta {limits.max_genres}. El primero es el principal y decide en qué bloques de música suena; la estrella hace principal a otro.</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Switch
                checked={draft.rotation && draft.active}
                disabled={!draft.active}
                onChange={(rotation) => set("rotation", rotation)}
                label="Música automática"
                description={draft.active ? "La canción puede sonar cuando la radio está en piloto automático." : "Activa el audio para que pueda sonar en la música automática."}
              />
            </div>
          </>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-2 sm:col-span-2">
          <span title="Cuando suene encima de la música, la música baja para que se escuche mejor.">
            <Checkbox label="Bajar la música cuando suene encima" checked={draft.duck} onChange={(event) => set("duck", event.target.checked)} />
          </span>
          <span title="Un audio desactivado no suena al aire: ni en la música automática ni en los bloques programados.">
            <Checkbox label="Activo" checked={draft.active} onChange={(event) => set("active", event.target.checked)} />
          </span>
        </div>
      </div>
    </div>
  );
}
