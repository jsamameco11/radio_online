import { Camera, Headphones, Heart, Mic2, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { ListenButton, usePlayer } from "@/Components/player";
import { Equalizer, FrequencyTitle, StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { buttonClasses } from "@/Components/ui/button";
import { count } from "@/lib/format";
import type { StationContext } from "@/types/site";
import { HashtagChip } from "./hashtag-chip";
import { FollowButton, ReportButton, ShareButton } from "./station-actions";
import { stationArtwork } from "./station-card";
import { StationRating } from "./station-rating";

/** Header of the station and episode pages: artwork, identity, audience and actions. */
export function StationHero({ context, peak, extra }: { context: StationContext; peak?: number; extra?: ReactNode }) {
  const { station } = context;
  const player = usePlayer();
  const tunedHere = player.isCurrent(station) && player.state.status === "playing";
  const connected = tunedHere ? Math.max(player.state.listeners, station.listener_count) : station.listener_count;

  return (
    <header className="overflow-hidden rounded-[2rem] border border-line bg-surface">
      <div className="relative h-40 sm:h-56" style={station.cover_url ? undefined : { background: stationArtwork(station) }}>
        {station.cover_url && <img src={station.cover_url} alt={`Foto de portada de ${station.display_name}`} className="size-full object-cover" />}
        <span className="absolute top-4 right-4 rounded-full bg-surface/95 px-3 py-1.5 backdrop-blur">
          <StreamStatusBadge status={station.stream_status.value} />
        </span>
        {context.coverEditUrl && (
          <a
            href={context.coverEditUrl}
            className="absolute right-4 bottom-4 inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-semibold text-ink shadow-sm backdrop-blur transition-colors hover:bg-surface"
          >
            <Camera className="size-3.5" />
            {station.cover_url ? "Cambiar foto de portada" : "Agregar foto de portada"}
          </a>
        )}
      </div>
      <div className="space-y-5 px-5 pb-6 sm:px-8">
        <div className="-mt-12 flex flex-wrap items-end gap-5 sm:-mt-16">
          <StationLogo station={station} size="lg" className="relative z-10 shadow-xl ring-4 ring-surface sm:size-32 sm:rounded-[2rem]" />
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 pb-1">
            <ListenButton station={station} size="lg" />
            <FollowButton station={station} following={context.isFollowing} />
            <ShareButton title={station.display_name} url={context.shareUrl} />
            {extra}
            {context.studioUrl && (
              <a href={context.studioUrl} className={buttonClasses("ghost")}>
                <Mic2 className="size-4" /> Ir al estudio
              </a>
            )}
            <ReportButton url={`/radio/${station.frequency.slug}/reportar`} reasons={context.reportReasons} subject={station.display_name} />
          </div>
        </div>
        <div className="space-y-2">
          <h1>
            <FrequencyTitle station={station} size="xl" />
          </h1>
          {station.tagline && <p className="text-lg text-muted">{station.tagline}</p>}
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <div className="flex items-center gap-1.5">
            {tunedHere ? <Equalizer className="text-signal" /> : <Headphones className="size-4" />}
            <dt className="sr-only">Personas conectadas</dt>
            <dd className="tabular">
              <strong className="font-semibold text-ink">{count(connected)}</strong> {connected === 1 ? "persona conectada" : "personas conectadas"}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Heart className="size-4" />
            <dt className="sr-only">Suscriptores</dt>
            <dd className="tabular">
              <strong className="font-semibold text-ink">{count(station.follower_count)}</strong> {station.follower_count === 1 ? "suscriptor" : "suscriptores"}
            </dd>
          </div>
          {peak !== undefined && peak > 0 && (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="size-4" />
              <dt className="sr-only">Récord</dt>
              <dd className="tabular">récord de {count(peak)} oyentes</dd>
            </div>
          )}
        </dl>
        <StationRating station={station} mine={context.myRating} interactive />
        {station.current_topic && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-signal-soft px-4 py-3">
            <span className="text-xs font-bold tracking-[0.14em] text-signal uppercase">Ahora</span>
            <p className="font-medium text-ink">{station.current_topic.title}</p>
            <span className="flex flex-wrap gap-1.5">
              {station.current_topic.hashtags.map((tag) => (
                <HashtagChip key={tag} name={tag} live className="py-0.5 text-xs" />
              ))}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
