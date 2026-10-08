import { Link } from "@inertiajs/react";
import { Clock3, Podcast } from "lucide-react";
import { FrequencyTitle } from "@/Components/station/station-identity";
import { dateTime, duration } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Station } from "@/types";
import type { EpisodeCard as Episode } from "@/types/site";
import { stationArtwork } from "./station-card";

export function episodeUrl(station: Pick<Station, "frequency">, episode: Pick<Episode, "id">): string {
  return `/radio/${station.frequency.slug}/episodios/${episode.id}`;
}

function airedOn(episode: Episode): string {
  return dateTime(`${episode.aired_on}T12:00:00`, { dateStyle: "medium" });
}

function EpisodeCover({ episode, station, className }: { episode: Episode; station: Station; className?: string }) {
  const cover = episode.cover_url ?? station.cover_url;
  return cover ? (
    <img src={cover} alt="" className={cn("shrink-0 object-cover", className)} loading="lazy" />
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center text-surface", className)} style={{ background: stationArtwork(station) }} aria-hidden>
      <Podcast className="size-1/3" />
    </span>
  );
}

/** An episode tile for grids; `station` falls back to the one embedded in the episode. */
export function EpisodeTile({ episode, station }: { episode: Episode; station?: Station }) {
  const owner = station ?? episode.station;
  if (!owner) return null;

  return (
    <Link href={episodeUrl(owner, episode)} className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-surface transition hover:border-line-strong">
      <EpisodeCover episode={episode} station={owner} className="aspect-[16/9] w-full" />
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <FrequencyTitle station={owner} size="sm" className="text-xs text-muted" />
        <p className="line-clamp-2 font-medium text-ink group-hover:underline">{episode.title}</p>
        <p className="mt-auto flex items-center gap-2 pt-1 text-xs text-faint tabular">
          <Clock3 className="size-3.5" aria-hidden /> {duration(episode.duration)} · {airedOn(episode)}
        </p>
      </div>
    </Link>
  );
}

/** An episode line for lists inside a station page. */
export function EpisodeRow({ episode, station, active = false }: { episode: Episode; station: Station; active?: boolean }) {
  return (
    <Link
      href={episodeUrl(station, episode)}
      className={cn("flex items-center gap-4 rounded-2xl border p-3 transition", active ? "border-ink bg-raised" : "border-line bg-surface hover:border-line-strong")}
      aria-current={active ? "page" : undefined}
    >
      <EpisodeCover episode={episode} station={station} className="size-16 rounded-xl" />
      <span className="min-w-0 flex-1 space-y-1">
        {episode.program && <span className="block truncate text-xs font-medium tracking-wide text-signal uppercase">{episode.program}</span>}
        <span className="line-clamp-2 block text-sm font-medium text-ink">{episode.title}</span>
        {episode.description && <span className="line-clamp-2 block text-xs text-muted">{episode.description}</span>}
        <span className="flex items-center gap-2 text-xs text-faint tabular">
          {episode.season !== null && episode.number !== null && <span>T{episode.season} · E{episode.number}</span>}
          <span>{duration(episode.duration)}</span>
          <span>{airedOn(episode)}</span>
        </span>
      </span>
    </Link>
  );
}
