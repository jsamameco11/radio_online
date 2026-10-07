import { router, useForm, usePage } from "@inertiajs/react";
import { CreditCard, RotateCcw, Search } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel, Stat } from "@/Components/ui/panel";
import { PaymentStatusBadge } from "@/Components/wallet/payment-status-badge";
import AdminLayout from "@/Layouts/AdminLayout";
import { count, dateTime, money } from "@/lib/format";
import type { Paginated, SharedProps } from "@/types";
import type { Labeled, Payment, PaymentStatus } from "@/types/wallet";

interface Props {
  filters: { estado: PaymentStatus | null; buscar: string };
  statuses: Labeled<PaymentStatus>[];
  totals: Record<PaymentStatus, { payments: number; amount_cents: number }>;
  payments: Paginated<Payment>;
  canRefund: boolean;
}

const providers: Record<string, string> = { sandbox: "Modo de prueba", stripe: "Stripe" };

export default function PaymentsIndex({ filters, statuses, totals, payments, canRefund }: Props) {
  const { app } = usePage<SharedProps>().props;
  const [search, setSearch] = useState(filters.buscar);
  const [refunding, setRefunding] = useState<Payment | null>(null);

  const filter = (changes: Partial<Props["filters"]>) => {
    const next = { ...filters, ...changes };
    router.get("/admin/pagos", { estado: next.estado ?? undefined, buscar: next.buscar || undefined }, { preserveState: true, replace: true });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    filter({ buscar: search.trim() });
  };

  return (
    <AdminLayout title="Pagos">
      <div className="space-y-6">
        <PageHeader eyebrow="Finanzas" title="Recargas de billetera" description="Cada pago que un oyente inició para recargar su billetera, con su estado en la pasarela." />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Cobrado" value={money(totals.succeeded.amount_cents, app.currency)} hint={`${count(totals.succeeded.payments)} pagos aprobados`} />
          <Stat label="Pendiente" value={money(totals.pending.amount_cents, app.currency)} hint={`${count(totals.pending.payments)} pagos sin confirmar`} />
          <Stat label="Reembolsado" value={money(totals.refunded.amount_cents, app.currency)} hint={`${count(totals.refunded.payments)} reembolsos`} />
          <Stat
            label="Sin completar"
            value={count(totals.failed.payments + totals.cancelled.payments)}
            hint={`${count(totals.failed.payments)} fallidos · ${count(totals.cancelled.payments)} cancelados`}
          />
        </div>

        <Panel
          padded={false}
          title="Pagos"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filters.estado ?? ""} onChange={(event) => filter({ estado: (event.target.value || null) as PaymentStatus | null })} className="h-8 w-40 text-xs">
                <option value="">Todos los estados</option>
                {statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </Select>
              <form onSubmit={submitSearch} className="flex items-center gap-2">
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Correo, nombre o ID del pago" className="h-8 w-60 text-xs" aria-label="Buscar pagos" />
                <Button type="submit" size="sm" variant="secondary" icon={<Search className="size-3.5" />}>
                  Buscar
                </Button>
              </form>
            </div>
          }
          footer={payments.last_page > 1 ? <Pagination page={payments} /> : undefined}
        >
          {payments.data.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<CreditCard className="size-6" />} title="No hay pagos con estos filtros" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">Oyente</th>
                    <th className="px-5 py-3 text-right font-medium">Monto</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 font-medium">Pasarela</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {payments.data.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-5 py-3">
                        <span className="block font-medium">{payment.user?.name}</span>
                        <span className="block text-xs text-muted">{payment.user?.email}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular">{money(payment.amount_cents, payment.currency)}</td>
                      <td className="px-5 py-3">
                        <PaymentStatusBadge status={payment.status} />
                        {payment.failure_reason && <span className="mt-1 block max-w-56 text-xs text-muted">{payment.failure_reason}</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className="block">{providers[payment.provider] ?? payment.provider}</span>
                        <span className="block max-w-48 truncate font-mono text-xs text-faint" title={payment.provider_reference ?? payment.id}>
                          {payment.provider_reference ?? payment.id}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-muted">
                        {dateTime(payment.created_at)}
                        {payment.paid_at && <span className="block text-xs text-faint">Pagado {dateTime(payment.paid_at)}</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canRefund && payment.status.value === "succeeded" && (
                          <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => setRefunding(payment)}>
                            Reembolsar
                          </Button>
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

      {refunding && <RefundModal payment={refunding} onClose={() => setRefunding(null)} />}
    </AdminLayout>
  );
}

function RefundModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const form = useForm({ reason: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(`/admin/pagos/${payment.id}/reembolso`, { preserveScroll: true, onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Reembolsar pago"
      description={`Devolveremos ${money(payment.amount_cents, payment.currency)} a ${payment.user?.name ?? "el oyente"} y descontaremos el mismo monto de su billetera. Si ya gastó el saldo, el reembolso no es posible.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" type="submit" form="refund-payment" loading={form.processing}>
            Reembolsar
          </Button>
        </>
      }
    >
      <form id="refund-payment" onSubmit={submit}>
        <Field label="Motivo" hint="Queda registrado en la auditoría." error={form.errors.reason}>
          {(id, invalid) => <Textarea id={id} invalid={invalid} required minLength={5} maxLength={200} value={form.data.reason} onChange={(event) => form.setData("reason", event.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
