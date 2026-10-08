import { router } from "@inertiajs/react";
import { Search, ShieldCheck, Tag, Wallet, Zap } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { ListingCard } from "@/Components/site/listing-card";
import { EmptyState } from "@/Components/ui/empty-state";
import { Input, Select } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import SiteLayout from "@/Layouts/SiteLayout";
import { count } from "@/lib/format";
import type { Paginated } from "@/types";
import type { StationListing } from "@/types/marketplace";
import type { Option } from "@/types/site";

interface Props {
  listings: Paginated<StationListing>;
  filters: { orden: string; q: string };
  sorts: Option[];
}

export default function MarketplaceIndex({ listings, filters, sorts }: Props) {
  const [search, setSearch] = useState(filters.q);

  const visit = (next: Partial<Props["filters"]>) => {
    const query = { ...filters, ...next };
    router.get(
      "/frecuencias-en-venta",
      { ...(query.q ? { q: query.q } : {}), ...(query.orden !== "recientes" ? { orden: query.orden } : {}) },
      { preserveState: true, preserveScroll: true, replace: true },
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    visit({ q: search.trim() });
  };

  return (
    <SiteLayout title="Canales en venta">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Canales en venta"
          title="Compra tu canal o uno ya en marcha"
          description="Canales libres para abrir el tuyo, y canales completos que sus dueños venden con su nombre, suscriptores, biblioteca y episodios. Todo a precio fijo: pagas con tu billetera y es tuyo al instante."
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <Step icon={<Wallet className="size-4" />} title="Pagas con tu billetera">
            Recarga saldo y compra al precio publicado, sin negociaciones.
          </Step>
          <Step icon={<Zap className="size-4" />} title="Es tuya al instante">
            Quedas como única propietaria y entras a la consola con tu cuenta.
          </Step>
          <Step icon={<ShieldCheck className="size-4" />} title="Venta protegida">
            Solo a través de la plataforma: retiene el pago y se lo entrega al vendedor después de la venta.
          </Step>
        </div>

        <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busca por nombre o número (89.30)" className="pl-9" aria-label="Buscar en Canales en venta" />
          </div>
          <div className="w-full sm:w-60">
            <Select value={filters.orden} onChange={(event) => visit({ orden: event.target.value })} aria-label="Ordenar">
              {sorts.map((sort) => (
                <option key={sort.value} value={sort.value}>
                  {sort.label}
                </option>
              ))}
            </Select>
          </div>
        </form>

        <p className="text-sm text-muted">
          {count(listings.total)} {listings.total === 1 ? "canal en venta" : "canales en venta"}
        </p>

        {listings.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.data.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Tag className="size-6" />}
            title={filters.q ? "No encontramos nada en venta con esa búsqueda" : "Todavía no hay canales en venta"}
            description="¿Tienes un canal? Puedes venderlo desde tu consola, en Canal › Vender canal."
          />
        )}
        <Pagination page={listings} />
      </div>
    </SiteLayout>
  );
}

function Step({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal">{icon}</span>
      <span className="space-y-0.5">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-muted">{children}</span>
      </span>
    </div>
  );
}
