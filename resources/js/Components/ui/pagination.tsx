import { Link } from "@inertiajs/react";
import type { Paginated } from "@/types";
import { cn } from "@/lib/cn";

export function Pagination({ page }: { page: Paginated<unknown> }) {
  if (page.last_page <= 1) return null;

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Paginación">
      <p className="text-muted tabular">
        {page.from}–{page.to} de {page.total}
      </p>
      <div className="flex flex-wrap gap-1">
        {page.links.map((link, index) =>
          link.url ? (
            <Link
              key={index}
              href={link.url}
              preserveScroll
              preserveState
              className={cn("min-w-9 rounded-lg px-3 py-1.5 text-center tabular", link.active ? "bg-primary text-on-primary" : "text-muted hover:bg-raised hover:text-ink")}
              dangerouslySetInnerHTML={{ __html: link.label }}
            />
          ) : (
            <span key={index} className="min-w-9 px-3 py-1.5 text-center text-faint" dangerouslySetInnerHTML={{ __html: link.label }} />
          ),
        )}
      </div>
    </nav>
  );
}
