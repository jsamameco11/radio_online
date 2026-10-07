import { router } from "@inertiajs/react";
import { Hash, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Select, Switch } from "@/Components/ui/field";
import { Tabs } from "@/Components/ui/tabs";
import type { CategoryGroup, Option, StationFiltersState } from "@/types/site";

interface StationFilterBarProps {
  url: string;
  filters: StationFiltersState;
  sorts: Option[];
  /** Without groups the category filter is hidden (e.g. inside a category page). */
  categories?: CategoryGroup[];
}

type Query = Record<string, string>;

function toQuery(filters: StationFiltersState, withCategory: boolean): Query {
  const query: Query = {};
  if (withCategory && filters.categoria) query.categoria = filters.categoria;
  if (filters.hashtag) query.hashtag = filters.hashtag;
  if (filters.en_vivo) query["en-vivo"] = "1";
  if (filters.orden !== "listeners") query.orden = filters.orden;
  return query;
}

/** Sort, live-only, category and hashtag filters of a station listing; every change reloads the list. */
export function StationFilterBar({ url, filters, sorts, categories }: StationFilterBarProps) {
  const [hashtag, setHashtag] = useState(filters.hashtag ?? "");
  const withCategory = Boolean(categories);

  const apply = (changes: Partial<StationFiltersState>) => {
    router.get(url, toQuery({ ...filters, ...changes }, withCategory), { preserveState: true, preserveScroll: true, replace: true });
  };

  const submitHashtag = (event: FormEvent) => {
    event.preventDefault();
    apply({ hashtag: hashtag.replace(/^#/, "").trim() || null });
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 lg:flex-row lg:items-center">
      <Tabs value={filters.orden} onChange={(orden) => apply({ orden })} items={sorts.map((sort) => ({ value: sort.value, label: sort.label }))} />
      <div className="flex flex-1 flex-wrap items-center gap-3 lg:justify-end">
        {categories && (
          <Select
            aria-label="Categoría"
            value={filters.categoria ?? ""}
            onChange={(event) => apply({ categoria: event.target.value || null })}
            className="w-auto min-w-44"
          >
            <option value="">Todas las categorías</option>
            {categories.map((group) => (
              <optgroup key={group.value} label={group.label}>
                {group.categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        )}
        <form onSubmit={submitHashtag} className="relative">
          <Hash className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={hashtag}
            onChange={(event) => setHashtag(event.target.value)}
            placeholder="Hashtag"
            aria-label="Filtrar por hashtag"
            maxLength={40}
            className="h-10 w-40 rounded-xl border border-line-strong bg-surface pr-8 pl-8 text-sm placeholder:text-faint focus:border-ink focus:outline-none"
          />
          {filters.hashtag && (
            <button
              type="button"
              onClick={() => {
                setHashtag("");
                apply({ hashtag: null });
              }}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"
              aria-label="Quitar hashtag"
            >
              <X className="size-4" />
            </button>
          )}
        </form>
        <Switch checked={filters.en_vivo} onChange={(enVivo) => apply({ en_vivo: enVivo })} label="Solo al aire" />
      </div>
    </div>
  );
}
