import { Link } from "@inertiajs/react";
import { Hash, Radio, Search as SearchIcon, Sparkles } from "lucide-react";
import { ListenButton } from "@/Components/player";
import { HashtagChip } from "@/Components/site/hashtag-chip";
import { Section } from "@/Components/site/section";
import { SiteSearch } from "@/Components/site/site-search";
import { StationGrid, StationRow } from "@/Components/site/station-card";
import { FrequencyTitle, StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { ButtonLink } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Pagination } from "@/Components/ui/pagination";
import SiteLayout from "@/Layouts/SiteLayout";
import { count } from "@/lib/format";
import type { Paginated, Station } from "@/types";
import type { CategoryCard } from "@/types/site";

interface Tuned {
  label: string;
  slug: string;
  display: string;
  exists: boolean;
  available: boolean;
  station: Station | null;
  nearby: Station[];
}

interface SearchProps {
  query: string;
  kind: "empty" | "frequency" | "hashtag" | "text";
  tuned: Tuned | null;
  hashtag: { name: string; slug: string; exists: boolean } | null;
  stations: Paginated<Station> | null;
  categories: CategoryCard[];
  hashtags: { name: string; slug: string; uses_count: number }[];
}

function FrequencyResult({ tuned }: { tuned: Tuned }) {
  if (tuned.station) {
    const station = tuned.station;
    return (
      <div className="flex flex-wrap items-center gap-5 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <StationLogo station={station} size="lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <StreamStatusBadge status={station.stream_status.value} />
          <Link href={`/radio/${station.frequency.slug}`} className="block hover:underline">
            <FrequencyTitle station={station} size="lg" />
          </Link>
          {station.current_topic ? <p className="text-sm text-muted">Ahora: {station.current_topic.title}</p> : station.tagline && <p className="text-sm text-muted">{station.tagline}</p>}
        </div>
        <ListenButton station={station} size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-dashed border-line-strong bg-surface p-6">
      <div className="space-y-1">
        <p className="font-display text-3xl font-semibold tabular">{tuned.display}</p>
        <p className="text-sm text-muted">
          {tuned.available
            ? "Este canal está libre. Puede ser el de tu transmisión."
            : tuned.exists
              ? "No hay un canal público en este número ahora."
              : "Este número no está en la plataforma."}
        </p>
      </div>
      {tuned.available && (
        <ButtonLink href={`/obten-tu-frecuencia?frecuencia=${tuned.slug}`} variant="signal" icon={<Sparkles className="size-4" />}>
          Pedir {tuned.label}
        </ButtonLink>
      )}
    </div>
  );
}

export default function Search({ query, kind, tuned, hashtag, stations, categories, hashtags }: SearchProps) {
  const hasStations = Boolean(stations && stations.total > 0);
  const nothing = kind !== "empty" && !hasStations && !tuned?.station && categories.length === 0 && hashtags.length === 0 && (tuned?.nearby.length ?? 0) === 0;

  return (
    <SiteLayout title={query ? `Buscar «${query}»` : "Buscar"}>
      <div className="space-y-10">
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">{query ? <>Resultados para «{query}»</> : "¿Qué quieres escuchar?"}</h1>
          <SiteSearch className="max-w-xl" autoFocus={kind === "empty"} />
          <p className="text-xs text-muted">Prueba con un nombre, un número como «89.3», un #hashtag o una categoría como «salsa».</p>
        </div>

        {kind === "empty" && <EmptyState icon={<SearchIcon className="size-6" />} title="Escribe algo para buscar" description="Encuentra canales por nombre, número, tema o estilo." />}

        {tuned && (
          <Section title="Canal" icon={<Radio className="size-5 text-signal" />}>
            <FrequencyResult tuned={tuned} />
            {tuned.nearby.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-muted">Números cercanos</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tuned.nearby.map((station) => (
                    <StationRow key={station.id} station={station} />
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {hashtag && (
          <Section title={`#${hashtag.name}`} icon={<Hash className="size-5 text-muted" />} href={hashtag.exists ? `/hashtag/${hashtag.slug}` : undefined} linkLabel="Ver hashtag">
            {!hasStations && <p className="text-sm text-muted">Ningún canal usa este hashtag por ahora.</p>}
          </Section>
        )}

        {(categories.length > 0 || hashtags.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link key={category.id} href={`/categorias/${category.slug}`} className="rounded-full bg-ink px-3 py-1 text-sm font-medium text-surface hover:opacity-90">
                {category.name} <span className="text-xs opacity-70 tabular">{category.station_count}</span>
              </Link>
            ))}
            {hashtags.map((tag) => (
              <HashtagChip key={tag.slug} name={tag.name} />
            ))}
          </div>
        )}

        {stations && hasStations && (
          <Section title={kind === "frequency" ? "También coinciden" : "Canales"} description={`${count(stations.total)} ${stations.total === 1 ? "resultado" : "resultados"}`}>
            <StationGrid stations={stations.data} />
            <Pagination page={stations} />
          </Section>
        )}

        {nothing && <EmptyState icon={<SearchIcon className="size-6" />} title="Sin resultados" description="No encontramos canales con esa búsqueda. Revisa la ortografía o prueba en el listado." action={<ButtonLink href="/dial" variant="secondary">Ver canales</ButtonLink>} />}
      </div>
    </SiteLayout>
  );
}
