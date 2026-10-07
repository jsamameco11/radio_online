import { router } from "@inertiajs/react";
import { Search, Sparkles, UserPlus, Users } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { ArtistModal } from "@/Components/studio/catalog/artist-modal";
import { AssignGenres } from "@/Components/studio/catalog/assign-genres";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Input, Select } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Tabs } from "@/Components/ui/tabs";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { count } from "@/lib/format";
import type { Paginated } from "@/types";
import type { CatalogArtist, CatalogGenre, CatalogSong, Option } from "@/types/media";

interface Props {
  genres: CatalogGenre[];
  families: Option[];
  artistKinds: Option[];
  artists: Paginated<CatalogArtist>;
  songs: CatalogSong[];
  filters: { search: string; genre: string };
  maxGenres: number;
}

type Tab = "canciones" | "artistas";

export default function Catalog({ genres, families, artistKinds, artists, songs, filters, maxGenres }: Props) {
  const url = useStudioUrl();
  const [tab, setTab] = useState<Tab>(filters.search || filters.genre || artists.current_page > 1 ? "artistas" : "canciones");
  const [search, setSearch] = useState(filters.search);
  const [adding, setAdding] = useState(false);

  const visit = (query: { buscar?: string; genero?: string }) =>
    router.get(url("/catalogo"), Object.fromEntries(Object.entries(query).filter(([, value]) => value)), { preserveState: true, replace: true, only: ["artists", "filters"] });

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    visit({ buscar: search.trim(), genero: filters.genre });
  };

  const kindLabel = (kind: string | null) => artistKinds.find((option) => option.value === kind)?.label;

  return (
    <StudioLayout title="Catálogo musical">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Contenido"
          title="Catálogo musical"
          description="Los géneros ordenan tu música: con ellos la programación arma bloques de salsa, rock o baladas. Los artistas conocidos le pasan su género a sus canciones."
          actions={
            <>
              <Button variant="secondary" icon={<Sparkles className="size-4" />} onClick={() => router.post(url("/catalogo/clasificar"), {}, { preserveScroll: true })}>
                Clasificar sin género
              </Button>
              <Button icon={<UserPlus className="size-4" />} onClick={() => setAdding(true)}>
                Agregar artista
              </Button>
            </>
          }
        />

        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "canciones", label: "Géneros de tus canciones", count: songs.length },
            { value: "artistas", label: "Artistas", count: artists.total },
          ]}
        />

        {tab === "canciones" ? (
          <AssignGenres genres={genres} families={families} songs={songs} maxGenres={maxGenres} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <form onSubmit={onSearch} className="relative min-w-64 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar artista" className="pl-9" aria-label="Buscar artista" />
              </form>
              <Select value={filters.genre} onChange={(event) => visit({ buscar: filters.search, genero: event.target.value })} className="w-auto" aria-label="Filtrar por género">
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
                      <th className="px-4 py-3 font-medium">Géneros</th>
                      <th className="hidden px-4 py-3 font-medium md:table-cell">Origen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {artists.data.map((artist) => (
                      <tr key={artist.id}>
                        <td className="px-4 py-3 font-medium">{artist.name}</td>
                        <td className="hidden px-4 py-3 text-muted sm:table-cell">{kindLabel(artist.kind) ?? "—"}</td>
                        <td className="hidden px-4 py-3 text-muted sm:table-cell">{artist.country ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {artist.genres.map((genre) => (
                              <Badge key={genre.id}>{genre.name}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted md:table-cell">{artist.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-faint">{count(artists.total)} artistas en el catálogo compartido.</p>
            <Pagination page={artists} />
          </div>
        )}
      </div>

      {adding && <ArtistModal genres={genres} families={families} kinds={artistKinds} maxGenres={maxGenres} onClose={() => setAdding(false)} />}
    </StudioLayout>
  );
}
