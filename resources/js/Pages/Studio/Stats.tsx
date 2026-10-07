import { AreaChart } from "@/Components/analytics/area-chart";
import { ColumnChart } from "@/Components/analytics/column-chart";
import { dayLabel } from "@/Components/analytics/day-label";
import { Heatmap } from "@/Components/analytics/heatmap";
import { RangeTabs } from "@/Components/studio/range-tabs";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel, Stat } from "@/Components/ui/panel";
import StudioLayout from "@/Layouts/StudioLayout";
import { count, dateTime } from "@/lib/format";
import type { Broadcast } from "@/types/admin";
import type { AudienceDay, AudienceSummary } from "@/types/station-admin";

interface Props {
  range: number;
  ranges: number[];
  summary: AudienceSummary;
  daily: AudienceDay[];
  heatmap: number[][];
  broadcasts: Broadcast[];
}

export default function Stats({ range, ranges, summary, daily, heatmap, broadcasts }: Props) {
  return (
    <StudioLayout title="Estadísticas">
      <div className="space-y-6">
        <PageHeader eyebrow="Análisis" title="Estadísticas" description="Cuánto te escuchan y en qué momentos." actions={<RangeTabs range={range} ranges={ranges} />} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Horas escuchadas" value={count(summary.hours)} hint={`${count(summary.sessions)} sesiones`} />
          <Stat label="Oyentes únicos" value={count(summary.listeners)} hint="Con sesión iniciada" />
          <Stat label="Escucha promedio" value={`${summary.average_minutes} min`} hint="Por sesión" />
          <Stat label="Pico de oyentes" value={count(summary.peak_listeners)} hint={`Ahora: ${count(summary.listeners_now)}`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Horas escuchadas por día">
            <AreaChart ariaLabel="Horas escuchadas por día" points={daily.map((day) => ({ label: dayLabel(day.day), value: day.hours }))} format={(value) => `${value} h`} />
          </Panel>
          <Panel title="Sesiones por día">
            <ColumnChart ariaLabel="Sesiones por día" points={daily.map((day) => ({ label: dayLabel(day.day), value: day.sessions }))} format={(value) => `${count(value)} sesiones`} />
          </Panel>
        </div>

        <Panel title="Horas pico" description="Sesiones iniciadas por día de la semana y hora (hora de Lima).">
          <Heatmap matrix={heatmap} />
        </Panel>

        <Panel title="Transmisiones" padded={broadcasts.length === 0}>
          {broadcasts.length === 0 ? (
            <p className="text-sm text-muted">Sin transmisiones todavía.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">Programa</th>
                  <th className="px-5 py-3 font-medium">Inicio</th>
                  <th className="px-5 py-3 text-right font-medium">Pico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {broadcasts.map((broadcast) => (
                  <tr key={broadcast.id}>
                    <td className="px-5 py-3">
                      <span className="block font-medium">{broadcast.title ?? "Sin título"}</span>
                      <span className="text-xs text-muted">{broadcast.host ?? "Automático"}</span>
                    </td>
                    <td className="px-5 py-3 text-muted">{dateTime(broadcast.started_at)}</td>
                    <td className="px-5 py-3 text-right tabular">{count(broadcast.peak_listeners)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </StudioLayout>
  );
}
