import { Link, router } from "@inertiajs/react";
import { Radio, Search } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { FrequencyTitle, StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Input, Select } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel } from "@/Components/ui/panel";
import AdminLayout from "@/Layouts/AdminLayout";
import { count, dateTime } from "@/lib/format";
import type { Paginated } from "@/types";
import type { Option, StationRow } from "@/types/admin";

interface Filters {
  q: string;
  status: string;
  stream: string;
  category: string;
  sort: string;
}

interface Props {
  stations: Paginated<StationRow>;
  filters: Filters;
  statuses: Option[];
  streams: Option[];
  categories: Option[];
}

const SORTS = [
  { value: "frecuencia", label: "Por frecuencia" },
  { value: "oyentes", label: "Más oyentes ahora" },
  { value: "suscriptores", label: "Más suscriptores" },
  { value: "recientes", label: "Más recientes" },
];

export default function StationsIndex({ stations, filters, statuses, streams, categories }: Props) {
  const [values, setValues] = useState(filters);

  const apply = (next: Filters) => {
    setValues(next);
    router.get("/admin/radios", Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== "" && !(key === "sort" && value === "frecuencia"))), {
      preserveState: true,
      replace: true,
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    apply(values);
  };

  return (
    <AdminLayout title="Radios">
      <div className="space-y-6">
        <PageHeader eyebrow="Plataforma" title="Radios" description={`${count(stations.total)} radios con estos filtros.`} />

        <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input value={values.q} onChange={(event) => setValues({ ...values, q: event.target.value })} placeholder="Nombre, frecuencia o correo del propietario" className="pl-9" aria-label="Buscar radios" />
          </div>
          <Select value={values.status} onChange={(event) => apply({ ...values, status: event.target.value })} className="w-40" aria-label="Estado">
            <option value="">Todo estado</option>
            {statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Select value={values.stream} onChange={(event) => apply({ ...values, stream: event.target.value })} className="w-44" aria-label="Transmisión">
            <option value="">Toda transmisión</option>
            {streams.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Select value={values.category} onChange={(event) => apply({ ...values, category: event.target.value })} className="w-44" aria-label="Categoría">
            <option value="">Toda categoría</option>
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Select value={values.sort} onChange={(event) => apply({ ...values, sort: event.target.value })} className="w-48" aria-label="Orden">
            {SORTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>

        <Panel padded={false}>
          {stations.data.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Radio className="size-6" />} title="Ninguna radio coincide" description="Prueba con otros filtros." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">Radio</th>
                    <th className="px-5 py-3 font-medium">Propietario</th>
                    <th className="px-5 py-3 font-medium">Transmisión</th>
                    <th className="px-5 py-3 text-right font-medium">Oyentes</th>
                    <th className="px-5 py-3 text-right font-medium">Suscriptores</th>
                    <th className="px-5 py-3 font-medium">Alta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {stations.data.map((station) => (
                    <tr key={station.id} className="hover:bg-raised/60">
                      <td className="px-5 py-3">
                        <Link href={`/admin/radios/${station.id}`} className="flex items-center gap-3">
                          <StationLogo station={station} size="xs" />
                          <span className="min-w-0">
                            <FrequencyTitle station={station} size="sm" className="hover:underline" />
                            {station.status === "suspended" && (
                              <Badge tone="danger" className="ml-2">
                                {station.status_label}
                              </Badge>
                            )}
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <span className="block">{station.owner.name}</span>
                        <span className="text-xs text-muted">{station.owner.email}</span>
                      </td>
                      <td className="px-5 py-3">
                        <StreamStatusBadge status={station.stream_status.value} />
                      </td>
                      <td className="px-5 py-3 text-right tabular">{count(station.listener_count)}</td>
                      <td className="px-5 py-3 text-right tabular">{count(station.follower_count)}</td>
                      <td className="px-5 py-3 text-xs text-muted">{dateTime(station.created_at, { dateStyle: "medium" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-line px-5 py-3 empty:hidden">
            <Pagination page={stations} />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  );
}
