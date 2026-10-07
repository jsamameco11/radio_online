import { Link, usePage } from "@inertiajs/react";
import { CheckCircle2, Circle, ExternalLink, Headphones, Heart, Timer, Users } from "lucide-react";
import { AreaChart } from "@/Components/analytics/area-chart";
import { dayLabel } from "@/Components/analytics/day-label";
import { FrequencyTitle, StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { TopicEditor } from "@/Components/studio/topic-editor";
import { Badge } from "@/Components/ui/badge";
import { Panel, Stat } from "@/Components/ui/panel";
import StudioLayout, { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { count, dateTime } from "@/lib/format";
import type { SharedProps, StationPermission } from "@/types";
import type { Broadcast } from "@/types/admin";
import type { AudienceDay, AudienceSummary } from "@/types/station-admin";

interface Props {
  summary: AudienceSummary | null;
  daily: AudienceDay[] | null;
  broadcasts: Broadcast[] | null;
  role: string | null;
  teamSize: number;
  listenUrl: string;
  pendingChange: { frequency: string; created_at: string } | null;
  checklist: { key: string; label: string; done: boolean; href: string; permission: StationPermission }[];
}

export default function StudioDashboard({ summary, daily, broadcasts, role, teamSize, listenUrl, pendingChange, checklist }: Props) {
  const { studio } = usePage<SharedProps>().props;
  const url = useStudioUrl();
  const can = useStudioCan();
  if (!studio) return null;
  const station = studio.station;
  const pending = checklist.filter((item) => !item.done && can(item.permission));

  return (
    <StudioLayout title="Resumen">
      <div className="space-y-6">
        <header className="flex flex-wrap items-center gap-4">
          <StationLogo station={station} size="md" />
          <div className="min-w-0 flex-1 space-y-1">
            <FrequencyTitle station={station} size="lg" />
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              <StreamStatusBadge status={station.stream_status.value} />
              {role && <span>{role}</span>}
              <span>{count(teamSize)} en el equipo</span>
              {station.status === "suspended" && <Badge tone="danger">Suspendida</Badge>}
            </div>
          </div>
          <a href={listenUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ExternalLink className="size-4" />
            Ver página pública
          </a>
        </header>

        {pendingChange && (
          <p className="rounded-2xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
            Pediste mudarte a {pendingChange.frequency} el {dateTime(pendingChange.created_at, { dateStyle: "medium" })}. Te avisaremos cuando se revise.
          </p>
        )}

        {summary && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Oyentes ahora" value={count(summary.listeners_now)} hint={`Pico de la semana: ${count(summary.peak_listeners)}`} icon={<Headphones className="size-4" />} />
            <Stat label="Horas escuchadas" value={count(summary.hours)} hint="Últimos 7 días" icon={<Timer className="size-4" />} />
            <Stat label="Oyentes únicos" value={count(summary.listeners)} hint={`${count(summary.sessions)} sesiones`} icon={<Users className="size-4" />} />
            <Stat label="Seguidores" value={count(summary.followers)} hint={`+${count(summary.new_followers)} esta semana`} icon={<Heart className="size-4" />} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {daily && (
              <Panel title="Horas escuchadas" description="Últimos 7 días" actions={<Link href={url("/estadisticas")} className="text-xs font-medium text-muted hover:text-ink">Ver estadísticas</Link>}>
                <AreaChart ariaLabel="Horas escuchadas por día" points={daily.map((day) => ({ label: dayLabel(day.day), value: day.hours }))} format={(value) => `${value} h`} />
              </Panel>
            )}
            {broadcasts && (
              <Panel title="Últimas transmisiones" padded={broadcasts.length === 0}>
                {broadcasts.length === 0 ? (
                  <p className="text-sm text-muted">Todavía no salieron al aire.</p>
                ) : (
                  <ul className="divide-y divide-line text-sm">
                    {broadcasts.map((broadcast) => (
                      <li key={broadcast.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{broadcast.title ?? "Sin título"}</span>
                          <span className="text-xs text-muted">
                            {broadcast.host ?? "Automático"} · {dateTime(broadcast.started_at)}
                          </span>
                        </span>
                        <span className="text-xs text-muted tabular">Pico {count(broadcast.peak_listeners)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
          </div>

          <div className="space-y-6">
            {can("console.operate") && <TopicEditor suggestions={station.hashtags ?? []} />}
            {pending.length > 0 && (
              <Panel title="Pon a punto tu radio">
                <ul className="space-y-2.5 text-sm">
                  {checklist
                    .filter((item) => can(item.permission))
                    .map((item) => (
                      <li key={item.key}>
                        <Link href={url(item.href)} className="flex items-center gap-2.5 hover:text-ink">
                          {item.done ? <CheckCircle2 className="size-4 text-onair" /> : <Circle className="size-4 text-faint" />}
                          <span className={item.done ? "text-muted line-through" : "text-ink"}>{item.label}</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </StudioLayout>
  );
}
