import { Link, router } from "@inertiajs/react";
import { Maximize2, RadioTower, Search } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { frequencyDotClasses, frequencyTones } from "@/Components/admin/status-tones";
import { StreamStatusBadge } from "@/Components/station/station-identity";
import { Badge } from "@/Components/ui/badge";
import { Button, ButtonLink } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Input, Select } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel } from "@/Components/ui/panel";
import AdminLayout from "@/Layouts/AdminLayout";
import { cn } from "@/lib/cn";
import { count, dateTime } from "@/lib/format";
import type { Paginated, StreamStatusValue } from "@/types";
import type { DialSegment, FrequencyStatusValue, Option } from "@/types/admin";

interface FrequencyRow {
  id: number;
  label: string;
  slug: string;
  display: string;
  status: FrequencyStatusValue;
  status_label: string;
  reserved_at: string | null;
  activated_at: string | null;
  station: { id: number; name: string; owner: string; stream_status: StreamStatusValue; listeners: number } | null;
}

interface Props {
  frequencies: Paginated<FrequencyRow>;
  filters: { status: string; min: string; max: string; q: string };
  statuses: (Option<FrequencyStatusValue> & { total: number })[];
  dial: DialSegment[];
  band: { min: number; max: number };
  canExpand: boolean;
}

/** The dial map and the status totals do not change with the filters. */
const FILTERED = ["frequencies", "filters"];

export default function FrequenciesIndex({ frequencies, filters, statuses, dial, band, canExpand }: Props) {
  const [values, setValues] = useState(filters);
  const total = statuses.reduce((sum, status) => sum + status.total, 0);

  const apply = (next: typeof values) => {
    setValues(next);
    router.get("/admin/frecuencias", Object.fromEntries(Object.entries(next).filter(([, value]) => value !== "")), { only: FILTERED, preserveState: true, preserveScroll: true, replace: true });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    apply(values);
  };

  return (
    <AdminLayout title="Frecuencias">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Dial"
          title="Frecuencias"
          description={`${count(total)} frecuencias virtuales entre ${band.min.toFixed(2)} y ${band.max.toFixed(2)} FM. Reserva, asigna, libera o pon en mantenimiento.`}
          actions={
            canExpand && (
              <ButtonLink href="/admin/frecuencias/ampliar" variant="secondary" icon={<Maximize2 className="size-4" />}>
                Ampliar el dial
              </ButtonLink>
            )
          }
        />

        <Panel title="Mapa del dial" description="Haz clic en un tramo para filtrar por ese rango.">
          <DialStrip dial={dial} band={band} onPick={(min, max) => apply({ ...values, min, max })} />
          <div className="mt-4 flex flex-wrap gap-2">
            <FilterChip active={values.status === ""} onClick={() => apply({ ...values, status: "" })} label="Todas" total={total} />
            {statuses.map((status) => (
              <FilterChip
                key={status.value}
                active={values.status === status.value}
                onClick={() => apply({ ...values, status: status.value })}
                label={status.label}
                total={status.total}
                dot={frequencyDotClasses[status.value]}
              />
            ))}
          </div>
        </Panel>

        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input value={values.q} onChange={(event) => setValues({ ...values, q: event.target.value })} placeholder="Buscar 95.5 o el nombre de una radio" className="pl-9" aria-label="Buscar" />
          </div>
          <Input value={values.min} onChange={(event) => setValues({ ...values, min: event.target.value })} placeholder="Desde" inputMode="decimal" className="w-28" aria-label="Desde (MHz)" />
          <Input value={values.max} onChange={(event) => setValues({ ...values, max: event.target.value })} placeholder="Hasta" inputMode="decimal" className="w-28" aria-label="Hasta (MHz)" />
          <Select value={values.status} onChange={(event) => apply({ ...values, status: event.target.value })} className="w-44" aria-label="Estado">
            <option value="">Todos los estados</option>
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          {(values.q || values.min || values.max || values.status) && (
            <Button variant="ghost" onClick={() => apply({ status: "", min: "", max: "", q: "" })}>
              Limpiar
            </Button>
          )}
        </form>

        <Panel padded={false}>
          {frequencies.data.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<RadioTower className="size-6" />} title="Ninguna frecuencia coincide" description="Prueba con otro rango o estado." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">Frecuencia</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 font-medium">Radio</th>
                    <th className="px-5 py-3 text-right font-medium">Oyentes</th>
                    <th className="px-5 py-3 font-medium">Desde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {frequencies.data.map((frequency) => (
                    <tr key={frequency.id} className="hover:bg-raised/60">
                      <td className="px-5 py-3">
                        <Link href={`/admin/frecuencias/${frequency.slug}`} className="font-display font-semibold tabular hover:underline">
                          {frequency.display}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={frequencyTones[frequency.status]}>{frequency.status_label}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        {frequency.station ? (
                          <span className="space-y-0.5">
                            <Link href={`/admin/radios/${frequency.station.id}`} className="block font-medium hover:underline">
                              {frequency.station.name}
                            </Link>
                            <span className="flex items-center gap-2 text-xs text-muted">
                              <StreamStatusBadge status={frequency.station.stream_status} />· {frequency.station.owner}
                            </span>
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right tabular">{frequency.station ? count(frequency.station.listeners) : "—"}</td>
                      <td className="px-5 py-3 text-xs text-muted">
                        {frequency.activated_at ? dateTime(frequency.activated_at, { dateStyle: "medium" }) : frequency.reserved_at ? `Reservada ${dateTime(frequency.reserved_at, { dateStyle: "medium" })}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-line px-5 py-3 empty:hidden">
            <Pagination page={frequencies} />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  );
}

function FilterChip({ active, onClick, label, total, dot }: { active: boolean; onClick: () => void; label: string; total: number; dot?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-medium ring-1 transition",
        active ? "bg-primary text-on-primary ring-primary" : "bg-surface text-ink ring-line hover:bg-raised",
      )}
    >
      {dot && <span className={cn("size-2.5 rounded-full", dot)} />}
      {label}
      <span className={cn("tabular", active ? "opacity-80" : "text-muted")}>{count(total)}</span>
    </button>
  );
}

/** The band split in equal ranges; each range is colored by how its frequencies are used. */
function DialStrip({ dial, band, onPick }: { dial: DialSegment[]; band: { min: number; max: number }; onPick: (min: string, max: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex h-12 items-end gap-0.5">
        {dial.map((segment) => (
          <button
            key={segment.from}
            type="button"
            onClick={() => onPick(segment.from.toFixed(2), segment.to.toFixed(2))}
            title={`${segment.from.toFixed(2)}–${segment.to.toFixed(2)} · ${segment.total} frecuencias, ${segment.on_air} activas, ${segment.total - segment.used} libres`}
            className="group relative flex h-full flex-1 flex-col justify-end overflow-hidden rounded-sm bg-raised hover:ring-2 hover:ring-ink"
          >
            <span className="w-full bg-info/60" style={{ height: `${segment.total ? ((segment.used - segment.on_air) / segment.total) * 100 : 0}%` }} />
            <span className="w-full bg-onair" style={{ height: `${segment.total ? (segment.on_air / segment.total) * 100 : 0}%` }} />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[0.7rem] text-faint tabular">
        <span>{band.min.toFixed(2)}</span>
        <span>{((band.min + band.max) / 2).toFixed(2)}</span>
        <span>{band.max.toFixed(2)}</span>
      </div>
    </div>
  );
}
