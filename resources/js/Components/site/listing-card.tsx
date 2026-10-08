import { Link } from "@inertiajs/react";
import { Heart, Podcast, RadioTower, Sparkles, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { FrequencyTitle, StationLogo } from "@/Components/station/station-identity";
import { count, money } from "@/lib/format";
import type { StationListing } from "@/types/marketplace";
import { stationArtwork } from "./station-card";
import { StationRating } from "./station-rating";

/** Something on sale: a station with its artwork, identity and what comes with it, or a free frequency of the dial; and the price. */
export function ListingCard({ listing }: { listing: StationListing }) {
  const { station } = listing;
  const href = `/frecuencias-en-venta/${listing.id}`;

  if (station === null) {
    return (
      <Card listing={listing}>
        <div className="relative flex h-28 items-center justify-center bg-gold-soft">
          <RadioTower className="absolute top-3 left-3 size-5 text-gold" aria-hidden />
          <Badge />
          <span className="font-display text-4xl font-bold text-ink tabular">
            {listing.frequency.label}
            <span className="ml-1 text-base font-semibold text-muted">{listing.frequency.band}</span>
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <Link href={href} className="min-w-0 font-display text-[0.95rem] font-semibold text-ink before:absolute before:inset-0 before:content-['']">
            Canal {listing.frequency.display}
          </Link>
          <p className="line-clamp-2 text-xs text-muted">{listing.pitch ?? "Un canal libre para abrir tu transmisión, con el nombre que elijas."}</p>
          <p className="flex items-center gap-1.5 text-xs text-faint">
            <Sparkles className="size-3.5" aria-hidden /> Incluye tu consola profesional
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card listing={listing}>
      <div className="relative h-28" style={station.cover_url ? undefined : { background: stationArtwork(station) }}>
        {station.cover_url && <img src={station.cover_url} alt="" className="size-full object-cover" loading="lazy" />}
        <span className="absolute top-3 left-3 rounded-full bg-ink/60 px-2.5 py-1 font-display text-xs font-semibold text-surface tabular backdrop-blur">
          {station.frequency.display}
        </span>
        <Badge />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 pt-0">
        <StationLogo station={station} size="md" className="-mt-7 ring-4 ring-surface" />
        <Link href={href} className="min-w-0 before:absolute before:inset-0 before:content-['']">
          <FrequencyTitle station={station} size="sm" className="text-[0.95rem]" />
        </Link>
        {(listing.pitch ?? station.tagline) && <p className="line-clamp-2 text-xs text-muted">{listing.pitch ?? station.tagline}</p>}
        <div className="flex items-center gap-3 text-xs text-faint tabular">
          <span className="flex items-center gap-1" title="Suscriptores">
            <Heart className="size-3.5" aria-hidden /> {count(station.follower_count, true)}
          </span>
          <span className="flex items-center gap-1" title="Episodios publicados">
            <Podcast className="size-3.5" aria-hidden /> {count(listing.episode_count, true)}
          </span>
          <StationRating station={station} compact />
          {station.categories?.[0] && <span className="ml-auto truncate">{station.categories[0].name}</span>}
        </div>
      </div>
    </Card>
  );
}

function Card({ listing, children }: { listing: StationListing; children: ReactNode }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_18px_40px_-24px_rgb(0_0_0/0.35)]">
      {children}
      <div className="mx-4 mt-auto mb-4 flex items-end justify-between gap-2 border-t border-line pt-3">
        <span>
          <span className="block text-[0.7rem] font-semibold tracking-[0.12em] text-faint uppercase">Precio</span>
          <span className="font-display text-xl font-bold text-ink tabular">{money(listing.price_cents, listing.currency)}</span>
        </span>
        <span className="text-sm font-semibold text-signal">Ver oferta →</span>
      </div>
    </article>
  );
}

function Badge() {
  return (
    <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-white">
      <Tag className="size-3" aria-hidden /> En venta
    </span>
  );
}
