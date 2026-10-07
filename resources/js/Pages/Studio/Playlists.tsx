import { router } from "@inertiajs/react";
import { ArrowDown, ArrowUp, ListMusic, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PlaylistEditor } from "@/Components/studio/playlists/playlist-editor";
import { Button } from "@/Components/ui/button";
import { PageHeader } from "@/Components/ui/page-header";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import { duration as formatDuration } from "@/lib/format";
import type { PlaylistItem, PlaylistSong } from "@/types/media";

interface Props {
  playlists: PlaylistItem[];
  songs: PlaylistSong[];
  maxTracks: number;
}

const NEW = "nueva";

export default function Playlists({ playlists, songs, maxTracks }: Props) {
  const url = useStudioUrl();
  const [selected, setSelected] = useState<string>(playlists[0]?.id ?? NEW);
  const known = useRef(new Set(playlists.map((playlist) => playlist.id)));

  useEffect(() => {
    const created = playlists.find((playlist) => !known.current.has(playlist.id));
    known.current = new Set(playlists.map((playlist) => playlist.id));
    if (created && selected === NEW) setSelected(created.id);
    else if (selected !== NEW && !playlists.some((playlist) => playlist.id === selected)) setSelected(playlists[0]?.id ?? NEW);
  }, [playlists, selected]);

  const current = playlists.find((playlist) => playlist.id === selected) ?? null;
  const editorKey = current ? `${current.id}:${current.tracks.map((track) => track.id).join(",")}:${current.name}:${current.description ?? ""}` : NEW;

  const reorder = (from: number, to: number) => {
    const ids = playlists.map((playlist) => playlist.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    router.post(url("/listas/orden"), { ids }, { preserveScroll: true });
  };

  const remove = (playlist: PlaylistItem) => {
    if (!window.confirm(`¿Eliminar la lista «${playlist.name}»? Las canciones siguen en la biblioteca.`)) return;
    router.delete(url(`/listas/${playlist.id}`), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Listas">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Contenido"
          title="Listas de reproducción"
          description="Canciones en el orden que tú eliges, para los bloques de la programación y la música automática."
          actions={
            <Button icon={<Plus className="size-4" />} onClick={() => setSelected(NEW)}>
              Nueva lista
            </Button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <aside className="space-y-2">
            {playlists.length === 0 && <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">Todavía no tienes listas.</p>}
            <ul className="space-y-1.5">
              {playlists.map((playlist, index) => (
                <li key={playlist.id} className={cn("group flex items-center gap-1 rounded-xl border px-3 py-2.5 transition", playlist.id === selected ? "border-signal bg-signal-soft" : "border-line bg-surface hover:bg-raised")}>
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setSelected(playlist.id)}>
                    <ListMusic className={cn("size-4 shrink-0", playlist.id === selected ? "text-signal" : "text-muted")} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{playlist.name}</span>
                      <span className="block text-xs text-muted">
                        {playlist.tracks.length} {playlist.tracks.length === 1 ? "canción" : "canciones"} · {formatDuration(playlist.duration)}
                      </span>
                    </span>
                  </button>
                  <div className="flex flex-col opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <button type="button" aria-label="Subir lista" disabled={index === 0} onClick={() => reorder(index, index - 1)} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-30">
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button type="button" aria-label="Bajar lista" disabled={index === playlists.length - 1} onClick={() => reorder(index, index + 1)} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-30">
                      <ArrowDown className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          <PlaylistEditor
            key={editorKey}
            playlist={current}
            songs={songs}
            maxTracks={maxTracks}
            onShuffle={() => current && router.post(url(`/listas/${current.id}/mezclar`), {}, { preserveScroll: true })}
            onDelete={() => current && remove(current)}
          />
        </div>
      </div>
    </StudioLayout>
  );
}
