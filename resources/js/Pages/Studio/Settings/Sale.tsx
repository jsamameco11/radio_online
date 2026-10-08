import { router, useForm } from "@inertiajs/react";
import { AlertTriangle, ExternalLink, Lock, Tag, Trash2 } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { PageErrors } from "@/Components/forms/page-errors";
import { PayoutFields, payoutPayload } from "@/Components/studio/payout-fields";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { dateTime, money } from "@/lib/format";
import { saleSplit } from "@/lib/sale-split";
import type { PayoutMethodOption } from "@/types/growth";
import type { OwnListing } from "@/types/marketplace";

interface Props {
  listing: OwnListing | null;
  blocked: string | null;
  balanceCents: number;
  currency: string;
  processorFeePercent: number;
  feePercent: number;
  taxPercent: number;
  minPriceCents: number;
  maxPriceCents: number;
  methods: PayoutMethodOption[];
}

export default function Sale({ listing, blocked, balanceCents, currency, processorFeePercent, feePercent, taxPercent, minPriceCents, maxPriceCents, methods }: Props) {
  const url = useStudioUrl();
  const form = useForm({
    price: listing ? (listing.price_cents / 100).toFixed(2) : "",
    pitch: listing?.pitch ?? "",
    payout_method: listing?.payout_method ?? methods[0]?.value ?? "yape",
    holder: listing?.holder ?? "",
    account: listing?.account ?? "",
    bank: listing?.bank ?? "",
    confirm: Boolean(listing),
  });
  const errors: Partial<Record<string, string>> = form.errors;
  const disabled = blocked !== null;

  const priceCents = Math.round(Number(form.data.price) * 100) || 0;
  const split = saleSplit(priceCents, { processorFeePercent, feePercent, taxPercent });

  form.transform(({ price, ...data }) => ({
    ...data,
    ...payoutPayload(data, methods),
    price_cents: Math.round(Number(price) * 100),
    pitch: data.pitch.trim() || null,
  }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(url("/vender"), { preserveScroll: true });
  };

  const withdraw = () => {
    if (window.confirm("¿Retirar tu canal de la venta? Podrás volver a publicarlo cuando quieras.")) {
      router.delete(url("/vender"), { preserveScroll: true });
    }
  };

  return (
    <StudioLayout title="Vender canal">
      <div className="max-w-4xl space-y-6">
        <PageHeader
          eyebrow="Canal"
          title="Vender canal"
          description="Publica tu canal completo en Canales en venta, a un precio fijo. La compra es solo a través de la plataforma: quien lo paga primero se lo lleva."
          actions={
            listing && (
              <a href={listing.public_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
                Ver publicación <ExternalLink className="size-3.5" />
              </a>
            )
          }
        />
        <PageErrors only={["listing"]} />

        {blocked && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{blocked}</p>
          </div>
        )}

        {listing && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/40 bg-gold-soft px-4 py-3 text-sm">
            <Badge tone="gold">En venta</Badge>
            <span className="text-ink">
              Publicada por <strong className="tabular">{money(listing.price_cents, currency)}</strong>
              {listing.listed_at && <span className="text-muted"> desde el {dateTime(listing.listed_at, { dateStyle: "long" })}</span>}. Te pagaremos a {listing.destination}.
            </span>
          </div>
        )}

        <Panel title="Cómo funciona la venta">
          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            <Rule>Se vende el canal completo: número, nombre, logo, portada, suscriptores, biblioteca, listas y episodios.</Rule>
            <Rule>El comprador paga con su billetera de la plataforma; nunca aceptes pagos por fuera.</Rule>
            <Rule>Al comprarla, tú y todo tu equipo pierden el acceso a la consola y el comprador queda como único propietario.</Rule>
            <Rule>Te transferimos lo que te corresponde al medio de cobro que registres aquí y te avisamos por correo con la referencia.</Rule>
          </ul>
        </Panel>

        <form onSubmit={submit} className="space-y-6">
          <Panel title="Precio" description={`Entre ${money(minPriceCents, currency)} y ${money(maxPriceCents, currency)}. Puedes cambiarlo mientras nadie la compre.`}>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-4">
                <Field label={`Precio de venta (${currency})`} error={errors.price_cents}>
                  {(id, invalid) => (
                    <Input
                      id={id}
                      invalid={invalid}
                      type="number"
                      inputMode="decimal"
                      min={minPriceCents / 100}
                      max={maxPriceCents / 100}
                      step="0.01"
                      required
                      disabled={disabled}
                      value={form.data.price}
                      onChange={(event) => form.setData("price", event.target.value)}
                      placeholder={(minPriceCents / 100).toFixed(2)}
                      className="h-12 text-lg font-semibold tabular"
                    />
                  )}
                </Field>
                <Field label="Mensaje para los compradores" hint="Opcional. Cuenta por qué vale la pena tu canal: audiencia, programas, horarios…" error={errors.pitch}>
                  {(id, invalid) => (
                    <Textarea id={id} invalid={invalid} rows={4} maxLength={600} disabled={disabled} value={form.data.pitch} onChange={(event) => form.setData("pitch", event.target.value)} />
                  )}
                </Field>
              </div>

              <dl className="space-y-2.5 self-start rounded-2xl border border-line bg-raised p-4 text-sm">
                <Line label="Precio de venta" value={money(priceCents, currency)} />
                <Line label={`Pasarela de pago (${processorFeePercent}%)`} value={`− ${money(split.processorFeeCents, currency)}`} />
                <Line label={`Comisión de la plataforma (${feePercent}%)`} value={`− ${money(split.feeCents, currency)}`} />
                <Line label={`IGV de la comisión (${taxPercent}%)`} value={`− ${money(split.taxCents, currency)}`} />
                <Line label="Saldo actual de tu canal" value={`+ ${money(balanceCents, currency)}`} />
                <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
                  <dt className="font-semibold text-ink">Recibirás</dt>
                  <dd className="font-display text-xl font-bold text-onair tabular">{money(split.sellerCents + balanceCents, currency)}</dd>
                </div>
                <p className="text-xs text-muted">El saldo del canal se suma el día de la venta, con lo que tenga en ese momento.</p>
              </dl>
            </div>
          </Panel>

          <Panel title="Dónde te pagamos" description="Solo lo ve el equipo de la plataforma. Revisa bien los datos: ahí enviaremos el dinero de la venta.">
            <div className="space-y-4">
              <PayoutFields methods={methods} data={form.data} setData={(key, value) => form.setData(key, value)} errors={errors} disabled={disabled} legend="¿Cómo quieres recibir el pago?" />
            </div>
          </Panel>

          <Panel
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3">
                {listing ? (
                  <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={withdraw}>
                    Retirar de la venta
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="submit" size="lg" icon={<Tag className="size-4" />} loading={form.processing} disabled={disabled || !form.data.confirm}>
                  {listing ? "Guardar cambios" : "Publicar en venta"}
                </Button>
              </div>
            }
          >
            <div className="space-y-3">
              <p className="flex items-start gap-2 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                Mientras esté en venta no podrás pedir retiros: el saldo de tu canal se te paga junto con la venta.
              </p>
              <Checkbox
                checked={form.data.confirm}
                disabled={disabled}
                onChange={(event) => form.setData("confirm", event.target.checked)}
                label="Entiendo que la venta es automática y definitiva: quien pague primero se queda con el canal."
              />
              {errors.confirm && <p className="text-xs text-danger">{errors.confirm}</p>}
            </div>
          </Panel>
        </form>
      </div>
    </StudioLayout>
  );
}

function Rule({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 rounded-xl bg-raised p-3 text-muted">
      <Tag className="mt-0.5 size-3.5 shrink-0 text-signal" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium whitespace-nowrap text-ink tabular">{value}</dd>
    </div>
  );
}
