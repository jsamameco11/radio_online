import { History as HistoryIcon } from "lucide-react";
import { StationRow } from "@/Components/site/station-card";
import { ButtonLink } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Stat } from "@/Components/ui/panel";
import SiteLayout from "@/Layouts/SiteLayout";
import { count, dateTime, duration } from "@/lib/format";
import type { Paginated } from "@/types";
import type { ListeningEntry } from "@/types/site";

function dayOf(iso: string): string {
  return dateTime(iso, { weekday: "long", day: "numeric", month: "long" });
}

function listened(seconds: number): string {
  if (seconds < 60) return "menos de un minuto";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.floor(seconds / 3600)} h ${Math.round((seconds % 3600) / 60)} min`;
}

export default function History({ sessions, totals }: { sessions: Paginated<ListeningEntry>; totals: { seconds: number; stations: number } }) {
  const days = sessions.data.reduce<{ day: string; entries: ListeningEntry[] }[]>((groups, entry) => {
    const day = dayOf(entry.started_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
    return groups;
  }, []);

  return (
    <SiteLayout title="Historial">
      <div className="space-y-8">
        <PageHeader eyebrow="Tu actividad" title="Historial de escucha" description="Los canales que escuchaste, del más reciente al más antiguo." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat label="Tiempo escuchado" value={listened(totals.seconds)} />
          <Stat label="Canales distintos" value={count(totals.stations)} />
        </div>
        {days.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon className="size-6" />}
            title="Todavía no escuchaste ninguna radio"
            description="Cuando sintonices una radio aparecerá aquí."
            action={<ButtonLink href="/dial">Abrir el dial</ButtonLink>}
          />
        ) : (
          days.map((group) => (
            <section key={group.day} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted first-letter:uppercase">{group.day}</h2>
              <div className="space-y-2">
                {group.entries.map((entry) => (
                  <StationRow
                    key={entry.id}
                    station={entry.station}
                    meta={
                      <span className="tabular">
                        {dateTime(entry.started_at, { timeStyle: "short" })} · {duration(entry.seconds)}
                      </span>
                    }
                  />
                ))}
              </div>
            </section>
          ))
        )}
        <Pagination page={sessions} />
      </div>
    </SiteLayout>
  );
}
