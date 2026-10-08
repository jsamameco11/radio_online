import { ShieldCheck, Users } from "lucide-react";
import { AreaChart } from "@/Components/analytics/area-chart";
import { BarList } from "@/Components/analytics/bar-list";
import { dayLabel } from "@/Components/analytics/day-label";
import { RangeTabs } from "@/Components/studio/range-tabs";
import { Avatar } from "@/Components/ui/avatar";
import { EmptyState } from "@/Components/ui/empty-state";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel, Stat } from "@/Components/ui/panel";
import StudioLayout from "@/Layouts/StudioLayout";
import { count, dateTime } from "@/lib/format";
import type { AudienceSummary, FollowerDay, TopFollower } from "@/types/station-admin";

interface Props {
  range: number;
  ranges: number[];
  summary: AudienceSummary;
  countries: { code: string | null; name: string; sessions: number; hours: number }[];
  devices: { device: string | null; sessions: number }[];
  growth: FollowerDay[];
  topFollowers: TopFollower[];
}

const DEVICES: Record<string, string> = { mobile: "Celular", desktop: "Computadora", tablet: "Tablet", tv: "TV", car: "Auto", speaker: "Parlante" };

export default function Audience({ range, ranges, summary, countries, devices, growth, topFollowers }: Props) {
  return (
    <StudioLayout title="Audiencia">
      <div className="space-y-6">
        <PageHeader eyebrow="Análisis" title="Audiencia" description="Quiénes te escuchan, desde dónde y cómo crece tu comunidad." actions={<RangeTabs range={range} ranges={ranges} />} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Suscriptores"
            value={count(summary.followers)}
            hint={`+${count(summary.new_followers)} en ${range} días${summary.pending_followers > 0 ? ` · ${count(summary.pending_followers)} en verificación` : ""}`}
          />
          <Stat label="Oyentes únicos" value={count(summary.listeners)} />
          <Stat label="Países" value={count(countries.filter((country) => country.code).length)} />
        </div>

        <div className="flex gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-signal" />
          <p className="text-muted">
            <span className="font-medium text-ink">Solo cuentan personas reales.</span> Una suscripción suma cuando la cuenta ya escuchó la plataforma unos minutos y no es recién creada; mientras tanto queda en
            verificación. Los oyentes se cuentan una vez por cuenta y los bots o reproductores automáticos no suman. Comprar suscriptores o audiencia no sirve: se detecta y se descarta.
          </p>
        </div>

        <Panel title="Crecimiento de suscriptores">
          <AreaChart ariaLabel="Suscriptores acumulados" tone="text-onair" points={growth.map((day) => ({ label: dayLabel(day.day), value: day.total }))} format={(value) => `${count(value)} suscriptores`} />
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Países">
            {countries.length === 0 ? (
              <p className="text-sm text-muted">Sin datos en este periodo.</p>
            ) : (
              <BarList items={countries.map((country) => ({ key: country.code ?? "none", label: country.name, value: country.sessions, hint: `${country.hours} h` }))} format={(value) => `${count(value)} sesiones`} />
            )}
          </Panel>
          <Panel title="Dispositivos">
            {devices.length === 0 ? (
              <p className="text-sm text-muted">Sin datos en este periodo.</p>
            ) : (
              <BarList tone="bg-info" items={devices.map((device) => ({ key: device.device ?? "none", label: device.device ? (DEVICES[device.device] ?? device.device) : "Sin dato", value: device.sessions }))} format={(value) => `${count(value)} sesiones`} />
            )}
          </Panel>
        </div>

        <Panel title="Suscriptores más fieles" description="Quienes más te escucharon en el periodo." padded={topFollowers.length === 0}>
          {topFollowers.length === 0 ? (
            <EmptyState icon={<Users className="size-6" />} title="Todavía no tienes suscriptores" />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {topFollowers.map((follower, index) => (
                <li key={follower.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-5 text-xs text-faint tabular">{index + 1}</span>
                  <Avatar name={follower.name} src={follower.avatar_url} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{follower.name}</span>
                    <span className="text-xs text-muted">Te sigue desde {dateTime(follower.followed_at, { dateStyle: "medium" })}</span>
                  </span>
                  <span className="text-right text-xs text-muted tabular">
                    <span className="block text-sm font-semibold text-ink">{follower.hours} h</span>
                    {count(follower.sessions)} sesiones
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </StudioLayout>
  );
}
