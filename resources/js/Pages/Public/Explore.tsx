import { Compass } from "lucide-react";
import { StationFilterBar } from "@/Components/site/station-filters";
import { StationGrid } from "@/Components/site/station-card";
import { EmptyState } from "@/Components/ui/empty-state";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import SiteLayout from "@/Layouts/SiteLayout";
import { count } from "@/lib/format";
import type { Paginated, Station } from "@/types";
import type { CategoryGroup, Option, StationFiltersState } from "@/types/site";

interface ExploreProps {
  stations: Paginated<Station>;
  filters: StationFiltersState;
  categories: CategoryGroup[];
  sorts: Option[];
}

export default function Explore({ stations, filters, categories, sorts }: ExploreProps) {
  return (
    <SiteLayout title="Explorar">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Explorar"
          title="Todos los canales"
          description={`${count(stations.total)} ${stations.total === 1 ? "canal encontrado" : "canales encontrados"}. Filtra por estilo, por tema o solo lo que está al aire.`}
        />
        <StationFilterBar url="/explorar" filters={filters} sorts={sorts} categories={categories} />
        {stations.data.length > 0 ? (
          <StationGrid stations={stations.data} />
        ) : (
          <EmptyState icon={<Compass className="size-6" />} title="No encontramos canales con esos filtros" description="Prueba con otra categoría, quita el hashtag o incluye los canales fuera del aire." />
        )}
        <Pagination page={stations} />
      </div>
    </SiteLayout>
  );
}
