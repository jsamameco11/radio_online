import { Link } from "@inertiajs/react";
import { PageHeader } from "@/Components/ui/page-header";
import SiteLayout from "@/Layouts/SiteLayout";
import { cn } from "@/lib/cn";
import type { CategoryGroup } from "@/types/site";

export default function Categories({ groups }: { groups: CategoryGroup[] }) {
  return (
    <SiteLayout title="Categorías">
      <div className="space-y-10">
        <PageHeader eyebrow="Categorías" title="Encuentra tu estilo" description="Cada radio elige hasta tres categorías. Entra a una para ver quién la transmite." />
        {groups.map((group) => (
          <section key={group.value} className="space-y-4">
            <h2 className="font-display text-lg font-semibold">{group.label}</h2>
            <div className="flex flex-wrap gap-2">
              {group.categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categorias/${category.slug}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
                    category.station_count > 0 ? "border-line bg-surface text-ink hover:border-ink" : "border-dashed border-line text-faint hover:text-muted",
                  )}
                >
                  {category.name}
                  <span className={cn("rounded-full px-1.5 text-xs tabular", category.station_count > 0 ? "bg-raised text-muted" : "text-faint")}>{category.station_count}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </SiteLayout>
  );
}
