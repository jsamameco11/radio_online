import { Hash, Radio } from "lucide-react";
import { EpisodeTile } from "@/Components/site/episode-card";
import { Section } from "@/Components/site/section";
import { StationGrid } from "@/Components/site/station-card";
import { EmptyState } from "@/Components/ui/empty-state";
import { Pagination } from "@/Components/ui/pagination";
import SiteLayout from "@/Layouts/SiteLayout";
import { count } from "@/lib/format";
import type { Paginated, Station } from "@/types";
import type { EpisodeCard } from "@/types/site";

interface HashtagProps {
  hashtag: { name: string; slug: string; uses_count: number };
  talkingNow: Station[];
  stations: Paginated<Station>;
  episodes: EpisodeCard[];
}

export default function Hashtag({ hashtag, talkingNow, stations, episodes }: HashtagProps) {
  const nothing = talkingNow.length === 0 && stations.total === 0 && episodes.length === 0;

  return (
    <SiteLayout title={`#${hashtag.name}`}>
      <div className="space-y-12">
        <header className="flex flex-wrap items-center gap-5">
          <span className="flex size-16 items-center justify-center rounded-3xl bg-ink text-surface">
            <Hash className="size-8" />
          </span>
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">#{hashtag.name}</h1>
            <p className="text-sm text-muted">
              {talkingNow.length > 0 ? `${talkingNow.length} ${talkingNow.length === 1 ? "radio habla" : "radios hablan"} de esto ahora · ` : ""}
              {count(stations.total)} {stations.total === 1 ? "radio" : "radios"} · {episodes.length} {episodes.length === 1 ? "episodio" : "episodios"}
            </p>
          </div>
        </header>

        {nothing && <EmptyState icon={<Hash className="size-6" />} title={`Nadie usa #${hashtag.name} todavía`} description="Prueba con otro hashtag o explora las tendencias de la portada." />}

        {talkingNow.length > 0 && (
          <Section title="Hablando de esto ahora" icon={<span className="size-2.5 rounded-full bg-signal animate-onair" aria-hidden />}>
            <StationGrid stations={talkingNow} />
          </Section>
        )}

        {stations.total > 0 && (
          <Section title="Radios con este hashtag" icon={<Radio className="size-5 text-muted" />}>
            <StationGrid stations={stations.data} />
            <Pagination page={stations} />
          </Section>
        )}

        {episodes.length > 0 && (
          <Section title="Episodios">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {episodes.map((episode) => (
                <EpisodeTile key={episode.id} episode={episode} />
              ))}
            </div>
          </Section>
        )}
      </div>
    </SiteLayout>
  );
}
