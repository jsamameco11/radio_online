import { Deferred, Link, usePage } from "@inertiajs/react";
import { AlertTriangle, Flag, Headphones, Inbox, Radio, RadioTower, Users, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { AuditList } from "@/Components/admin/audit-list";
import { frequencyDotClasses } from "@/Components/admin/status-tones";
import { AreaChart } from "@/Components/analytics/area-chart";
import { ColumnChart } from "@/Components/analytics/column-chart";
import { dayLabel } from "@/Components/analytics/day-label";
import { FrequencyTitle, StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { ButtonLink } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel, Stat } from "@/Components/ui/panel";
import { Skeleton, SkeletonRows } from "@/Components/ui/skeleton";
import AdminLayout from "@/Layouts/AdminLayout";
import { ago, count, money } from "@/lib/format";
import type { SharedProps, StreamStatusValue } from "@/types";
import type { AuditEntry, FrequencyStatusValue, PlatformDay, StationRow } from "@/types/admin";

interface Props {
  kpis: {
    stations: number;
    stations_active: number;
    stations_suspended: number;
    on_air: number;
    live: number;
    listeners_now: number;
    users: number;
    users_this_week: number;
    pending_requests: number;
    open_reports: number;
    gifts_today: { count: number; revenue_cents: number; fee_cents: number } | null;
  };
  dial: { total: number; capacity: number; by_status: { status: FrequencyStatusValue; label: string; total: number }[] };
  alerts: { maintenance: number; stale_requests: number };
  /** Deferred ("charts"). */
  series?: PlatformDay[];
  /** Deferred ("activity"). */
  topStations?: StationRow[];
  /** Deferred ("activity"). */
  troubled?: TroubledStation[];
  /** Deferred ("activity"); null without access to the audit. */
  audit?: AuditEntry[] | null;
}

interface TroubledStation {
  id: number;
  display_name: string;
  slug: string;
  stream_status: StreamStatusValue;
  stream_status_label: string;
  last_heartbeat_at: string | null;
}

export default function Dashboard({ kpis, dial, alerts, series = [], topStations = [], troubled = [], audit = null }: Props) {
  const { app, auth } = usePage<SharedProps>().props;
  const can = (permission: string) => Boolean(auth.user?.permissions.includes(permission));
  const allClear = alerts.maintenance === 0 && alerts.stale_requests === 0 && kpis.pending_requests === 0 && kpis.open_reports === 0;

  return (
    <AdminLayout title="Resumen">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Plataforma"
          title="Resumen"
          description="Cómo está el dial ahora mismo y cómo vienen las últimas dos semanas."
          actions={can("streams.monitor") && <ButtonLink href="/admin/monitor" variant="secondary" icon={<RadioTower className="size-4" />}>Abrir monitor</ButtonLink>}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Al aire" value={count(kpis.on_air)} hint={`${count(kpis.live)} en vivo · ${count(kpis.stations_active)} radios activas`} icon={<Radio className="size-4" />} />
          <Stat label="Oyentes ahora" value={count(kpis.listeners_now)} hint="Suma de todas las radios al aire" icon={<Headphones className="size-4" />} />
          <Stat label="Usuarios" value={count(kpis.users)} hint={`+${count(kpis.users_this_week)} en los últimos 7 días`} icon={<Users className="size-4" />} />
          {kpis.gifts_today ? (
            <Stat
              label="Regalos hoy"
              value={money(kpis.gifts_today.revenue_cents, app.currency)}
              hint={`${count(kpis.gifts_today.count)} regalos · comisión ${money(kpis.gifts_today.fee_cents, app.currency)}`}
            />
          ) : (
            <Stat label="Radios" value={count(kpis.stations)} hint={`${count(kpis.stations_suspended)} suspendidas`} />
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Horas escuchadas" description="Últimos 14 días, en toda la plataforma" className="lg:col-span-2">
            <Deferred data="series" fallback={<Skeleton className="h-48" />}>
              <AreaChart
                ariaLabel="Horas escuchadas por día"
                points={series.map((day) => ({ label: dayLabel(day.day), value: day.hours }))}
                format={(value) => `${value.toLocaleString("es-PE")} h`}
              />
            </Deferred>
          </Panel>
          <Panel title="Nuevas cuentas" description="Registros por día">
            <Deferred data="series" fallback={<Skeleton className="h-48" />}>
              <ColumnChart ariaLabel="Registros por día" points={series.map((day) => ({ label: dayLabel(day.day), value: day.signups }))} tone="fill-info" />
            </Deferred>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel
            title="El dial"
            description={`${count(dial.total)} frecuencias de ${count(dial.capacity)} posibles en la banda`}
            actions={can("frequencies.view") && <Link href="/admin/frecuencias" className="text-xs font-medium text-muted hover:text-ink">Ver frecuencias</Link>}
          >
            <div className="flex h-3 overflow-hidden rounded-full bg-raised">
              {dial.by_status
                .filter((item) => item.total > 0)
                .map((item) => (
                  <span key={item.status} className={frequencyDotClasses[item.status]} style={{ width: `${(item.total / Math.max(1, dial.total)) * 100}%` }} title={`${item.label}: ${item.total}`} />
                ))}
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {dial.by_status.map((item) => (
                <li key={item.status} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted">
                    <span className={`size-2.5 rounded-full ${frequencyDotClasses[item.status]}`} />
                    {item.label}
                  </span>
                  <span className="font-medium tabular">{count(item.total)}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Requiere atención" className="lg:col-span-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <AttentionLink href="/admin/solicitudes" icon={<Inbox className="size-4" />} label="Solicitudes pendientes" value={kpis.pending_requests} hint={alerts.stale_requests > 0 ? `${alerts.stale_requests} con más de 48 h` : undefined} enabled={can("frequency_requests.review")} />
              <AttentionLink href="/admin/moderacion" icon={<Flag className="size-4" />} label="Reportes abiertos" value={kpis.open_reports} enabled={can("moderation.manage")} />
              <AttentionLink href="/admin/frecuencias?status=maintenance" icon={<Wrench className="size-4" />} label="En mantenimiento" value={alerts.maintenance} enabled={can("frequencies.view")} />
            </div>
            <Deferred data="troubled" fallback={<Skeleton className="mt-4 h-10" />}>
              <TroubledList stations={troubled} allClear={allClear} />
            </Deferred>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Más escuchadas ahora" padded={topStations.length === 0}>
            <Deferred data="topStations" fallback={<SkeletonRows />}>
              {topStations.length === 0 ? (
                <EmptyState icon={<Radio className="size-6" />} title="No hay radios al aire" description="Cuando una radio salga al aire aparecerá aquí." />
              ) : (
                <ul className="divide-y divide-line">
                  {topStations.map((station) => (
                    <li key={station.id}>
                      <Link href={`/admin/radios/${station.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-raised">
                        <StationLogo station={station} size="sm" />
                        <span className="min-w-0 flex-1 space-y-0.5">
                          <FrequencyTitle station={station} size="sm" />
                          <StreamStatusBadge status={station.stream_status.value} />
                        </span>
                        <span className="text-right text-sm font-semibold tabular">
                          {count(station.listener_count)}
                          <span className="block text-xs font-normal text-muted">oyentes</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Deferred>
          </Panel>

          {can("audit.view") && (
            <Panel title="Actividad reciente" actions={<Link href="/admin/auditoria" className="text-xs font-medium text-muted hover:text-ink">Ver auditoría</Link>}>
              <Deferred data="audit" fallback={<SkeletonRows />}>
                <AuditList entries={audit ?? []} />
              </Deferred>
            </Panel>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function TroubledList({ stations, allClear }: { stations: TroubledStation[]; allClear: boolean }) {
  if (stations.length === 0) {
    return allClear ? <p className="mt-4 text-sm text-muted">Todo en orden: ninguna radio con fallas.</p> : null;
  }

  return (
    <ul className="mt-4 divide-y divide-line rounded-xl border border-danger/30 bg-danger-soft/40">
      {stations.map((station) => (
        <li key={station.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-danger" />
            <Link href={`/admin/radios/${station.id}`} className="truncate font-medium hover:underline">
              {station.display_name}
            </Link>
          </span>
          <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
            <StreamStatusBadge status={station.stream_status} />
            {station.last_heartbeat_at ? `Última señal ${ago(station.last_heartbeat_at)}` : "Sin señal"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AttentionLink({ href, icon, label, value, hint, enabled }: { href: string; icon: ReactNode; label: string; value: number; hint?: string; enabled: boolean }) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-xs font-medium text-muted">
        {icon}
        {label}
      </span>
      <span className={`mt-1 block font-display text-2xl font-semibold tabular ${value > 0 ? "text-ink" : "text-faint"}`}>{count(value)}</span>
      {hint && <span className="text-xs text-warning">{hint}</span>}
    </>
  );

  return enabled ? (
    <Link href={href} className="rounded-xl border border-line p-4 transition hover:bg-raised">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border border-line p-4">{body}</div>
  );
}
