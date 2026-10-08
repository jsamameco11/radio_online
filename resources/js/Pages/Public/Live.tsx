import { Radio } from "lucide-react";
import { HashtagChip } from "@/Components/site/hashtag-chip";
import { StationGrid } from "@/Components/site/station-card";
import { ButtonLink } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import SiteLayout from "@/Layouts/SiteLayout";
import { count } from "@/lib/format";
import type { Paginated, Station } from "@/types";
import type { TrendingHashtag } from "@/types/site";

export default function Live({ stations, trending }: { stations: Paginated<Station>; trending: TrendingHashtag[] }) {
  const live = stations.data.filter((station) => station.stream_status.value === "live").length;

  return (
    <SiteLayout title="En vivo">
      <div className="space-y-8">
        <PageHeader
          eyebrow={
            <span className="inline-flex items-center gap-2 text-signal">
              <span className="size-2 rounded-full bg-signal animate-onair" aria-hidden /> En vivo
            </span>
          }
          title="Lo que suena ahora mismo"
          description={`${count(stations.total)} ${stations.total === 1 ? "canal al aire" : "canales al aire"}${live > 0 ? `, ${live} con alguien en cabina` : ""}. Las transmisiones en vivo aparecen primero.`}
        />
        {trending.some((tag) => tag.on_air > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Hablan de:</span>
            {trending
              .filter((tag) => tag.on_air > 0)
              .map((tag) => (
                <HashtagChip key={tag.slug} name={tag.name} live hint={String(tag.on_air)} />
              ))}
          </div>
        )}
        {stations.data.length > 0 ? (
          <StationGrid stations={stations.data} />
        ) : (
          <EmptyState
            icon={<Radio className="size-6" />}
            title="Ningún canal está transmitiendo"
            description="Vuelve en un rato o sigue a tus canales favoritos para encontrarlos rápido."
            action={
              <ButtonLink href="/explorar" variant="secondary">
                Explorar canales
              </ButtonLink>
            }
          />
        )}
        <Pagination page={stations} />
      </div>
    </SiteLayout>
  );
}
