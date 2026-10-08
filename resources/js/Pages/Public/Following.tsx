import { BellPlus } from "lucide-react";
import { StationGrid } from "@/Components/site/station-card";
import { ButtonLink } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import SiteLayout from "@/Layouts/SiteLayout";
import type { Paginated, Station } from "@/types";

export default function Following({ stations }: { stations: Paginated<Station> }) {
  const onAir = stations.data.filter((station) => station.stream_status.audible);
  const offAir = stations.data.filter((station) => !station.stream_status.audible);

  return (
    <SiteLayout title="Mis canales">
      <div className="space-y-8">
        <PageHeader eyebrow="Tu colección" title="Mis canales" description="Tus suscripciones, con los canales al aire primero." />
        {stations.total === 0 ? (
          <EmptyState
            icon={<BellPlus className="size-6" />}
            title="Todavía no tienes suscripciones"
            description="Pulsa «Suscribirme» en la página de un canal para tenerlo siempre a mano."
            action={<ButtonLink href="/explorar">Explorar canales</ButtonLink>}
          />
        ) : (
          <>
            {onAir.length > 0 && (
              <section className="space-y-4">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <span className="size-2 rounded-full bg-signal animate-onair" aria-hidden /> Al aire ahora
                </h2>
                <StationGrid stations={onAir} />
              </section>
            )}
            {offAir.length > 0 && (
              <section className="space-y-4">
                <h2 className="font-display text-lg font-semibold text-muted">Fuera del aire</h2>
                <StationGrid stations={offAir} />
              </section>
            )}
            <Pagination page={stations} />
          </>
        )}
      </div>
    </SiteLayout>
  );
}
