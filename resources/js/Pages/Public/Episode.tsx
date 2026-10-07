import { Link } from "@inertiajs/react";
import { ArrowLeft, CalendarDays, Clock3 } from "lucide-react";
import { GiftLauncher } from "@/Components/gifts/gift-launcher";
import { EpisodeRow } from "@/Components/site/episode-card";
import { EpisodePlayer } from "@/Components/site/episode-player";
import { HashtagChip } from "@/Components/site/hashtag-chip";
import { ReportButton, ShareButton } from "@/Components/site/station-actions";
import { stationArtwork } from "@/Components/site/station-card";
import { FrequencyTitle, StationLogo } from "@/Components/station/station-identity";
import { Panel } from "@/Components/ui/panel";
import SiteLayout from "@/Layouts/SiteLayout";
import { dateTime, duration } from "@/lib/format";
import type { EpisodeCard, StationContext } from "@/types/site";

interface EpisodeProps extends StationContext {
  episode: EpisodeCard;
  more: EpisodeCard[];
}

export default function Episode({ episode, more, ...context }: EpisodeProps) {
  const { station } = context;
  const stationUrl = `/radio/${station.frequency.slug}`;
  const cover = episode.cover_url ?? station.cover_url;

  return (
    <SiteLayout title={`${episode.title} · ${station.display_name}`}>
      <div className="space-y-8">
        <Link href={stationUrl} className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Volver a {station.display_name}
        </Link>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <article className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-[12rem_1fr] sm:items-end">
              <div className="aspect-square overflow-hidden rounded-3xl" style={cover ? undefined : { background: stationArtwork(station) }}>
                {cover && <img src={cover} alt="" className="size-full object-cover" />}
              </div>
              <div className="space-y-3">
                <Link href={stationUrl} className="flex items-center gap-2.5">
                  <StationLogo station={station} size="xs" />
                  <FrequencyTitle station={station} size="sm" />
                </Link>
                {episode.program && <p className="text-xs font-semibold tracking-[0.14em] text-signal uppercase">{episode.program}</p>}
                <h1 className="font-display text-3xl font-semibold sm:text-4xl">{episode.title}</h1>
                <p className="flex flex-wrap items-center gap-4 text-sm text-muted tabular">
                  {episode.season !== null && episode.number !== null && (
                    <span>
                      Temporada {episode.season} · Episodio {episode.number}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-4" /> {dateTime(`${episode.aired_on}T12:00:00`, { dateStyle: "long" })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="size-4" /> {duration(episode.duration)}
                  </span>
                </p>
              </div>
            </div>

            <EpisodePlayer key={episode.id} episode={episode} />

            <div className="flex flex-wrap items-center gap-2">
              <GiftLauncher station={station} />
              <ShareButton title={`${episode.title} · ${station.display_name}`} url={`${context.shareUrl}/episodios/${episode.id}`} />
              <ReportButton url={`${stationUrl}/episodios/${episode.id}/reportar`} reasons={context.reportReasons} subject="este episodio" />
            </div>

            {episode.description && <p className="max-w-3xl whitespace-pre-line text-muted">{episode.description}</p>}
            {episode.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {episode.hashtags.map((tag) => (
                  <HashtagChip key={tag} name={tag} />
                ))}
              </div>
            )}
          </article>

          <aside>
            <Panel title={`Más de ${station.name}`} padded={false}>
              <div className="space-y-2 p-3">
                {more.length > 0 ? (
                  more.map((other) => <EpisodeRow key={other.id} episode={other} station={station} />)
                ) : (
                  <p className="px-2 py-4 text-sm text-muted">Este es el único episodio publicado por ahora.</p>
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
