import { router, useForm } from "@inertiajs/react";
import { BadgeCheck, Banknote, Check, Clock, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { ReasonModal } from "@/Components/admin/reason-modal";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Field, Input, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel, Stat } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import AdminLayout from "@/Layouts/AdminLayout";
import { count, dateTime, money } from "@/lib/format";
import type { Paginated } from "@/types";
import type { WithdrawalRow, WithdrawalStatus } from "@/types/growth";

interface Props {
  tab: WithdrawalStatus;
  totals: Record<WithdrawalStatus, { count: number; amount_cents: number }>;
  withdrawals: Paginated<WithdrawalRow>;
}

const tones: Record<WithdrawalStatus, "info" | "onair" | "danger"> = { pending: "info", paid: "onair", rejected: "danger" };

export default function WithdrawalsIndex({ tab, totals, withdrawals }: Props) {
  const [paying, setPaying] = useState<WithdrawalRow | null>(null);
  const [rejecting, setRejecting] = useState<WithdrawalRow | null>(null);

  return (
    <AdminLayout title="Retiros">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Finanzas"
          title="Retiros de radios"
          description="El monto ya se descontó de la billetera de cada radio. Envía el dinero y registra la referencia, o rechaza el retiro para devolverlo a su saldo."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Por pagar" value={money(totals.pending.amount_cents)} hint={`${count(totals.pending.count)} retiros pendientes`} icon={<Clock className="size-4" />} />
          <Stat label="Pagado" value={money(totals.paid.amount_cents)} hint={`${count(totals.paid.count)} retiros`} icon={<Banknote className="size-4" />} />
          <Stat label="Devuelto a radios" value={money(totals.rejected.amount_cents)} hint={`${count(totals.rejected.count)} rechazados`} icon={<X className="size-4" />} />
        </div>

        <Tabs
          value={tab}
          onChange={(value) => router.get("/admin/retiros", value === "pending" ? {} : { tab: value }, { preserveState: true, replace: true })}
          items={[
            { value: "pending", label: "Pendientes", count: totals.pending.count },
            { value: "paid", label: "Pagados", count: totals.paid.count },
            { value: "rejected", label: "Rechazados", count: totals.rejected.count },
          ]}
        />

        <Panel padded={false} footer={withdrawals.last_page > 1 ? <Pagination page={withdrawals} /> : undefined}>
          {withdrawals.data.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Banknote className="size-6" />} title={tab === "pending" ? "No hay retiros por pagar" : "Nada por aquí"} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">Radio</th>
                    <th className="px-5 py-3 text-right font-medium">Monto</th>
                    <th className="px-5 py-3 font-medium">Datos de cobro</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {withdrawals.data.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5 font-medium">
                          {row.station?.display_name}
                          {row.station?.monetized && <BadgeCheck className="size-4 text-gold" aria-label="Radio monetizada" />}
                        </span>
                        {row.requester && <span className="block text-xs text-muted">{row.requester.name} · {row.requester.email}</span>}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold whitespace-nowrap tabular">{money(row.amount_cents, row.currency)}</td>
                      <td className="px-5 py-3">
                        <span className="block font-medium">{row.payout_method.label}</span>
                        {row.payout_details && (
                          <span className="block text-xs text-muted">
                            {row.payout_details.holder}
                            <span className="block font-mono text-ink">{row.payout_details.account}</span>
                            {row.payout_details.bank && <span className="block">{row.payout_details.bank}</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={tones[row.status.value]}>{row.status.label}</Badge>
                        {row.paid_reference && <span className="mt-1 block font-mono text-xs text-muted">Ref. {row.paid_reference}</span>}
                        {row.review_note && <span className="mt-1 block max-w-56 text-xs text-muted">“{row.review_note}”</span>}
                        {row.reviewer && <span className="mt-1 block text-xs text-faint">por {row.reviewer}</span>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-muted">
                        {dateTime(row.created_at)}
                        {row.reviewed_at && <span className="block text-xs text-faint">Procesado {dateTime(row.reviewed_at)}</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {row.status.value === "pending" && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => setRejecting(row)}>
                              Rechazar
                            </Button>
                            <Button size="sm" icon={<Check className="size-3.5" />} onClick={() => setPaying(row)}>
                              Marcar pagado
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {paying && <PayModal row={paying} onClose={() => setPaying(null)} />}
      {rejecting && (
        <ReasonModal
          open
          onClose={() => setRejecting(null)}
          title={`Rechazar retiro de ${money(rejecting.amount_cents, rejecting.currency)}`}
          description="El monto vuelve completo a la billetera de la radio y el propietario recibe esta nota por correo."
          url={`/admin/retiros/${rejecting.id}/rechazar`}
          field="note"
          label="Motivo"
          confirmLabel="Rechazar y devolver"
        />
      )}
    </AdminLayout>
  );
}

function PayModal({ row, onClose }: { row: WithdrawalRow; onClose: () => void }) {
  const form = useForm({ reference: "", note: "" });
  const errors: Partial<Record<string, string>> = form.errors;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(`/admin/retiros/${row.id}/pagado`, { preserveScroll: true, onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Marcar como pagado: ${money(row.amount_cents, row.currency)}`}
      description={`${row.station?.display_name ?? "La radio"} · ${row.payout_method.label}. Confirma solo después de enviar el dinero.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="pay-withdrawal" loading={form.processing}>
            Confirmar pago
          </Button>
        </>
      }
    >
      <form id="pay-withdrawal" onSubmit={submit} className="space-y-4">
        <Field label="Referencia de la operación" hint="Número de operación, ID de PayPal o código de Yape/Plin." error={errors.reference ?? errors.withdrawal}>
          {(id, invalid) => <Input id={id} invalid={invalid} required minLength={3} maxLength={120} value={form.data.reference} onChange={(event) => form.setData("reference", event.target.value)} autoFocus />}
        </Field>
        <Field label="Nota" hint="Opcional. Queda en la auditoría." error={errors.note}>
          {(id, invalid) => <Textarea id={id} invalid={invalid} rows={3} maxLength={500} value={form.data.note} onChange={(event) => form.setData("note", event.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
