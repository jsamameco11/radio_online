import { router } from "@inertiajs/react";
import { Pencil, Search, Trash2, UserPlus, Users } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Input, Select } from "@/Components/ui/field";
import { Pagination } from "@/Components/ui/pagination";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { count } from "@/lib/format";
import type { Paginated } from "@/types";
import type { CatalogArtist, CatalogGenre, Option } from "@/types/media";
import { ArtistModal } from "./artist-modal";

export interface ArtistFilters {
  search: string;
  genre: string;
  kind: string;
  source: string;
}

interface Props {
  artists: Paginated<CatalogArtist>;
  filters: ArtistFilters;
  genres: CatalogGenre[];
  families: Option[];
  kinds: Option[];
  sources: Option[];
  maxGenres: number;
}

/** The artists of the shared catalog, searched and filtered on the server; the station edits the ones it added. */
export function ArtistList({ artists, filters, genres, families, kinds, sources, maxGenres }: Props) {
  const url = useStudioUrl();
  const [search, setSearch] = useState(filters.search);
  const [editing, setEditing] = useState<CatalogArtist | "new" | null>(null);

  const visit = (changes: Partial<ArtistFilters>) => {
    const next = { ...filters, ...changes };
    const query = { buscar: next.search, genero: next.genre, tipo: next.kind, origen: next.source };
    router.get(url("/catalogo"), Object.fromEntries(Object.entries(query).filter(([, value]) => value)), { preserveState: true, preserveScroll: true, replace: true, only: ["artists", "filters"] });
  };

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    visit({ search: search.trim() });
  };

  const label = (options: Option[], value: string | null) => options.find((option) => option.value === value)?.label;

  const remove = (artist: CatalogArtist) => {
    const songs = artist.songs ? `\n\nTus ${count(artist.songs)} ${artist.songs === 1 ? "canción sigue" : "canciones siguen"} en la biblioteca con sus géneros.` : "";
    if (!window.confirm(`¿Quitar a «${artist.name}» del catálogo?${songs}`)) return;
    router.delete(url(`/catalogo/artistas/${artist.id}`), { preserveScroll: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <form onSubmit={onSearch} className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, otro nombre, país o género" className="pl-9" aria-label="Buscar artista" />
        </form>
        <Select value={filters.genre} onChange={(event) => visit({ genre: event.target.value })} className="w-auto" aria-label="Filtrar por género">
          <option value="">Todos los géneros</option>
          {families.map((family) => (
            <optgroup key={family.value} label={family.label}>
              {genres
                .filter((genre) => genre.family === family.value)
                .map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
        <Select value={filters.kind} onChange={(event) => visit({ kind: event.target.value })} className="w-auto" aria-label="Filtrar por tipo">
          <option value="">Solistas y agrupaciones</option>
          {kinds.map((kind) => (
            <option key={kind.value} value={kind.value}>
              {kind.label}
            </option>
          ))}
        </Select>
        <Select value={filters.source} onChange={(event) => visit({ source: event.target.value })} className="w-auto" aria-label="Filtrar por origen">
          <option value="">Cualquier origen</option>
          {sources.map((source) => (
            <option key={source.value} value={source.value}>
              {source.label}
            </option>
          ))}
        </Select>
        <Button icon={<UserPlus className="size-4" />} onClick={() => setEditing("new")}>
          Agregar artista
        </Button>
      </div>

      {artists.data.length === 0 ? (
        <EmptyState icon={<Users className="size-6" />} title="No encontramos artistas" description="Agrega al artista y sus géneros para que sus canciones se clasifiquen solas." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Artista</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Tipo</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">País</th>
                <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Canciones</th>
                <th className="px-4 py-3 font-medium">Géneros</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Origen</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {artists.data.map((artist) => (
                <tr key={artist.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{artist.name}</p>
                    {artist.aliases.length > 0 && <p className="mt-0.5 max-w-64 truncate text-xs text-faint">También: {artist.aliases.join(", ")}</p>}
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{label(kinds, artist.kind) ?? "—"}</td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{artist.country ?? "—"}</td>
                  <td className="hidden px-4 py-3 text-right text-muted tabular-nums sm:table-cell">{artist.songs ? count(artist.songs) : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {artist.genres.map((genre, index) => (
                        <Badge key={genre.id} tone={index === 0 ? "signal" : "neutral"}>
                          {genre.name}
                        </Badge>
                      ))}
                      {artist.genres.length === 0 && <span className="text-xs text-faint">Sin géneros</span>}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted md:table-cell">{label(sources, artist.source) ?? artist.source}</td>
                  <td className="px-4 py-3">
                    {artist.editable && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(artist)} aria-label={`Editar ${artist.name}`} title="Editar">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(artist)} aria-label={`Quitar ${artist.name}`} title="Quitar del catálogo">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-faint">{count(artists.total)} artistas en el catálogo compartido. Solo puedes cambiar los que agregó tu radio.</p>
      <Pagination page={artists} />

      {editing && <ArtistModal artist={editing === "new" ? undefined : editing} genres={genres} families={families} kinds={kinds} maxGenres={maxGenres} onClose={() => setEditing(null)} />}
    </div>
  );
}
