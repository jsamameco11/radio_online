import { Link, router } from "@inertiajs/react";
import { BadgeCheck, Check, Headphones, Inbox, Users, X } from "lucide-react";
import { useState } from "react";
import { ReasonModal } from "@/Components/admin/reason-modal";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel, Stat } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import AdminLayout from "@/Layouts/AdminLayout";
import { ago, count, dateTime } from "@/lib/format";
import type { Paginated } from "@/types";
import type { MonetizationRequestRow, MonetizationRequestStatus } from "@/types/growth";

interface Props {
  tab: MonetizationRequestStatus;
  counts: Record<MonetizationRequestStatus, number>;
  monetizedStations: number;
  requests: Paginated<MonetizationRequestRow>;
}

const day = (date: string) => dateTime(`${date}T12:00:00`, { weekday: "short", day: "numeric", month: "short" });

export default function MonetizationIndex({ tab, counts, monetizedStations, requests }: Props) {
  const [approving, setApproving] = useState<MonetizationRequestRow | null>(null);
  const [rejecting, setRejecting] = useState<MonetizationRequestRow | null>(null);

  return (
    <AdminLayout title="Monetización">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Finanzas"
          title="Solicitudes de monetización"
          description="Radios que alcanzaron los suscriptores y la audiencia en vivo del programa. Al aprobar, la radio obtiene la distinción de Radio monetizada."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Por revisar" value={count(counts.pending)} icon={<Inbox className="size-4" />} />
          <Stat label="Radios monetizadas" value={count(monetizedStations)} icon={<BadgeCheck className="size-4" />} />
          <Stat label="Rechazadas" value={count(counts.rejected)} icon={<X className="size-4" />} />
        </div>

        <Tabs
          value={tab}
          onChange={(value) => router.get("/admin/monetizacion", value === "pending" ? {} : { tab: value }, { preserveState: true, replace: true })}
          items={[
            { value: "pending", label: "Pendientes", count: counts.pending },
            { value: "approved", label: "Aprobadas", count: counts.approved },
            { value: "rejected", label: "Rechazadas", count: counts.rejected },
          ]}
        />

        {requests.data.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6" />}
            title={tab === "pending" ? "No hay solicitudes pendientes" : "Nada por aquí"}
            description={tab === "pending" ? "Cuando una radio cumpla los requisitos y lo solicite, aparecerá aquí." : undefined}
          />
        ) : (
          <div className="space-y-3">
            {requests.data.map((item) => (
              <Panel key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-semibold">{item.station?.display_name}</span>
                      {tab !== "pending" && <Badge tone={item.status.value === "approved" ? "gold" : "neutral"}>{item.status.label}</Badge>}
                    </div>
                    <p className="text-xs text-muted">
                      {item.station?.owner ? `${item.station.owner.name} · ${item.station.owner.email} · ` : ""}
                      enviada {ago(item.created_at)}
                      {item.requester ? ` por ${item.requester}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-6 text-sm">
                      <span className="inline-flex items-center gap-2">
                        <Users className="size-4 text-onair" aria-hidden />
                        <span>
                          <span className="font-semibold tabular">{count(item.snapshot.subscribers)}</span> suscriptores al solicitar
                          <span className="text-muted"> (hoy {count(item.station?.follower_count ?? 0)} · meta {count(item.snapshot.min_subscribers)})</span>
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Headphones className="size-4 text-signal" aria-hidden />
                        {item.snapshot.qualifying_days.length} días seguidos con {count(item.snapshot.live_listeners)}+ oyentes
                      </span>
                    </div>
                    {item.snapshot.qualifying_days.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.snapshot.qualifying_days.map((qualifying) => (
                          <Badge key={qualifying.date} tone="signal">
                            {day(qualifying.date)} · pico {count(qualifying.peak)}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {item.reviewed_at && (
                      <p className="text-xs text-muted">
                        Revisada por {item.reviewer ?? "—"} el {dateTime(item.reviewed_at)}
                        {item.review_note && <span className="mt-1 block text-ink">“{item.review_note}”</span>}
                      </p>
                    )}
                    {item.station && (
                      <Link href={`/admin/radios/${item.station.id}`} className="inline-block text-xs font-medium text-muted hover:text-ink">
                        Ver la radio →
                      </Link>
                    )}
                  </div>
                  {item.status.value === "pending" && (
                    <div className="flex gap-2">
                      <Button variant="ghost" icon={<X className="size-4" />} onClick={() => setRejecting(item)}>
                        Rechazar
                      </Button>
                      <Button icon={<Check className="size-4" />} onClick={() => setApproving(item)}>
                        Aprobar
                      </Button>
                    </div>
                  )}
                </div>
              </Panel>
            ))}
            <Pagination page={requests} />
          </div>
        )}
      </div>

      {approving && (
        <ReasonModal
          open
          onClose={() => setApproving(null)}
          title={`Aprobar ${approving.station?.display_name ?? "la radio"}`}
          description="La radio obtiene la distinción de Radio monetizada y su propietario recibe un correo."
          url={`/admin/monetizacion/${approving.id}/aprobar`}
          field="note"
          label="Nota para el propietario"
          required={false}
          variant="primary"
          confirmLabel="Aprobar monetización"
        />
      )}
      {rejecting && (
        <ReasonModal
          open
          onClose={() => setRejecting(null)}
          title={`Rechazar ${rejecting.station?.display_name ?? "la solicitud"}`}
          description="El propietario recibirá esta nota por correo y podrá volver a solicitarla en unos días."
          url={`/admin/monetizacion/${rejecting.id}/rechazar`}
          field="note"
          label="Motivo"
          confirmLabel="Rechazar solicitud"
        />
      )}
    </AdminLayout>
  );
}
