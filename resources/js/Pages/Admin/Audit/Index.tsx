import { router } from "@inertiajs/react";
import { History } from "lucide-react";
import type { FormEvent } from "react";
import { Fragment, useState } from "react";
import { actionLabel } from "@/Components/admin/audit-list";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Input, Select } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel } from "@/Components/ui/panel";
import AdminLayout from "@/Layouts/AdminLayout";
import { dateTime } from "@/lib/format";
import type { Paginated } from "@/types";
import type { AuditEntry } from "@/types/admin";

interface Filters {
  actor: string;
  action: string;
  station: string;
  from: string;
  to: string;
}

interface Props {
  logs: Paginated<AuditEntry>;
  filters: Filters;
  actions: string[];
  areas: string[];
}

const EMPTY: Filters = { actor: "", action: "", station: "", from: "", to: "" };

export default function AuditIndex({ logs, filters, actions, areas }: Props) {
  const [values, setValues] = useState(filters);
  const [open, setOpen] = useState<number | null>(null);

  const apply = (next: Filters) => {
    setValues(next);
    router.get("/admin/auditoria", Object.fromEntries(Object.entries(next).filter(([, value]) => value !== "")), { preserveState: true, replace: true });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    apply(values);
  };

  return (
    <AdminLayout title="Auditoría">
      <div className="space-y-6">
        <PageHeader eyebrow="Seguridad" title="Auditoría" description="Registro inalterable de las acciones sensibles: quién, qué, sobre qué radio, cuándo y desde dónde." />

        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Input value={values.actor} onChange={(event) => setValues({ ...values, actor: event.target.value })} placeholder="Quién (nombre o correo)" aria-label="Quién" className="lg:col-span-2" />
          <Select value={values.action} onChange={(event) => apply({ ...values, action: event.target.value })} aria-label="Acción">
            <option value="">Toda acción</option>
            <optgroup label="Por área">
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}*
                </option>
              ))}
            </optgroup>
            <optgroup label="Acción exacta">
              {actions.map((action) => (
                <option key={action} value={action}>
                  {actionLabel(action)}
                </option>
              ))}
            </optgroup>
          </Select>
          <Input value={values.station} onChange={(event) => setValues({ ...values, station: event.target.value })} placeholder="Radio o frecuencia" aria-label="Radio" />
          <Input type="date" value={values.from} onChange={(event) => setValues({ ...values, from: event.target.value })} aria-label="Desde" />
          <Input type="date" value={values.to} onChange={(event) => setValues({ ...values, to: event.target.value })} aria-label="Hasta" />
          <div className="flex gap-2 lg:col-span-6">
            <Button type="submit" variant="secondary">
              Filtrar
            </Button>
            {Object.values(values).some(Boolean) && (
              <Button variant="ghost" onClick={() => apply(EMPTY)}>
                Limpiar
              </Button>
            )}
          </div>
        </form>

        <Panel padded={false}>
          {logs.data.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<History className="size-6" />} title="Sin registros con estos filtros" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">Cuándo</th>
                    <th className="px-5 py-3 font-medium">Quién</th>
                    <th className="px-5 py-3 font-medium">Acción</th>
                    <th className="px-5 py-3 font-medium">Radio</th>
                    <th className="px-5 py-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {logs.data.map((log) => (
                    <Fragment key={log.id}>
                      <tr className="cursor-pointer hover:bg-raised/60" onClick={() => setOpen(open === log.id ? null : log.id)}>
                        <td className="px-5 py-3 text-xs whitespace-nowrap text-muted">{dateTime(log.created_at, { dateStyle: "short", timeStyle: "medium" })}</td>
                        <td className="px-5 py-3">
                          {log.actor ? (
                            <>
                              <span className="block">{log.actor.name}</span>
                              <span className="text-xs text-muted">{log.actor.email}</span>
                            </>
                          ) : (
                            <span className="text-muted">Sistema</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className="block">{actionLabel(log.action)}</span>
                          <code className="text-xs text-faint">{log.action}</code>
                        </td>
                        <td className="px-5 py-3 text-xs">{log.station ? `${log.station.frequency} · ${log.station.name}` : "—"}</td>
                        <td className="px-5 py-3 text-xs text-muted tabular">{log.ip_address ?? "—"}</td>
                      </tr>
                      {open === log.id && (
                        <tr className="bg-raised/40">
                          <td colSpan={5} className="px-5 py-3">
                            <dl className="grid gap-2 text-xs sm:grid-cols-2">
                              <div>
                                <dt className="text-muted">Sobre</dt>
                                <dd className="text-ink">{log.subject ? `${log.subject.type} #${log.subject.id}` : "—"}</dd>
                              </div>
                              <div>
                                <dt className="text-muted">Navegador</dt>
                                <dd className="truncate text-ink">{log.user_agent ?? "—"}</dd>
                              </div>
                              <div className="sm:col-span-2">
                                <dt className="text-muted">Detalle</dt>
                                <dd>
                                  <pre className="overflow-x-auto text-ink">{JSON.stringify(log.meta ?? {}, null, 2)}</pre>
                                </dd>
                              </div>
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-line px-5 py-3 empty:hidden">
            <Pagination page={logs} />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  );
}
