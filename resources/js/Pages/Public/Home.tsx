import { Link, usePage } from "@inertiajs/react";
import { ArrowRight, Disc3, Flame, LayoutGrid, Mic2, Podcast, Radio, Sparkles } from "lucide-react";
import { ListenButton } from "@/Components/player";
import { EpisodeTile } from "@/Components/site/episode-card";
import { HashtagChip } from "@/Components/site/hashtag-chip";
import { Section } from "@/Components/site/section";
import { StationGrid, stationArtwork } from "@/Components/site/station-card";
import { StationRating } from "@/Components/site/station-rating";
import { FrequencyTitle, StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { StoriesRail } from "@/Components/stories/stories-rail";
import { ButtonLink } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import SiteLayout from "@/Layouts/SiteLayout";
import { count } from "@/lib/format";
import type { SharedProps, Station } from "@/types";
import type { CategoryCard, EpisodeCard, TrendingHashtag } from "@/types/site";

interface HomeProps {
  onAir: Station[];
  popular: Station[];
  trending: TrendingHashtag[];
  categories: CategoryCard[];
  episodes: EpisodeCard[];
  stats: { stations: number; on_air: number; free_frequencies: number };
}

function Spotlight({ station }: { station: Station }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] text-surface" style={{ background: stationArtwork(station) }}>
      {station.cover_url && <img src={station.cover_url} alt="" className="absolute inset-0 size-full object-cover opacity-40" />}
      <div className="relative flex h-full flex-col gap-5 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <StationLogo station={station} size="md" className="ring-2 ring-surface/30" />
          <span className="rounded-full bg-surface/95 px-2.5 py-1">
            <StreamStatusBadge status={station.stream_status.value} />
          </span>
        </div>
        <div className="space-y-2">
          <FrequencyTitle station={station} size="lg" className="text-surface [&_.text-faint]:text-surface/60 [&_.text-muted]:text-surface/70" />
          {station.current_topic ? (
            <p className="text-sm text-surface/85">Ahora: {station.current_topic.title}</p>
          ) : (
            station.tagline && <p className="text-sm text-surface/85">{station.tagline}</p>
          )}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-3">
          <ListenButton station={station} size="lg" />
          <Link href={`/radio/${station.frequency.slug}`} className="text-sm font-medium text-surface/85 underline-offset-4 hover:underline">
            Ver la radio
          </Link>
          <span className="ml-auto flex items-center gap-3 text-xs text-surface/80 tabular">
            <span>
              {count(station.listener_count)} {station.listener_count === 1 ? "persona conectada" : "personas conectadas"}
            </span>
            <StationRating station={station} compact className="text-surface/80" />
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Home({ onAir, popular, trending, categories, episodes, stats }: HomeProps) {
  const { auth } = usePage<SharedProps>().props;
  const firstName = auth.user?.name.split(" ")[0];
  const [spotlight, ...restOnAir] = onAir;

  return (
    <SiteLayout title="Inicio">
      <div className="space-y-14">
        <StoriesRail className="-mb-8" />
        <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-stretch">
          <div className="flex flex-col justify-between gap-8 rounded-[2rem] border border-line bg-surface p-6 sm:p-10">
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full bg-signal-soft px-3 py-1 text-xs font-semibold text-signal">
                <span className="size-1.5 rounded-full bg-signal animate-onair" aria-hidden />
                {count(stats.on_air)} radios al aire ahora
              </p>
              <h1 className="font-display text-4xl leading-[1.05] font-semibold text-ink sm:text-5xl">
                {firstName ? `Hola, ${firstName}.` : "Hola."} <span className="text-muted">¿Qué sintonizamos hoy?</span>
              </h1>
              <p className="max-w-lg text-muted">
                Cada radio tiene su frecuencia en el dial. Busca un número, un tema o un estilo y empieza a escuchar al instante.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/dial" size="lg" icon={<Disc3 className="size-5" />}>
                Girar el dial
              </ButtonLink>
              <ButtonLink href="/en-vivo" size="lg" variant="secondary" icon={<Radio className="size-5" />}>
                Ver qué suena
              </ButtonLink>
            </div>
            <dl className="grid grid-cols-3 gap-4 border-t border-line pt-6">
              <div>
                <dt className="text-xs text-muted">Radios</dt>
                <dd className="font-display text-2xl font-semibold tabular">{count(stats.stations)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Al aire</dt>
                <dd className="font-display text-2xl font-semibold text-signal tabular">{count(stats.on_air)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Frecuencias libres</dt>
                <dd className="font-display text-2xl font-semibold tabular">{count(stats.free_frequencies)}</dd>
              </div>
            </dl>
          </div>
          {spotlight ? (
            <Spotlight station={spotlight} />
          ) : (
            <EmptyState icon={<Radio className="size-6" />} title="Ninguna radio está al aire ahora" description="Explora el catálogo y sigue tus favoritas para no perderte su próxima transmisión." />
          )}
        </section>

        {trending.length > 0 && (
          <Section title="Tendencias" icon={<Flame className="size-5 text-signal" />} description="Los temas que suenan ahora en el dial.">
            <div className="flex flex-wrap gap-2">
              {trending.map((tag) => (
                <HashtagChip key={tag.slug} name={tag.name} live={tag.on_air > 0} hint={tag.on_air > 0 ? `${tag.on_air} al aire` : undefined} />
              ))}
            </div>
          </Section>
        )}

        {restOnAir.length > 0 && (
          <Section title="Al aire ahora" href="/en-vivo" description="Locutores en vivo y programación sonando en este momento.">
            <StationGrid stations={restOnAir} />
          </Section>
        )}

        {categories.length > 0 && (
          <Section title="Categorías destacadas" href="/categorias" icon={<LayoutGrid className="size-5 text-muted" />}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {categories.map((category, index) => (
                <Link
                  key={category.id}
                  href={`/categorias/${category.slug}`}
                  className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 transition hover:border-line-strong hover:bg-raised"
                >
                  <span className="absolute -top-3 -right-1 font-display text-6xl font-bold text-line tabular transition group-hover:text-line-strong" aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="relative block text-xs text-muted">{category.group}</span>
                  <span className="relative mt-1 block font-display text-lg font-semibold">{category.name}</span>
                  <span className="relative mt-3 block text-xs text-faint tabular">
                    {category.station_count} {category.station_count === 1 ? "radio" : "radios"}
                  </span>
                </Link>
              ))}
            </div>
          </Section>
        )}

        <Section title="Las más seguidas" href="/explorar?orden=followers" icon={<Sparkles className="size-5 text-gold" />}>
          {popular.length > 0 ? (
            <StationGrid stations={popular} />
          ) : (
            <EmptyState icon={<Radio className="size-6" />} title="Aún no hay radios publicadas" description="Sé la primera persona en tener su frecuencia." />
          )}
        </Section>

        {episodes.length > 0 && (
          <Section title="Episodios recientes" icon={<Podcast className="size-5 text-info" />} description="Programas grabados para escuchar cuando quieras.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {episodes.map((episode) => (
                <EpisodeTile key={episode.id} episode={episode} />
              ))}
            </div>
          </Section>
        )}

        <section className="relative overflow-hidden rounded-[2rem] bg-ink p-8 text-surface sm:p-12">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 items-center justify-end gap-2 pr-10 opacity-30 md:flex" aria-hidden>
            {Array.from({ length: 24 }, (_, index) => (
              <span key={index} className="w-1 rounded-full bg-surface" style={{ height: `${20 + ((index * 37) % 60)}%` }} />
            ))}
          </div>
          <div className="relative max-w-xl space-y-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-signal uppercase">Tu propia frecuencia</p>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Quedan {count(stats.free_frequencies)} frecuencias libres en el dial.</h2>
            <p className="text-surface/70">Elige la tuya, transmite en vivo desde tu navegador con un estudio profesional y gana dinero por hacerlo.</p>
            <ButtonLink href="/obten-tu-frecuencia" variant="signal" size="lg" icon={<Mic2 className="size-5" />}>
              Obtén tu frecuencia <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
