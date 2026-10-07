import { Link, router, useForm } from "@inertiajs/react";
import { AlertTriangle, Check, Inbox, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { ReasonModal } from "@/Components/admin/reason-modal";
import { fieldError } from "@/Components/forms/field-error";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import AdminLayout from "@/Layouts/AdminLayout";
import { ago, dateTime } from "@/lib/format";
import type { Paginated } from "@/types";
import type { FrequencyRequestRow, Option } from "@/types/admin";

type Tab = "pending" | "approved" | "rejected";

interface Props {
  requests: Paginated<FrequencyRequestRow>;
  tab: Tab;
  kind: string;
  counts: Record<Tab, number>;
  kinds: Option[];
}

export default function RequestsIndex({ requests, tab, kind, counts, kinds }: Props) {
  const [approving, setApproving] = useState<FrequencyRequestRow | null>(null);
  const [rejecting, setRejecting] = useState<FrequencyRequestRow | null>(null);

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
          <EmptyState icon={<Inbox className="size-6" />} title={tab === "pending" ? "No hay solicitudes pendientes" : "Nada por aquí"} description={tab === "pending" ? "Cuando alguien pida una frecuencia aparecerá aquí." : undefined} />
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
                      {tab !== "pending" && <Badge tone={item.status === "approved" ? "onair" : "neutral"}>{item.status_label}</Badge>}
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
                    {item.conflict && (
                      <p className="flex items-center gap-2 text-sm text-warning">
                        <AlertTriangle className="size-4" />
                        {item.frequency.display} ya no está libre ({item.frequency.status_label.toLowerCase()}). Aprueba con otra frecuencia.
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
                  {item.status === "pending" && (
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

      {approving && <ApproveModal item={approving} onClose={() => setApproving(null)} />}
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

function ApproveModal({ item, onClose }: { item: FrequencyRequestRow; onClose: () => void }) {
  const alternatives = item.alternatives ?? [];
  const form = useForm({ frequency: item.conflict ? (alternatives[0] ?? "") : "", note: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(`/admin/solicitudes/${item.id}/aprobar`, { preserveScroll: true, onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Aprobar ${item.station_name}`}
      description={item.kind === "frequency_change" ? "La radio se mudará a la nueva frecuencia y la anterior quedará libre." : "Se creará la radio y su propietario podrá entrar al estudio de inmediato."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="approve-request" loading={form.processing}>
            Aprobar
          </Button>
        </>
      }
    >
      <form id="approve-request" onSubmit={submit} className="space-y-4">
        <Field
          label="Frecuencia"
          hint={item.conflict ? "La pedida ya no está libre: elige una cercana o escribe otra." : `Vacío para usar la solicitada (${item.frequency.label}).`}
          error={fieldError(form.errors, "frequency", "request", "user")}
        >
          {(id, invalid) => (
            <div className="flex flex-wrap items-center gap-2">
              <Input id={id} invalid={invalid} value={form.data.frequency} onChange={(event) => form.setData("frequency", event.target.value)} placeholder={item.frequency.label} className="w-32 tabular" />
              {alternatives.map((label) => (
                <Button key={label} size="sm" variant={form.data.frequency === label ? "primary" : "secondary"} onClick={() => form.setData("frequency", label)}>
                  {label}
                </Button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Nota" hint="Opcional. Se incluye en el correo de aprobación." error={form.errors.note}>
          {(id, invalid) => <Textarea id={id} invalid={invalid} rows={3} maxLength={500} value={form.data.note} onChange={(event) => form.setData("note", event.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
