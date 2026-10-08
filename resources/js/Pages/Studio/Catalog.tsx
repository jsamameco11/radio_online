import { router } from "@inertiajs/react";
import { Disc3, Sparkles, Tags, Users } from "lucide-react";
import { useState } from "react";
import { type ArtistFilters, ArtistList } from "@/Components/studio/catalog/artist-list";
import { AssignGenres } from "@/Components/studio/catalog/assign-genres";
import { GenreList } from "@/Components/studio/catalog/genre-list";
import { RadioHeader } from "@/Components/studio/radio-header";
import { Button } from "@/Components/ui/button";
import { Stat } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { count } from "@/lib/format";
import type { Paginated } from "@/types";
import type { CatalogArtist, CatalogGenre, CatalogSong, CatalogStats, Option } from "@/types/media";

interface Props {
  genres: CatalogGenre[];
  families: Option[];
  artistKinds: Option[];
  artistSources: Option[];
  artists: Paginated<CatalogArtist>;
  stats: CatalogStats;
  songs: CatalogSong[];
  filters: ArtistFilters;
  maxGenres: number;
}

type Tab = "estilos" | "artistas" | "canciones";

export default function Catalog({ genres, families, artistKinds, artistSources, artists, stats, songs, filters, maxGenres }: Props) {
  const url = useStudioUrl();
  const filtered = Object.values(filters).some(Boolean) || artists.current_page > 1;
  const [tab, setTab] = useState<Tab>(filtered ? "artistas" : "estilos");

  return (
    <StudioLayout title="Catálogo musical">
      <div className="space-y-6">
        <RadioHeader
          title="Catálogo musical"
          description="Los estilos ordenan tu música: con ellos la programación arma bloques de salsa, rock o baladas. Los artistas conocidos le pasan su estilo a sus canciones."
          actions={
            <Button variant="secondary" icon={<Sparkles className="size-4" />} onClick={() => router.post(url("/catalogo/clasificar"), {}, { preserveScroll: true })}>
              Clasificar sin género
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={<Tags className="size-4" />} label="Estilos" value={count(stats.genres)} hint={`${count(stats.custom)} agregados por las radios · ${count(stats.own_genres)} por la tuya`} />
          <Stat icon={<Disc3 className="size-4" />} label="Estilos en uso" value={count(stats.in_use)} hint={`En tus ${count(songs.length)} canciones`} />
          <Stat icon={<Users className="size-4" />} label="Artistas" value={count(stats.artists)} hint={`${count(stats.learned)} aprendidos al subir canciones · ${count(stats.own_artists)} de tu radio`} />
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "estilos", label: "Estilos", count: stats.genres },
            { value: "artistas", label: "Artistas", count: artists.total },
            { value: "canciones", label: "Géneros de tus canciones", count: songs.length },
          ]}
        />

        {tab === "estilos" && <GenreList genres={genres} families={families} />}
        {tab === "artistas" && <ArtistList artists={artists} filters={filters} genres={genres} families={families} kinds={artistKinds} sources={artistSources} maxGenres={maxGenres} />}
        {tab === "canciones" && <AssignGenres genres={genres} families={families} songs={songs} maxGenres={maxGenres} />}
      </div>
    </StudioLayout>
  );
}
