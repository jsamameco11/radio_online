import { Link } from "@inertiajs/react";
import { Podcast } from "lucide-react";
import { LiveChat } from "@/Components/chat/live-chat";
import { GiftLauncher } from "@/Components/gifts/gift-launcher";
import { usePlayer } from "@/Components/player";
import { EpisodeRow } from "@/Components/site/episode-card";
import { EpisodePlayer } from "@/Components/site/episode-player";
import { HashtagChip } from "@/Components/site/hashtag-chip";
import { StationRow } from "@/Components/site/station-card";
import { StationHero } from "@/Components/site/station-hero";
import { EmptyState } from "@/Components/ui/empty-state";
import { Pagination } from "@/Components/ui/pagination";
import { Panel } from "@/Components/ui/panel";
import SiteLayout from "@/Layouts/SiteLayout";
import { cn } from "@/lib/cn";
import { ago, dateTime } from "@/lib/format";
import type { Paginated, Station as StationData } from "@/types";
import type { ChatSnapshot } from "@/types/chat";
import type { EpisodeCard, StationContext } from "@/types/site";

interface StationProps extends StationContext {
  about: {
    description: string | null;
    language: string;
    country: string | null;
    peak_listener_count: number;
    went_live_at: string | null;
    created_at: string;
  };
  episodes: Paginated<EpisodeCard>;
  programs: string[];
  program: string | null;
  related: StationData[];
  chat: ChatSnapshot;
}

const languages: Record<string, string> = { es: "Español", en: "Inglés", pt: "Portugués", qu: "Quechua", ay: "Aimara", fr: "Francés", it: "Italiano" };

function countryName(code: string): string {
  return new Intl.DisplayNames(["es"], { type: "region" }).of(code) ?? code;
}

function NowOnAir({ station }: { station: StationData }) {
  const player = usePlayer();
  if (!player.isCurrent(station) || player.state.status !== "playing") return null;
  const { nowPlaying, live, liveTitle, next } = player.state;

  return (
    <Panel title="Sonando ahora">
      <div className="space-y-2 text-sm">
        <p className="font-medium text-ink">{live ? (liveTitle ?? "Transmisión en vivo") : (nowPlaying?.title ?? "Programación del canal")}</p>
        {!live && nowPlaying?.artist && <p className="text-muted">{nowPlaying.artist}</p>}
        {next && <p className="text-xs text-faint">Después: {next.title}</p>}
      </div>
    </Panel>
  );
}

export default function Station({ about, episodes, programs, program, related, chat, ...context }: StationProps) {
  const { station } = context;
  const latest = episodes.current_page === 1 ? episodes.data[0] : undefined;
  const rest = latest ? episodes.data.slice(1) : episodes.data;

  return (
    <SiteLayout title={station.display_name}>
      <div className="space-y-8">
        <StationHero context={context} peak={about.peak_listener_count} extra={<GiftLauncher station={context.station} />} />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="space-y-4" aria-labelledby="episodios">
            <h2 id="episodios" className="flex items-center gap-2 font-display text-xl font-semibold">
              <Podcast className="size-5 text-info" /> Episodios
            </h2>
            {programs.length > 0 && (
              <nav aria-label="Programas" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {[null, ...programs].map((name) => (
                  <Link
                    key={name ?? ""}
                    href={`/radio/${station.frequency.slug}${name ? `?programa=${encodeURIComponent(name)}` : ""}`}
                    only={["episodes", "program"]}
                    preserveScroll
                    preserveState
                    aria-current={name === program ? "true" : undefined}
                    className={cn(
                      "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap ring-1 transition",
                      name === program ? "bg-ink text-surface ring-ink" : "bg-surface text-muted ring-line hover:text-ink hover:ring-line-strong",
                    )}
                  >
                    {name ?? "Todos"}
                  </Link>
                ))}
              </nav>
            )}
            {episodes.total === 0 && program ? (
              <EmptyState icon={<Podcast className="size-6" />} title="Sin episodios de este programa" description="Elige otro programa o mira todos los episodios del canal." />
            ) : episodes.total === 0 ? (
              <EmptyState icon={<Podcast className="size-6" />} title="Todavía no hay episodios" description="Cuando el canal publique sus programas grabados, podrás escucharlos aquí cuando quieras." />
            ) : (
              <>
                {latest && (
                  <div className="space-y-3 rounded-3xl border border-line bg-surface p-4 sm:p-5">
                    <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Último episodio</p>
                    <Link href={`/radio/${station.frequency.slug}/episodios/${latest.id}`} className="block font-display text-lg font-semibold hover:underline">
                      {latest.title}
                    </Link>
                    <EpisodePlayer key={latest.id} episode={latest} />
                  </div>
                )}
                <div className="space-y-2">
                  {rest.map((episode) => (
                    <EpisodeRow key={episode.id} episode={episode} station={station} />
                  ))}
                </div>
                <Pagination page={episodes} />
              </>
            )}
          </section>

          <aside className={cn("space-y-4", chat.open && "order-first lg:order-none")}>
            <LiveChat key={station.id} station={station} initial={chat} reportReasons={context.reportReasons} />
            <NowOnAir station={station} />
            <Panel title="Acerca del canal">
              <div className="space-y-4 text-sm">
                {about.description ? <p className="whitespace-pre-line text-muted">{about.description}</p> : <p className="text-faint">Este canal aún no tiene descripción.</p>}
                {station.categories && station.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {station.categories.map((category) => (
                      <Link key={category.id} href={`/categorias/${category.slug}`} className="rounded-full bg-raised px-2.5 py-1 text-xs font-medium ring-1 ring-line hover:ring-ink">
                        {category.name}
                      </Link>
                    ))}
                  </div>
                )}
                {station.hashtags && station.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {station.hashtags.map((tag) => (
                      <HashtagChip key={tag} name={tag} className="py-0.5 text-xs" />
                    ))}
                  </div>
                )}
                <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
                  <div>
                    <dt className="text-faint">Idioma</dt>
                    <dd className="font-medium">{languages[about.language] ?? about.language.toUpperCase()}</dd>
                  </div>
                  {about.country && (
                    <div>
                      <dt className="text-faint">País</dt>
                      <dd className="font-medium">{countryName(about.country)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-faint">En el dial desde</dt>
                    <dd className="font-medium">{dateTime(about.created_at, { month: "long", year: "numeric" })}</dd>
                  </div>
                  {about.went_live_at && station.stream_status.value === "live" && (
                    <div>
                      <dt className="text-faint">En vivo</dt>
                      <dd className="font-medium">{ago(about.went_live_at)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </Panel>
            {related.length > 0 && (
              <Panel title="Radios parecidas" padded={false}>
                <div className="space-y-2 p-3">
                  {related.map((other) => (
                    <StationRow key={other.id} station={other} />
                  ))}
                </div>
              </Panel>
            )}
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
