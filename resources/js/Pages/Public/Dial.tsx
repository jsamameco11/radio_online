import { Disc3 } from "lucide-react";
import { useMemo, useState } from "react";
import { FmDial } from "@/Components/site/fm-dial";
import { StationRow } from "@/Components/site/station-card";
import { ButtonLink } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { PageHeader } from "@/Components/ui/page-header";
import { Tabs } from "@/Components/ui/tabs";
import SiteLayout from "@/Layouts/SiteLayout";
import { count } from "@/lib/format";
import type { Station } from "@/types";
import type { DialBand } from "@/types/site";

interface DialProps {
  stations: Station[];
  band: DialBand;
  counts: { frequencies: number; available: number; on_air: number };
}

type Show = "all" | "on_air";

export default function Dial({ stations, band, counts }: DialProps) {
  const [show, setShow] = useState<Show>("all");
  const initial = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("f");
  const listed = useMemo(() => (show === "all" ? stations : stations.filter((station) => station.stream_status.audible)), [show, stations]);

  return (
    <SiteLayout title="Canales">
      <div className="space-y-8">
        <PageHeader
          eyebrow="Streaming"
          title="Elige un canal"
          description={`${count(stations.length)} canales en el ${band.name} ${band.min.toFixed(1)}–${band.max.toFixed(1)}. ${count(counts.on_air)} están al aire ahora.`}
          actions={
            <ButtonLink href="/obten-tu-frecuencia" variant="secondary">
              {count(counts.available)} canales libres
            </ButtonLink>
          }
        />

        {stations.length > 0 ? (
          <FmDial stations={stations} band={band} initial={initial} />
        ) : (
          <EmptyState icon={<Disc3 className="size-6" />} title="Todavía no hay canales" description="Todavía no hay canales publicados." />
        )}

        {stations.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">Todos los canales</h2>
              <Tabs<Show>
                value={show}
                onChange={setShow}
                items={[
                  { value: "all", label: "Todas", count: stations.length },
                  { value: "on_air", label: "Al aire", count: counts.on_air },
                ]}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {listed.map((station) => (
                <StationRow key={station.id} station={station} meta={station.categories?.slice(0, 2).map((category) => category.name).join(" · ")} />
              ))}
            </div>
          </section>
        )}
      </div>
    </SiteLayout>
  );
}
