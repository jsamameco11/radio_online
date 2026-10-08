import { router, useForm } from "@inertiajs/react";
import { Banknote, Check, Clock, ExternalLink, Percent, Plus, Tag, X } from "lucide-react";
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
import { platformSaleSplit } from "@/lib/sale-split";
import type { Paginated } from "@/types";
import type { SaleRow, SaleTab } from "@/types/marketplace";

interface Props {
  tab: SaleTab;
  totals: {
    to_pay: { count: number; amount_cents: number };
    active: { count: number };
    platform: { count: number; amount_cents: number };
    paid: { count: number; amount_cents: number };
    cancelled: { count: number };
    fees_cents: number;
  };
  processorFeePercent: number;
  feePercent: number;
  taxPercent: number;
  minPriceCents: number;
  maxPriceCents: number;
  sales: Paginated<SaleRow>;
  canWithdraw: boolean;
  canListFrequencies: boolean;
}

const empty: Record<SaleTab, string> = {
  to_pay: "No hay ventas por pagar",
  active: "No hay nada en venta",
  platform: "La plataforma todavía no vendió frecuencias",
  paid: "Todavía no se pagó ninguna venta",
  cancelled: "No hay publicaciones retiradas",
};

export default function SalesIndex({ tab, totals, processorFeePercent, feePercent, taxPercent, minPriceCents, maxPriceCents, sales, canWithdraw, canListFrequencies }: Props) {
  const [paying, setPaying] = useState<SaleRow | null>(null);
  const [withdrawing, setWithdrawing] = useState<SaleRow | null>(null);
  const [listing, setListing] = useState(false);

  return (
    <AdminLayout title="Ventas de radios">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Finanzas"
          title="Ventas de radios"
          description={`Cuando un propietario vende su radio, el comprador ya pagó con su billetera: envía al vendedor el precio menos la pasarela (${processorFeePercent}%), la comisión (${feePercent}%) y su IGV (${taxPercent}%), más el saldo que tenía la radio. Las frecuencias que vende la plataforma no se pagan a nadie.`}
          actions={
            canListFrequencies && (
              <Button icon={<Plus className="size-4" />} onClick={() => setListing(true)}>
                Vender una frecuencia
              </Button>
            )
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Por pagar a vendedores" value={money(totals.to_pay.amount_cents)} hint={`${count(totals.to_pay.count)} ventas`} icon={<Clock className="size-4" />} />
          <Stat label="Pagado a vendedores" value={money(totals.paid.amount_cents)} hint={`${count(totals.paid.count)} ventas`} icon={<Banknote className="size-4" />} />
          <Stat
            label="Ingresos de la plataforma"
            value={money(totals.fees_cents)}
            hint={`Comisiones y ${count(totals.platform.count)} frecuencias vendidas, sin pasarela ni IGV`}
            icon={<Percent className="size-4" />}
          />
          <Stat label="En venta ahora" value={count(totals.active.count)} hint="Publicaciones activas" icon={<Tag className="size-4" />} />
        </div>

        <Tabs
          value={tab}
          onChange={(value) => router.get("/admin/ventas", value === "to_pay" ? {} : { tab: value }, { preserveState: true, replace: true })}
          items={[
            {
              value: "to_pay",
              label: "Por pagar",
              count: totals.to_pay.count,
            },
            {
              value: "active",
              label: "En venta",
              count: totals.active.count,
            },
            {
              value: "platform",
              label: "Frecuencias vendidas",
              count: totals.platform.count,
            },
            {
              value: "paid",
              label: "Pagadas",
              count: totals.paid.count,
            },
            {
              value: "cancelled",
              label: "Retiradas",
              count: totals.cancelled.count,
            },
          ]}
        />

        <Panel padded={false} footer={sales.last_page > 1 ? <Pagination page={sales} /> : undefined}>
          {sales.data.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Tag className="size-6" />} title={empty[tab]} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">Radio</th>
                    <th className="px-5 py-3 text-right font-medium">Importes</th>
                    <th className="px-5 py-3 font-medium">Pagar a</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 font-medium">Fechas</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sales.data.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-5 py-3">
                        <a href={row.public_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:underline">
                          {row.station ?? (row.by_platform ? row.frequency : "Radio cerrada")} <ExternalLink className="size-3.5 text-faint" />
                        </a>
                        {row.by_platform ? (
                          <span className="block text-xs text-muted">
                            <Badge tone="gold">Frecuencia de la plataforma</Badge>
                            {row.seller && <span className="mt-1 block">Publicó: {row.seller.name}</span>}
                          </span>
                        ) : (
                          row.seller && (
                            <span className="block text-xs text-muted">
                              Vende: {row.seller.name} · {row.seller.email}
                            </span>
                          )
                        )}
                        {row.buyer && (
                          <span className="block text-xs text-muted">
                            Compró: {row.buyer.name} · {row.buyer.email}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap tabular">
                        <span className="block font-semibold">{money(row.price_cents, row.currency)}</span>
                        {row.status.value === "sold" && (
                          <span className="block text-xs text-muted">
                            Pasarela {money(row.processor_fee_cents ?? 0, row.currency)}
                            {row.by_platform ? (
                              <span className="block font-semibold text-ink">Para la plataforma {money(row.fee_cents ?? 0, row.currency)}</span>
                            ) : (
                              <>
                                <span className="block">Comisión {money(row.fee_cents ?? 0, row.currency)}</span>
                                <span className="block">IGV {money(row.tax_cents ?? 0, row.currency)}</span>
                                <span className="block">Saldo de la radio {money(row.settled_balance_cents ?? 0, row.currency)}</span>
                                <span className="block font-semibold text-ink">A pagar {money(row.payout_cents ?? 0, row.currency)}</span>
                              </>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {row.payout_method && row.payout_details ? (
                          <>
                            <span className="block font-medium">{row.payout_method.label}</span>
                            <span className="block text-xs text-muted">
                              {row.payout_details.holder}
                              <span className="block font-mono text-ink">{row.payout_details.account}</span>
                              {row.payout_details.bank && <span className="block">{row.payout_details.bank}</span>}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted">Nadie: es un ingreso de la plataforma</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={row.status.value === "sold" ? "onair" : row.status.value === "active" ? "gold" : "neutral"}>{row.status.label}</Badge>
                        {row.payout_status && (
                          <span className="mt-1 block">
                            <Badge tone={row.payout_status.value === "paid" ? "onair" : "info"}>{row.payout_status.label}</Badge>
                          </span>
                        )}
                        {row.payout_reference && <span className="mt-1 block font-mono text-xs text-muted">Ref. {row.payout_reference}</span>}
                        {row.payout_note && <span className="mt-1 block max-w-56 text-xs text-muted">“{row.payout_note}”</span>}
                        {row.payer && <span className="mt-1 block text-xs text-faint">por {row.payer}</span>}
                      </td>
                      <td className="px-5 py-3 text-xs whitespace-nowrap text-muted">
                        {row.listed_at && <span className="block">Publicada {dateTime(row.listed_at)}</span>}
                        {row.sold_at && <span className="block">Vendida {dateTime(row.sold_at)}</span>}
                        {row.paid_at && <span className="block">Pagada {dateTime(row.paid_at)}</span>}
                        {row.cancelled_at && <span className="block">Retirada {dateTime(row.cancelled_at)}</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {row.payout_status?.value === "pending" && (
                          <Button size="sm" icon={<Check className="size-3.5" />} onClick={() => setPaying(row)}>
                            Marcar pagado
                          </Button>
                        )}
                        {row.status.value === "active" && canWithdraw && (
                          <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => setWithdrawing(row)}>
                            Retirar
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

      {paying && <PayModal row={paying} onClose={() => setPaying(null)} />}
      {listing && <ListFrequencyModal processorFeePercent={processorFeePercent} minPriceCents={minPriceCents} maxPriceCents={maxPriceCents} onClose={() => setListing(false)} />}
      {withdrawing && (
        <ReasonModal
          open
          onClose={() => setWithdrawing(null)}
          title={`Retirar ${withdrawing.station ?? withdrawing.frequency} de la venta`}
          description={
            withdrawing.by_platform
              ? "La publicación deja de verse. La frecuencia sigue reservada: libérala desde Frecuencias si quieres que se pueda solicitar."
              : "La publicación deja de verse y el propietario recibe este motivo por correo."
          }
          url={`/admin/ventas/${withdrawing.id}/retirar`}
          field="note"
          label="Motivo"
          confirmLabel="Retirar de la venta"
        />
      )}
    </AdminLayout>
  );
}

function PayModal({ row, onClose }: { row: SaleRow; onClose: () => void }) {
  const form = useForm({ reference: "", note: "" });
  const errors: Partial<Record<string, string>> = form.errors;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(`/admin/ventas/${row.id}/pagado`, {
      preserveScroll: true,
      onSuccess: onClose,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Marcar como pagado: ${money(row.payout_cents ?? 0, row.currency)}`}
      description={`${row.station ?? "La radio"} · ${row.payout_method?.label} a ${row.payout_details?.holder}. Confirma solo después de enviar el dinero.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="pay-sale" loading={form.processing}>
            Confirmar pago
          </Button>
        </>
      }
    >
      <form id="pay-sale" onSubmit={submit} className="space-y-4">
        <Field label="Referencia de la operación" hint="Número de operación, ID de PayPal o código de Yape/Plin." error={errors.reference ?? errors.listing}>
          {(id, invalid) => (
            <Input
              id={id}
              invalid={invalid}
              required
              minLength={3}
              maxLength={120}
              value={form.data.reference}
              onChange={(event) => form.setData("reference", event.target.value)}
              autoFocus
            />
          )}
        </Field>
        <Field label="Nota" hint="Opcional. Queda en la auditoría." error={errors.note}>
          {(id, invalid) => <Textarea id={id} invalid={invalid} rows={3} maxLength={500} value={form.data.note} onChange={(event) => form.setData("note", event.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}

function ListFrequencyModal({
  processorFeePercent,
  minPriceCents,
  maxPriceCents,
  onClose,
}: {
  processorFeePercent: number;
  minPriceCents: number;
  maxPriceCents: number;
  onClose: () => void;
}) {
  const form = useForm({ frequency: "", price: "", pitch: "" });
  const errors: Partial<Record<string, string>> = form.errors;
  const priceCents = Math.round(Number(form.data.price) * 100) || 0;
  const split = platformSaleSplit(priceCents, processorFeePercent);

  form.transform(({ price, ...data }) => ({
    ...data,
    price_cents: Math.round(Number(price) * 100),
    pitch: data.pitch.trim() || null,
  }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post("/admin/ventas/frecuencias", {
      preserveScroll: true,
      onSuccess: onClose,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Vender una frecuencia"
      description="Publica una frecuencia libre del dial en Frecuencias en venta. Queda reservada mientras esté en venta; quien la compre abre en ella su radio con el nombre que elija."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="list-frequency" icon={<Tag className="size-4" />} loading={form.processing}>
            Publicar en venta
          </Button>
        </>
      }
    >
      <form id="list-frequency" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Frecuencia" hint="Libre, por ejemplo 89.30" error={errors.frequency}>
            {(id, invalid) => (
              <Input
                id={id}
                invalid={invalid}
                required
                maxLength={10}
                inputMode="decimal"
                placeholder="89.30"
                value={form.data.frequency}
                onChange={(event) => form.setData("frequency", event.target.value)}
                autoFocus
              />
            )}
          </Field>
          <Field label="Precio (USD)" hint={`Entre ${money(minPriceCents)} y ${money(maxPriceCents)}`} error={errors.price_cents}>
            {(id, invalid) => (
              <Input
                id={id}
                invalid={invalid}
                type="number"
                inputMode="decimal"
                required
                min={minPriceCents / 100}
                max={maxPriceCents / 100}
                step="0.01"
                placeholder={(minPriceCents / 100).toFixed(2)}
                value={form.data.price}
                onChange={(event) => form.setData("price", event.target.value)}
                className="tabular"
              />
            )}
          </Field>
        </div>
        <Field label="Mensaje para los compradores" hint="Opcional. Por qué vale la pena esta frecuencia." error={errors.pitch}>
          {(id, invalid) => <Textarea id={id} invalid={invalid} rows={3} maxLength={600} value={form.data.pitch} onChange={(event) => form.setData("pitch", event.target.value)} />}
        </Field>
        {priceCents > 0 && (
          <p className="rounded-xl bg-raised px-3 py-2 text-sm text-muted tabular">
            Pasarela de pago ({processorFeePercent}%) − {money(split.processorFeeCents)} · Para la plataforma <strong className="text-ink">{money(split.platformCents)}</strong>
          </p>
        )}
      </form>
    </Modal>
  );
}
