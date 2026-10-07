import { Link, router, usePage } from "@inertiajs/react";
import { Ban, Check, EyeOff, Flag, X } from "lucide-react";
import { useState } from "react";
import { ReasonModal } from "@/Components/admin/reason-modal";
import { PageErrors } from "@/Components/forms/page-errors";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Select } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import AdminLayout from "@/Layouts/AdminLayout";
import { ago, dateTime } from "@/lib/format";
import type { Paginated, SharedProps } from "@/types";
import type { Option, ReportRow } from "@/types/admin";

type Tab = "open" | "resolved" | "dismissed";

interface Props {
  reports: Paginated<ReportRow>;
  tab: Tab;
  type: string;
  counts: Record<Tab, number>;
  types: Option[];
}

type Pending = { report: ReportRow; action: "resolved" | "dismissed" | "suspend" };

export default function ModerationIndex({ reports, tab, type, counts, types }: Props) {
  const { auth } = usePage<SharedProps>().props;
  const canSuspend = Boolean(auth.user?.permissions.includes("stations.suspend"));
  const [pending, setPending] = useState<Pending | null>(null);

  const visit = (next: { tab?: Tab; type?: string }) =>
    router.get("/admin/moderacion", Object.fromEntries(Object.entries({ tab, type, ...next }).filter(([, value]) => value)), { preserveState: true, replace: true });

  return (
    <AdminLayout title="Moderación">
      <div className="space-y-6">
        <PageHeader eyebrow="Comunidad" title="Moderación" description="Reportes de oyentes sobre radios, episodios y mensajes de regalo. Al cerrar un reporte se cierran todos los del mismo contenido." />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={tab}
            onChange={(value) => visit({ tab: value })}
            items={[
              { value: "open", label: "Abiertos", count: counts.open },
              { value: "resolved", label: "Resueltos", count: counts.resolved },
              { value: "dismissed", label: "Descartados", count: counts.dismissed },
            ]}
          />
          <Select value={type} onChange={(event) => visit({ type: event.target.value })} className="w-52" aria-label="Tipo de contenido">
            <option value="">Todo el contenido</option>
            {types.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>

        {!pending && <PageErrors />}

        {reports.data.length === 0 ? (
          <EmptyState icon={<Flag className="size-6" />} title={tab === "open" ? "No hay reportes abiertos" : "Nada por aquí"} description={tab === "open" ? "La comunidad está tranquila." : undefined} />
        ) : (
          <div className="space-y-3">
            {reports.data.map((report) => (
              <Panel key={report.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warning">{report.reason_label}</Badge>
                      <Badge>{report.target.type_label}</Badge>
                      {report.target.hidden && <Badge tone="neutral">Oculto</Badge>}
                      <span className="text-xs text-muted">
                        {report.reporter?.name ?? "Cuenta eliminada"} · {ago(report.created_at)}
                      </span>
                    </div>
                    <p className="font-medium text-ink">{report.target.title}</p>
                    {report.target.excerpt && <p className="max-w-3xl rounded-xl bg-raised px-3 py-2 text-sm text-muted">{report.target.excerpt}</p>}
                    {report.details && <p className="text-sm text-ink">“{report.details}”</p>}
                    {report.target.station && (
                      <p className="text-xs text-muted">
                        Radio:{" "}
                        <Link href={`/admin/radios/${report.target.station.id}`} className="text-ink hover:underline">
                          {report.target.station.display_name}
                        </Link>
                        {report.target.station.status === "suspended" && <Badge tone="danger" className="ml-2">Suspendida</Badge>}
                      </p>
                    )}
                    {report.resolved_at && (
                      <p className="text-xs text-muted">
                        {report.status_label} por {report.resolver?.name ?? "—"} el {dateTime(report.resolved_at)}
                        {report.resolution_note && <span className="mt-1 block text-ink">“{report.resolution_note}”</span>}
                      </p>
                    )}
                  </div>
                  {tab === "open" && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {report.target.type === "gift_message" && !report.target.hidden && (
                        <Button variant="secondary" size="sm" icon={<EyeOff className="size-3.5" />} onClick={() => router.post(`/admin/moderacion/${report.id}/ocultar-mensaje`, {}, { preserveScroll: true })}>
                          Ocultar mensaje
                        </Button>
                      )}
                      {canSuspend && report.target.station && report.target.station.status !== "suspended" && (
                        <Button variant="danger" size="sm" icon={<Ban className="size-3.5" />} onClick={() => setPending({ report, action: "suspend" })}>
                          Suspender radio
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" icon={<X className="size-3.5" />} onClick={() => setPending({ report, action: "dismissed" })}>
                        Descartar
                      </Button>
                      <Button size="sm" icon={<Check className="size-3.5" />} onClick={() => setPending({ report, action: "resolved" })}>
                        Resolver
                      </Button>
                    </div>
                  )}
                </div>
              </Panel>
            ))}
            <Pagination page={reports} />
          </div>
        )}
      </div>

      {pending?.action === "suspend" && (
        <ReasonModal
          open
          onClose={() => setPending(null)}
          title={`Suspender ${pending.report.target.station?.display_name ?? "la radio"}`}
          description="La radio sale del aire y se cierran todos los reportes de este contenido."
          url={`/admin/moderacion/${pending.report.id}/suspender-radio`}
          confirmLabel="Suspender radio"
        />
      )}
      {(pending?.action === "resolved" || pending?.action === "dismissed") && (
        <ReasonModal
          key={pending.action}
          open
          onClose={() => setPending(null)}
          title={pending.action === "resolved" ? "Resolver reporte" : "Descartar reporte"}
          description={pending.action === "resolved" ? "Usa resolver cuando tomaste una medida sobre el contenido." : "Usa descartar cuando el contenido no infringe las normas."}
          url={`/admin/moderacion/${pending.report.id}/resolver`}
          field="note"
          label="Nota interna"
          required={false}
          variant="primary"
          confirmLabel={pending.action === "resolved" ? "Resolver" : "Descartar"}
          extra={{ outcome: pending.action }}
        />
      )}
    </AdminLayout>
  );
}
