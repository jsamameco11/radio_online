import { AlertTriangle, Music, Pause, Pencil, Play, Scissors, Trash2 } from "lucide-react";
import { Badge } from "@/Components/ui/badge";
import { Button, ButtonLink } from "@/Components/ui/button";
import { Switch } from "@/Components/ui/field";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { duration as formatDuration } from "@/lib/format";
import type { LibraryTrack } from "@/types/media";

interface Props {
  track: LibraryTrack;
  playing: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onRotation: () => void;
  onDelete: () => void;
}

export function TrackRow({ track, playing, onPlay, onEdit, onRotation, onDelete }: Props) {
  const url = useStudioUrl();

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
      <button
        type="button"
        onClick={onPlay}
        disabled={!track.audio_url}
        aria-label={playing ? "Pausar" : "Escuchar"}
        className="group relative size-11 shrink-0 overflow-hidden rounded-lg bg-raised disabled:opacity-50"
      >
        {track.cover_url ? <img src={track.cover_url} alt="" className="size-full object-cover" /> : <Music className="m-auto size-5 text-faint" />}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100 data-[on=true]:opacity-100" data-on={playing}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{track.title}</p>
        <p className="truncate text-xs text-muted">{[track.credit, track.album, track.year].filter(Boolean).join(" · ") || track.kind_label}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {track.problem && (
            <Badge tone="danger">
              <AlertTriangle className="size-3" /> {track.problem.label}
            </Badge>
          )}
          {track.edit_status === "processing" && <Badge tone="info">Procesando edición</Badge>}
          {track.edit_status === "failed" && <Badge tone="danger">Edición fallida</Badge>}
          {track.edited && !track.edit_status && <Badge tone="signal">Editado</Badge>}
          {track.genres.map((genre) => (
            <Badge key={genre.id}>{genre.name}</Badge>
          ))}
        </div>
      </div>

      <span className="w-14 shrink-0 text-right text-sm text-muted tabular">{formatDuration(track.duration)}</span>

      {track.kind === "song" && (
        <div className="shrink-0" title="Música automática">
          <Switch checked={track.rotation} onChange={onRotation} />
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1">
        <Button size="icon" variant="ghost" aria-label="Editar datos" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <ButtonLink href={url(`/editor?audio=${track.id}`)} size="icon" variant="ghost" aria-label="Abrir en el editor">
          <Scissors className="size-4" />
        </ButtonLink>
        <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}
