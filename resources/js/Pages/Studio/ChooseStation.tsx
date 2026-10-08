import { Head, Link, usePage } from "@inertiajs/react";
import { ArrowRight, ExternalLink, Headphones, Mic2, Users } from "lucide-react";
import { UserMenu } from "@/Components/shell/user-menu";
import { BrandMark, BrandName } from "@/Components/site/brand";
import { SiteFlash } from "@/Components/site/site-flash";
import { FrequencyTitle, StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { Badge } from "@/Components/ui/badge";
import { buttonClasses } from "@/Components/ui/button";
import { count } from "@/lib/format";
import type { SharedProps, Station } from "@/types";

interface Props {
  stations: { station: Station; role: string; listen_url: string }[];
  createUrl: string;
}

/** Home of the creators' console: every station this user works on, one click from its studio. */
export default function ChooseStation({ stations, createUrl }: Props) {
  const { auth } = usePage<SharedProps>().props;
  const firstName = auth.user?.name.split(" ")[0] ?? "";

  return (
    <div className="theme-dark min-h-screen bg-canvas text-ink">
      <Head title="Consola de creadores" />
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span>
              <BrandName className="block" />
              <span className="block text-xs text-muted">Consola de creadores</span>
            </span>
          </Link>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 pt-12 pb-20 sm:px-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.2em] text-signal uppercase">Hola, {firstName}</p>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">¿A qué estudio entras hoy?</h1>
          <p className="max-w-xl text-muted">Cada canal tiene su propia consola en vivo, programación, biblioteca, chat y ganancias.</p>
        </div>

        {stations.length === 0 ? (
          <section className="flex flex-col items-center gap-5 rounded-3xl border border-dashed border-line px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-signal-soft text-signal">
              <Mic2 className="size-6" />
            </span>
            <div className="space-y-2">
              <h2 className="font-display text-xl font-semibold">Todavía no formas parte de ningún canal</h2>
              <p className="max-w-md text-sm text-muted">Solicita tu propio canal o pide al equipo de uno que te invite: su estudio aparecerá aquí.</p>
            </div>
            <a href={createUrl} className={buttonClasses("primary")}>
              <Mic2 className="size-4" /> Obtén tu canal
            </a>
          </section>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {stations.map(({ station, role, listen_url }) => (
              <li key={station.id} className="group flex flex-col rounded-3xl border border-line bg-surface transition hover:border-line-strong">
                <Link href={`/${station.frequency.slug}`} className="flex flex-1 items-start gap-4 p-5">
                  <StationLogo station={station} size="md" />
                  <span className="min-w-0 flex-1 space-y-2">
                    <FrequencyTitle station={station} />
                    <span className="flex flex-wrap items-center gap-2">
                      <StreamStatusBadge status={station.stream_status.value} />
                      <Badge tone="signal">{role}</Badge>
                      {station.status === "suspended" && <Badge tone="danger">Suspendida</Badge>}
                    </span>
                    {station.tagline && <span className="line-clamp-2 block text-sm text-muted">{station.tagline}</span>}
                  </span>
                  <ArrowRight className="mt-1 size-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-4" /> {count(station.follower_count, true)} suscriptores
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Headphones className="size-4" /> {count(station.listener_count, true)} oyentes ahora
                  </span>
                  <a href={listen_url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 hover:text-ink">
                    Ver como oyente <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <div className="fixed right-4 bottom-4 z-50">
        <SiteFlash />
      </div>
    </div>
  );
}
