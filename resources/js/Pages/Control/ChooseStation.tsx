import { Head, Link } from "@inertiajs/react";
import { ArrowRight, RadioTower } from "lucide-react";
import { UserMenu } from "@/Components/shell/user-menu";
import { EmptyState } from "@/Components/ui/empty-state";
import { FrequencyTitle, StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { ButtonLink } from "@/Components/ui/button";
import type { Station } from "@/types";

export default function ChooseStation({ stations, canOpenAdmin }: { stations: Station[]; canOpenAdmin: boolean }) {
  return (
    <div className="theme-dark min-h-screen bg-canvas text-ink">
      <Head title="Elige tu estudio" />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2.5 font-display font-semibold">
          <RadioTower className="size-5" /> Centro de control
        </span>
        <UserMenu />
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 pt-6 pb-20">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">¿A qué estudio entras hoy?</h1>
          <p className="text-muted">Cada emisora tiene su propia consola, programación y biblioteca.</p>
        </div>

        {stations.length === 0 ? (
          <EmptyState icon={<RadioTower className="size-6" />} title="Todavía no formas parte de ninguna emisora" description="Cuando el equipo de una radio te invite, aparecerá aquí." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {stations.map((station) => (
              <li key={station.id}>
                <Link
                  href={`/estudio/${station.frequency.slug}`}
                  className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 transition hover:border-line-strong hover:bg-raised"
                >
                  <StationLogo station={station} size="md" />
                  <span className="min-w-0 flex-1 space-y-1">
                    <FrequencyTitle station={station} />
                    <StreamStatusBadge status={station.stream_status.value} />
                  </span>
                  <ArrowRight className="size-5 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {canOpenAdmin && (
          <ButtonLink href="/admin" variant="secondary">
            Abrir el panel de la plataforma
          </ButtonLink>
        )}
      </main>
    </div>
  );
}
