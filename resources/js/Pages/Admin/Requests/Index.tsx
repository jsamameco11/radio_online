import { Link, router, useForm } from "@inertiajs/react";
import { AlertTriangle, Check, CreditCard, Inbox, Tag, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { ApprovalFields, approvalDefaults } from "@/Components/admin/approval-fields";
import { PaymentSummary, PricedApprovalForm, SettlePaymentModal, canCharge, chargesOnApproval } from "@/Components/admin/frequency-payment";
import { ReasonModal } from "@/Components/admin/reason-modal";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Select } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import AdminLayout from "@/Layouts/AdminLayout";
import { ago, dateTime } from "@/lib/format";
import type { Paginated } from "@/types";
import type { FreeFrequency, FrequencyRequestRow, Option } from "@/types/admin";
import type { FrequencyPaymentInfo } from "@/types/site";

type Tab = "pending" | "payment" | "approved" | "rejected";

interface Props {
  requests: Paginated<FrequencyRequestRow>;
  tab: Tab;
  kind: string;
  counts: Record<Tab, number>;
  kinds: Option[];
  freeFrequencies: FreeFrequency[];
  canSettlePayments: boolean;
}

export default function RequestsIndex({ requests, tab, kind, counts, kinds, freeFrequencies, canSettlePayments }: Props) {
  const [approving, setApproving] = useState<FrequencyRequestRow | null>(null);
  const [rejecting, setRejecting] = useState<FrequencyRequestRow | null>(null);
  const [settling, setSettling] = useState<(FrequencyRequestRow & { payment: FrequencyPaymentInfo }) | null>(null);

  const visit = (next: { tab?: Tab; kind?: string }) =>
    router.get("/admin/solicitudes", Object.fromEntries(Object.entries({ tab, kind, ...next }).filter(([, value]) => value)), { preserveState: true, replace: true });

  return (
    <AdminLayout title="Solicitudes">
      <div className="space-y-6">
        <PageHeader eyebrow="Dial" title="Solicitudes de frecuencia" description="Personas que quieren abrir su radio y radios que piden mudarse. Las más antiguas primero." />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={tab}
            onChange={(value) => visit({ tab: value })}
            items={[
              { value: "pending", label: "Pendientes", count: counts.pending },
              { value: "payment", label: "Pago pendiente", count: counts.payment },
              { value: "approved", label: "Aprobadas", count: counts.approved },
              { value: "rejected", label: "Rechazadas y retiradas", count: counts.rejected },
            ]}
          />
          <Select value={kind} onChange={(event) => visit({ kind: event.target.value })} className="w-56" aria-label="Tipo de solicitud">
            <option value="">Todos los tipos</option>
            {kinds.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>

        {requests.data.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6" />}
            title={tab === "pending" ? "No hay solicitudes pendientes" : tab === "payment" ? "Ningún pago pendiente" : "Nada por aquí"}
            description={
              tab === "pending"
                ? "Cuando alguien pida una frecuencia aparecerá aquí."
                : tab === "payment"
                  ? "Aquí aparecen las frecuencias con precio que aprobaste y cuyo cobro fue rechazado."
                  : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {requests.data.map((item) => (
              <Panel key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-semibold tabular">{item.frequency.display}</span>
                      <span className="text-faint">·</span>
                      <span className="font-semibold">{item.station ? item.station.display_name : item.station_name}</span>
                      <Badge tone={item.kind === "frequency_change" ? "info" : "neutral"}>{item.kind_label}</Badge>
                      {item.payment && (
                        <Badge tone="gold" className="tabular">
                          <Tag className="size-3" /> {item.payment.amount}
                        </Badge>
                      )}
                      {tab !== "pending" && <Badge tone={item.status === "approved" ? "onair" : item.status === "awaiting_payment" ? "warning" : "neutral"}>{item.status_label}</Badge>}
                    </div>
                    <p className="text-xs text-muted">
                      {item.user.name} · {item.user.email} · enviada {ago(item.created_at)}
                    </p>
                    {item.pitch && <p className="max-w-3xl text-sm whitespace-pre-line text-ink">{item.pitch}</p>}
                    {item.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.categories.map((category) => (
                          <Badge key={category}>{category}</Badge>
                        ))}
                      </div>
                    )}
                    {item.payment && item.status !== "cancelled" && item.status !== "rejected" && <PaymentSummary payment={item.payment} className="max-w-xl" />}
                    {item.conflict && (
                      <p className="flex items-center gap-2 text-sm text-warning">
                        <AlertTriangle className="size-4" />
                        {item.frequency.display} ya no está libre ({item.frequency.status_label.toLowerCase()}).{" "}
                        {item.payment && item.payment.status.value !== "paid" ? "Rechaza la solicitud: no se cobró nada." : "Aprueba con otra frecuencia."}
                      </p>
                    )}
                    {item.reviewed_at && (
                      <p className="text-xs text-muted">
                        Revisada por {item.reviewer?.name ?? "—"} el {dateTime(item.reviewed_at)}
                        {item.review_note && <span className="mt-1 block text-ink">“{item.review_note}”</span>}
                      </p>
                    )}
                    {item.kind === "new_station" && (
                      <Link href={`/admin/solicitudes/${item.id}/expediente`} className="text-sm font-semibold text-signal hover:underline">
                        Ver expediente completo →
                      </Link>
                    )}
                    {item.station && item.status === "approved" && (
                      <Link href={`/admin/radios/${item.station.id}`} className="text-xs font-medium text-muted hover:text-ink">
                        Ver la radio →
                      </Link>
                    )}
                  </div>
                  {(item.status === "pending" || item.status === "awaiting_payment") && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {item.payment?.status.value === "unconfirmed" && canSettlePayments && (
                        <Button variant="secondary" icon={<AlertTriangle className="size-4" />} onClick={() => setSettling({ ...item, payment: item.payment! })}>
                          Resolver cobro
                        </Button>
                      )}
                      {item.payment?.status.value !== "unconfirmed" && item.payment?.status.value !== "paid" && (
                        <Button variant="ghost" icon={<X className="size-4" />} onClick={() => setRejecting(item)}>
                          {item.status === "awaiting_payment" ? "Cerrar solicitud" : "Rechazar"}
                        </Button>
                      )}
                      {(item.status === "pending" || item.payment?.status.value === "paid") && item.payment?.status.value !== "unconfirmed" && (
                        <Button icon={chargesOnApproval(item) ? <CreditCard className="size-4" /> : <Check className="size-4" />} onClick={() => setApproving(item)}>
                          {chargesOnApproval(item) ? "Aprobar y cobrar" : "Aprobar"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Panel>
            ))}
            <Pagination page={requests} />
          </div>
        )}
      </div>

      {approving &&
        (chargesOnApproval(approving) ? (
          <PricedApproveModal item={approving} onClose={() => setApproving(null)} />
        ) : (
          <ApproveModal item={approving} free={freeFrequencies} onClose={() => setApproving(null)} />
        ))}
      {settling && <SettlePaymentModal request={settling} onClose={() => setSettling(null)} />}
      {rejecting && (
        <ReasonModal
          open
          onClose={() => setRejecting(null)}
          title={`Rechazar ${rejecting.station_name}`}
          description="La persona recibirá esta nota por correo."
          url={`/admin/solicitudes/${rejecting.id}/rechazar`}
          field="note"
          label="Nota para quien la envió"
          confirmLabel="Rechazar solicitud"
        />
      )}
    </AdminLayout>
  );
}

function PricedApproveModal({ item, onClose }: { item: FrequencyRequestRow & { payment: FrequencyPaymentInfo }; onClose: () => void }) {
  const [processing, setProcessing] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Aprobar ${item.station_name}`}
      description={`${item.frequency.display} tiene precio. Se cobrará a la tarjeta que registró ${item.user.name}; si el banco lo aprueba, la radio se crea al instante.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="approve-priced-request" disabled={!canCharge(item)} loading={processing} icon={<CreditCard className="size-4" />}>
            {processing ? "Cobrando…" : `Aprobar y cobrar ${item.payment.amount}`}
          </Button>
        </>
      }
    >
      <PricedApprovalForm request={item} formId="approve-priced-request" onSuccess={onClose} onProcessing={setProcessing} />
    </Modal>
  );
}

function ApproveModal({ item, free, onClose }: { item: FrequencyRequestRow; free: FreeFrequency[]; onClose: () => void }) {
  const form = useForm(approvalDefaults(item.frequency.label, item.conflict, free));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(`/admin/solicitudes/${item.id}/aprobar`, { preserveScroll: true, onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Aprobar ${item.station_name}`}
      description={item.kind === "frequency_change" ? "La radio se mudará a la nueva frecuencia y la anterior quedará libre." : "Se creará la radio y su propietario podrá entrar al estudio de inmediato."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="approve-request" loading={form.processing} disabled={form.data.frequency === ""}>
            Aprobar
          </Button>
        </>
      }
    >
      <form id="approve-request" onSubmit={submit} className="space-y-4">
        <ApprovalFields
          requestedLabel={item.frequency.label}
          requestedDisplay={item.frequency.display}
          conflict={item.conflict}
          free={free}
          frequency={form.data.frequency}
          note={form.data.note}
          errors={form.errors}
          onFrequency={(value) => form.setData("frequency", value)}
          onNote={(value) => form.setData("note", value)}
        />
      </form>
    </Modal>
  );
}
