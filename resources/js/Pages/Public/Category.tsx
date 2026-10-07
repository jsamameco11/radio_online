import { Link } from "@inertiajs/react";
import { LayoutGrid } from "lucide-react";
import { StationFilterBar } from "@/Components/site/station-filters";
import { StationGrid } from "@/Components/site/station-card";
import { ButtonLink } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import SiteLayout from "@/Layouts/SiteLayout";
import { count } from "@/lib/format";
import type { Paginated, Station } from "@/types";
import type { CategoryCard, Option, StationFiltersState } from "@/types/site";

interface CategoryProps {
  category: { id: number; name: string; slug: string; group: string };
  stations: Paginated<Station>;
  filters: StationFiltersState;
  sorts: Option[];
  related: CategoryCard[];
}

export default function Category({ category, stations, filters, sorts, related }: CategoryProps) {
  return (
    <SiteLayout title={category.name}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={
            <Link href="/categorias" className="hover:text-ink">
              Categorías · {category.group}
            </Link>
          }
          title={category.name}
          description={`${count(stations.total)} ${stations.total === 1 ? "radio" : "radios"} en esta categoría.`}
        />
        <StationFilterBar url={`/categorias/${category.slug}`} filters={filters} sorts={sorts} />
        {stations.data.length > 0 ? (
          <StationGrid stations={stations.data} />
        ) : (
          <EmptyState
            icon={<LayoutGrid className="size-6" />}
            title={`Aún no hay radios de ${category.name}${filters.en_vivo ? " al aire" : ""}`}
            description="¿Por qué no la primera? Obtén tu frecuencia y sal al aire en esta categoría."
            action={<ButtonLink href="/obten-tu-frecuencia">Obtén tu frecuencia</ButtonLink>}
          />
        )}
        <Pagination page={stations} />
        {related.length > 0 && (
          <section className="space-y-3 border-t border-line pt-6">
            <h2 className="text-sm font-semibold text-muted">También en {category.group}</h2>
            <div className="flex flex-wrap gap-2">
              {related.map((other) => (
                <Link key={other.id} href={`/categorias/${other.slug}`} className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-ink">
                  {other.name} <span className="text-xs text-faint tabular">{other.station_count}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </SiteLayout>
  );
}
