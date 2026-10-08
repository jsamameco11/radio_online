import { Link, useForm } from "@inertiajs/react";
import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, ListPlus, Plus, Search, Shuffle, Trash2, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Input, Textarea } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import { duration as formatDuration } from "@/lib/format";
import { longDuration } from "@/lib/radio/format";
import type { PlaylistItem, PlaylistSong } from "@/types/media";

/** Songs of the library listed at once; the bulk action still adds every match. */
const SHOWN = 50;

interface Props {
  playlist: PlaylistItem | null;
  songs: PlaylistSong[];
  maxTracks: number;
  onShuffle: () => void;
  onDelete: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

/** Name, description and the ordered songs of a list; songs come from the library. */
export function PlaylistEditor({ playlist, songs, maxTracks, onShuffle, onDelete, onDirtyChange }: Props) {
  const url = useStudioUrl();
  const form = useForm({
    name: playlist?.name ?? "",
    description: playlist?.description ?? "",
    track_ids: playlist?.tracks.map((track) => track.id) ?? [],
  });
  const [query, setQuery] = useState("");
  const [dragged, setDragged] = useState<number | null>(null);
  const dirty = form.isDirty && (playlist !== null || form.data.name.trim() !== "" || form.data.track_ids.length > 0);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const byId = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  const offered = useMemo(() => songs.filter((song) => song.playable), [songs]);
  const chosen = form.data.track_ids.map((id) => byId.get(id)).filter((song): song is PlaylistSong => Boolean(song));
  const total = chosen.reduce((sum, song) => sum + song.duration, 0);
  const room = Math.max(0, maxTracks - form.data.track_ids.length);
  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const taken = new Set(form.data.track_ids);
    return offered.filter((song) => !taken.has(song.id) && (!needle || `${song.title} ${song.credit ?? ""}`.toLowerCase().includes(needle)));
  }, [offered, query, form.data.track_ids]);
  const found = matching.slice(0, SHOWN);

  const setIds = (ids: string[]) => form.setData("track_ids", ids);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= form.data.track_ids.length || from === to) return;
    const ids = [...form.data.track_ids];
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    setIds(ids);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (playlist) form.put(url(`/listas/${playlist.id}`), { preserveScroll: true });
    else form.post(url("/listas"), { preserveScroll: true });
  };

  const trackError = Object.entries(form.errors).find(([key]) => key.startsWith("track_ids"))?.[1];

  return (
    <form onSubmit={submit} className="space-y-6">
      <Panel
        title={playlist ? "Editar lista" : "Nueva lista"}
        description={`${chosen.length} ${chosen.length === 1 ? "canción" : "canciones"} · ${longDuration(total)} por vuelta`}
        actions={
          playlist && (
            <>
              <Button size="sm" variant="ghost" icon={<Shuffle className="size-3.5" />} onClick={onShuffle} disabled={form.isDirty}>
                Mezclar
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" icon={<Trash2 className="size-3.5" />} onClick={onDelete}>
                Eliminar
              </Button>
            </>
          )
        }
        footer={
          <Button type="submit" loading={form.processing} disabled={form.data.name.trim().length < 2 || (playlist !== null && !form.isDirty)}>
            {playlist ? "Guardar cambios" : "Crear lista"}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" error={form.errors.name}>
            {(id, invalid) => <Input id={id} invalid={invalid} value={form.data.name} maxLength={80} onChange={(event) => form.setData("name", event.target.value)} placeholder="Éxitos de la mañana" />}
          </Field>
          <Field label="Descripción (opcional)" error={form.errors.description}>
            {(id, invalid) => <Textarea id={id} invalid={invalid} value={form.data.description} maxLength={240} rows={1} className="min-h-10" onChange={(event) => form.setData("description", event.target.value)} placeholder="Para las mañanas" />}
          </Field>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={`En esta lista (${chosen.length})`} description="Arrástralas o usa las flechas para ordenarlas." actions={<span className="font-mono text-xs text-muted tabular">{longDuration(total)} por vuelta</span>} padded={false}>
          {trackError && <p className="px-5 pt-4 text-xs text-danger">{trackError}</p>}
          {chosen.length === 1 && <p className="px-5 pt-4 text-xs font-medium text-warning">Con una sola canción, sonará una y otra vez.</p>}
          {chosen.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Toca las canciones de la biblioteca para agregarlas en orden.</p>
          ) : (
            <ol className="max-h-[32rem] divide-y divide-line overflow-y-auto">
              {chosen.map((song, index) => (
                <li
                  key={song.id}
                  draggable
                  onDragStart={() => setDragged(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragged !== null) move(dragged, index);
                    setDragged(null);
                  }}
                  className={cn("flex items-center gap-2 px-3 py-2", dragged === index && "opacity-50")}
                >
                  <GripVertical className="size-4 shrink-0 cursor-grab text-faint" />
                  <span className="w-7 shrink-0 text-right text-xs text-faint tabular">{index + 1}</span>
                  <SongText song={song} />
                  <Button size="icon" variant="ghost" aria-label="Subir" onClick={() => move(index, index - 1)} disabled={index === 0}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Bajar" onClick={() => move(index, index + 1)} disabled={index === chosen.length - 1}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Quitar" onClick={() => setIds(form.data.track_ids.filter((id) => id !== song.id))}>
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Biblioteca" description="Canciones activas que todavía no están en la lista." padded={false}>
          <div className="flex items-center gap-2 border-b border-line p-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar canción o artista" className="pl-9" aria-label="Buscar canciones" />
            </div>
            <Button size="sm" variant="secondary" icon={<ListPlus className="size-3.5" />} disabled={matching.length === 0 || room === 0} onClick={() => setIds([...form.data.track_ids, ...matching.slice(0, room).map((song) => song.id)])}>
              Agregar {query.trim() ? "estas" : "todas"}
            </Button>
          </div>
          {offered.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">
              Tu biblioteca no tiene canciones activas.{" "}
              <Link href={url("/biblioteca")} className="font-semibold text-ink underline hover:text-signal">
                Súbelas aquí
              </Link>
              .
            </p>
          ) : found.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">{query.trim() ? "Sin resultados." : "Todas las canciones ya están en la lista."}</p>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
              {found.map((song) => (
                <li key={song.id} className="flex items-center gap-2 px-3 py-2">
                  <SongText song={song} />
                  <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} disabled={room === 0} onClick={() => setIds([...form.data.track_ids, song.id])}>
                    Agregar
                  </Button>
                </li>
              ))}
              {matching.length > SHOWN && <li className="px-3 py-2 text-xs text-muted">Y {matching.length - SHOWN} más: busca para encontrarlas o agrégalas todas.</li>}
            </ul>
          )}
        </Panel>
      </div>
    </form>
  );
}

function SongText({ song }: { song: PlaylistSong }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="flex items-center gap-1.5 truncate text-sm">
        {!song.playable && <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-label="Desactivada o con un problema en el archivo: no sonará" />}
        {song.title}
      </p>
      <p className="truncate text-xs text-muted">
        {song.credit ?? "Sin artista"} · {formatDuration(song.duration)}
      </p>
    </div>
  );
}
