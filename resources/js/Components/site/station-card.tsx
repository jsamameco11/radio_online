import { Link } from "@inertiajs/react";
import { Headphones, Heart, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { ListenButton, usePlayer } from "@/Components/player";
import { Equalizer, FrequencyTitle, StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { count } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Station } from "@/types";

/** Artwork for stations without a cover: their accent color over the ink of the theme. */
export function stationArtwork(station: Pick<Station, "accent_color">): string {
  const accent = station.accent_color ?? "var(--signal)";
  return `radial-gradient(120% 100% at 0% 0%, ${accent}, transparent 72%), linear-gradient(135deg, var(--ink), color-mix(in oklab, var(--ink) 70%, var(--surface)))`;
}

/** A station tile: artwork, "89.30 FM · Name", broadcast state, topic and audience. */
export function StationCard({ station, className }: { station: Station; className?: string }) {
  const player = usePlayer();
  const playing = player.isCurrent(station) && player.state.status === "playing";

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_18px_40px_-24px_rgb(0_0_0/0.35)]",
        playing && "ring-2 ring-signal/60",
        className,
      )}
    >
      <div className="relative h-28" style={station.cover_url ? undefined : { background: stationArtwork(station) }}>
        {station.cover_url && <img src={station.cover_url} alt="" className="size-full object-cover" loading="lazy" />}
        <span className="absolute top-3 left-3 rounded-full bg-ink/60 px-2.5 py-1 font-display text-xs font-semibold text-surface tabular backdrop-blur">
          {station.frequency.display}
        </span>
        {station.stream_status.audible && (
          <span className="absolute top-3 right-3 rounded-full bg-surface/90 px-2 py-1 backdrop-blur">
            <StreamStatusBadge status={station.stream_status.value} />
          </span>
        )}
        <ListenButton
          station={station}
          compact
          className="absolute right-4 bottom-0 z-10 translate-y-1/2 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 pt-0">
        <StationLogo station={station} size="md" className="-mt-7 ring-4 ring-surface" />
        <Link href={`/radio/${station.frequency.slug}`} className="min-w-0 before:absolute before:inset-0 before:content-['']">
          <FrequencyTitle station={station} size="sm" className="text-[0.95rem]" />
        </Link>
        {station.current_topic ? (
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <MessageCircle className="mt-px size-3.5 shrink-0 text-signal" aria-hidden />
            <span className="line-clamp-2">{station.current_topic.title}</span>
          </p>
        ) : (
          station.tagline && <p className="line-clamp-2 text-xs text-muted">{station.tagline}</p>
        )}
        <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-faint tabular">
          {playing ? (
            <span className="flex items-center gap-1.5 font-medium text-signal">
              <Equalizer /> Sonando
            </span>
          ) : (
            <span className="flex items-center gap-1" title="Oyentes ahora">
              <Headphones className="size-3.5" aria-hidden /> {count(station.listener_count, true)}
            </span>
          )}
          <span className="flex items-center gap-1" title="Suscriptores">
            <Heart className="size-3.5" aria-hidden /> {count(station.follower_count, true)}
          </span>
          {station.categories?.[0] && <span className="ml-auto truncate">{station.categories[0].name}</span>}
        </div>
      </div>
    </article>
  );
}

/** A compact line for lists: logo, identity and listen control. */
export function StationRow({ station, meta }: { station: Station; meta?: ReactNode }) {
  return (
    <div className="relative flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-line-strong">
      <StationLogo station={station} size="sm" />
      <span className="min-w-0 flex-1 space-y-0.5">
        <Link href={`/radio/${station.frequency.slug}`} className="block before:absolute before:inset-0 before:content-['']">
          <FrequencyTitle station={station} size="sm" />
        </Link>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <StreamStatusBadge status={station.stream_status.value} />
          {meta}
        </span>
      </span>
      <ListenButton station={station} compact className="relative z-10 size-9" />
    </div>
  );
}

export function StationGrid({ stations }: { stations: Station[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {stations.map((station) => (
        <StationCard key={station.id} station={station} />
      ))}
    </div>
  );
}
