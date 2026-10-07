import { useForm } from "@inertiajs/react";
import { Search } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { GenrePicker } from "@/Components/studio/library/genre-picker";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Checkbox, Field, Input, Select } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import type { CatalogGenre, CatalogSong, Option } from "@/types/media";

interface Props {
  genres: CatalogGenre[];
  families: Option[];
  songs: CatalogSong[];
  maxGenres: number;
}

const MAX_SELECTION = 500;

/** Gives genres to many songs at once: genres decide which songs fit each block of the schedule. */
export function AssignGenres({ genres, families, songs, maxGenres }: Props) {
  const url = useStudioUrl();
  const form = useForm<{ track_ids: string[]; genre_ids: string[]; mode: "add" | "replace" }>({ track_ids: [], genre_ids: [], mode: "add" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const names = useMemo(() => new Map(genres.map((genre) => [genre.id, genre.name])), [genres]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return songs.filter((song) => {
      if (filter === "none" && song.genre_ids.length > 0) return false;
      if (filter !== "all" && filter !== "none" && !song.genre_ids.includes(filter)) return false;
      return !needle || `${song.title} ${song.credit ?? ""}`.toLowerCase().includes(needle);
    });
  }, [songs, query, filter]);
  const withoutGenre = songs.filter((song) => song.genre_ids.length === 0).length;

  const selected = new Set(form.data.track_ids);
  const toggle = (id: string) => form.setData("track_ids", selected.has(id) ? form.data.track_ids.filter((other) => other !== id) : [...form.data.track_ids, id].slice(0, MAX_SELECTION));
  const allVisible = visible.length > 0 && visible.every((song) => selected.has(song.id));
  const toggleVisible = () =>
    form.setData(
      "track_ids",
      allVisible ? form.data.track_ids.filter((id) => !visible.some((song) => song.id === id)) : [...new Set([...form.data.track_ids, ...visible.map((song) => song.id)])].slice(0, MAX_SELECTION),
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(url("/catalogo/asignar"), { preserveScroll: true, onSuccess: () => form.reset("track_ids") });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Panel
        title="Canciones de tu radio"
        description={withoutGenre > 0 ? `${withoutGenre} sin género: no entran en los bloques por género.` : "Todas tus canciones tienen género."}
        padded={false}
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar canción o artista" className="pl-9" aria-label="Buscar canciones" />
          </div>
          <Select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrar por género" className="w-auto">
            <option value="all">Todas</option>
            <option value="none">Sin género ({withoutGenre})</option>
            {genres
              .filter((genre) => genre.songs > 0)
              .map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.name} ({genre.songs})
                </option>
              ))}
          </Select>
        </div>
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No hay canciones con este filtro.</p>
        ) : (
          <>
            <div className="border-b border-line px-4 py-2">
              <Checkbox label={`Elegir las ${visible.length} canciones visibles`} checked={allVisible} onChange={toggleVisible} />
            </div>
            <ul className="max-h-[36rem] divide-y divide-line overflow-y-auto">
              {visible.map((song) => (
                <li key={song.id}>
                  <label className={cn("flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-raised", selected.has(song.id) && "bg-signal-soft")}>
                    <input type="checkbox" className="size-4 accent-[var(--signal)]" checked={selected.has(song.id)} onChange={() => toggle(song.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{song.title}</span>
                      <span className="block truncate text-xs text-muted">{song.credit ?? "Sin artista"}</span>
                    </span>
                    <span className="hidden flex-wrap justify-end gap-1 sm:flex">
                      {song.genre_ids.length === 0 ? <Badge tone="warning">Sin género</Badge> : song.genre_ids.map((id) => <Badge key={id}>{names.get(id)}</Badge>)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <form onSubmit={submit} className="lg:sticky lg:top-6 lg:self-start">
        <Panel
          title="Asignar géneros"
          description={form.data.track_ids.length === 1 ? "1 canción elegida" : `${form.data.track_ids.length} canciones elegidas`}
          footer={
            <Button type="submit" loading={form.processing} disabled={form.data.track_ids.length === 0 || form.data.genre_ids.length === 0}>
              Aplicar
            </Button>
          }
        >
          <div className="space-y-4">
            <Field label="Géneros" error={form.errors.genre_ids ?? form.errors.track_ids}>
              {(id) => <GenrePicker id={id} genres={genres} families={families} value={form.data.genre_ids} max={maxGenres} onChange={(ids) => form.setData("genre_ids", ids)} />}
            </Field>
            <fieldset className="space-y-2 text-sm">
              <legend className="mb-1 font-medium">¿Qué pasa con los géneros que ya tienen?</legend>
              <label className="flex items-start gap-2">
                <input type="radio" className="mt-1 accent-[var(--signal)]" checked={form.data.mode === "add"} onChange={() => form.setData("mode", "add")} />
                <span>
                  Se conservan <span className="block text-xs text-muted">Los nuevos se agregan al final, hasta {maxGenres} por canción.</span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" className="mt-1 accent-[var(--signal)]" checked={form.data.mode === "replace"} onChange={() => form.setData("mode", "replace")} />
                <span>
                  Se reemplazan <span className="block text-xs text-muted">Las canciones quedan solo con los géneros elegidos.</span>
                </span>
              </label>
            </fieldset>
          </div>
        </Panel>
      </form>
    </div>
  );
}
