import { AlertTriangle, Music, Pause, Pencil, Play, Podcast, Scissors, Trash2 } from "lucide-react";
import { Badge } from "@/Components/ui/badge";
import { Button, ButtonLink } from "@/Components/ui/button";
import { Switch } from "@/Components/ui/field";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import { duration as formatDuration } from "@/lib/format";
import type { LibraryTrack } from "@/types/media";

interface Props {
  track: LibraryTrack;
  playing: boolean;
  /** Shows what kind of audio it is, when the list mixes kinds. */
  showKind: boolean;
  canEpisodes: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onRotation: () => void;
  onDelete: () => void;
}

export function TrackRow({ track, playing, showKind, canEpisodes, onPlay, onEdit, onRotation, onDelete }: Props) {
  const url = useStudioUrl();
  const album = track.album ? `${track.album}${track.year ? ` (${track.year})` : ""}` : track.year ? String(track.year) : null;
  const details = [track.credit, album, track.genres.map((genre) => genre.name).join(" / ")].filter(Boolean);

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 lg:flex-nowrap">
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
        <p className={cn("truncate text-sm font-medium", !track.active && "text-muted line-through")}>{track.title}</p>
        <p className="truncate text-xs text-muted">
          {details.length ? `${details.join(" · ")} · ` : ""}
          {formatDuration(track.duration)}
          {track.upcoming > 0 && ` · en ${track.upcoming} ${track.upcoming === 1 ? "bloque programado" : "bloques programados"}`}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {showKind && <Badge>{track.kind_label}</Badge>}
          {track.problem && (
            <span title="La radio lo dejó de usar y siguió con otro audio. Vuelve a subir el archivo para que regrese al aire.">
              <Badge tone="danger">
                <AlertTriangle className="size-3" /> {track.problem.label}
              </Badge>
            </span>
          )}
          {!track.active && <Badge tone="warning">Desactivado</Badge>}
          {track.duck && <Badge tone="gold">Baja la música</Badge>}
          {track.edit_status === "processing" && <Badge tone="info">Procesando edición</Badge>}
          {track.edit_status === "failed" && <Badge tone="danger">Edición fallida</Badge>}
          {track.edited && !track.edit_status && (
            <span title="Recortado o con el sonido mejorado en el editor. El original está guardado.">
              <Badge tone="signal">Editado</Badge>
            </span>
          )}
          {track.episodes_count > 0 && <Badge tone="info">Episodio publicado</Badge>}
        </div>
      </div>

      {track.kind === "song" && (
        <div className="flex shrink-0 items-center gap-2" title={track.active || track.rotation ? "Música automática: suena en los espacios libres de la programación." : "Activa el audio para ponerlo en la música automática."}>
          <span className="hidden text-xs text-muted xl:inline">{track.rotation ? "Se repite" : "No se repite"}</span>
          <Switch checked={track.rotation} disabled={!track.active && !track.rotation} onChange={onRotation} />
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {canEpisodes && track.episodes_count === 0 && (
          <ButtonLink href={url(`/episodios?audio=${track.id}`)} size="sm" variant="ghost" icon={<Podcast className="size-3.5" />}>
            Guardar como episodio
          </ButtonLink>
        )}
        <Button size="icon" variant="ghost" aria-label="Editar datos" title="Editar datos" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <ButtonLink href={url(`/editor?audio=${track.id}`)} size="icon" variant="ghost" aria-label="Abrir en el editor" title="Recortar y mejorar el sonido">
          <Scissors className="size-4" />
        </ButtonLink>
        <Button size="icon" variant="ghost" aria-label="Eliminar" title="Eliminar" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}
