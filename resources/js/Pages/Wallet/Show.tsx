import { useForm, usePage } from "@inertiajs/react";
import { CreditCard, FlaskConical, Gift, History, ShieldCheck, Wallet } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Field, Input } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel } from "@/Components/ui/panel";
import { PaymentStatusBadge } from "@/Components/wallet/payment-status-badge";
import { announceWalletChange } from "@/Components/wallet/wallet-events";
import { WalletTransactionsTable } from "@/Components/wallet/wallet-transactions-table";
import SiteLayout from "@/Layouts/SiteLayout";
import { cn } from "@/lib/cn";
import { dateTime, money } from "@/lib/format";
import type { Paginated, SharedProps } from "@/types";
import type { Payment, WalletTransaction } from "@/types/wallet";

interface Props {
  wallet: { balance_cents: number; currency: string };
  topUp: { presets: number[]; min_cents: number; max_cents: number; sandbox: boolean };
  transactions: Paginated<WalletTransaction>;
  payments: Payment[];
}

export default function WalletShow({ wallet, topUp, transactions, payments }: Props) {
  const { app } = usePage<SharedProps>().props;
  const formatMoney = (cents: number) => money(cents, app.currency);
  const form = useForm({ amount_cents: topUp.presets[1] ?? topUp.min_cents });
  const [custom, setCustom] = useState("");
  const amount = form.data.amount_cents;
  const valid = Number.isInteger(amount) && amount >= topUp.min_cents && amount <= topUp.max_cents;

  useEffect(() => announceWalletChange(wallet.balance_cents), [wallet.balance_cents]);

  const pickPreset = (cents: number) => {
    setCustom("");
    form.setData("amount_cents", cents);
  };

  const typeCustom = (value: string) => {
    setCustom(value);
    const dollars = Number.parseFloat(value.replace(",", "."));
    form.setData("amount_cents", Number.isFinite(dollars) ? Math.round(dollars * 100) : 0);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) form.post("/billetera/recargar");
  };

  return (
    <SiteLayout title="Mi billetera">
      <div className="space-y-8">
        <PageHeader eyebrow="Billetera" title="Tu saldo para regalar" description="Recarga una vez y envía regalos y mensajes de voz a tus radios favoritas." />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <section className="relative overflow-hidden rounded-3xl bg-primary p-7 text-on-primary">
            <div className="absolute -top-16 -right-16 size-56 rounded-full bg-gold/25 blur-3xl" aria-hidden />
            <div className="relative space-y-8">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm opacity-80">
                  <Wallet className="size-4" /> Saldo disponible
                </span>
                <span className="font-display text-xs tracking-[0.2em] opacity-60">{wallet.currency}</span>
              </div>
              <p className="font-display text-5xl font-semibold tabular sm:text-6xl">{formatMoney(wallet.balance_cents)}</p>
              <p className="flex items-center gap-2 text-xs opacity-70">
                <Gift className="size-3.5" /> Los regalos empiezan desde {formatMoney(100)}.
              </p>
            </div>
          </section>

          <Panel
            title="Recargar saldo"
            description={`Mínimo ${formatMoney(topUp.min_cents)} · máximo ${formatMoney(topUp.max_cents)}`}
            actions={
              topUp.sandbox && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
                  <FlaskConical className="size-3.5" /> Modo de prueba
                </span>
              )
            }
          >
            <form onSubmit={submit} className="space-y-5">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {topUp.presets.map((cents) => (
                  <button
                    key={cents}
                    type="button"
                    onClick={() => pickPreset(cents)}
                    aria-pressed={custom === "" && amount === cents}
                    className={cn(
                      "h-14 rounded-2xl border font-display text-lg font-semibold tabular transition",
                      custom === "" && amount === cents ? "border-ink bg-primary text-on-primary" : "border-line bg-surface hover:border-line-strong hover:bg-raised",
                    )}
                  >
                    {formatMoney(cents)}
                  </button>
                ))}
              </div>
              <Field label="Otro monto (US$)" error={form.errors.amount_cents} hint={`Desde ${formatMoney(topUp.min_cents)}`}>
                {(id, invalid) => (
                  <Input id={id} invalid={invalid} inputMode="decimal" placeholder="Ej. 15" value={custom} onChange={(event) => typeCustom(event.target.value)} />
                )}
              </Field>
              {custom !== "" && !valid && (
                <p className="text-xs text-danger">
                  Escribe un monto entre {formatMoney(topUp.min_cents)} y {formatMoney(topUp.max_cents)}.
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <ShieldCheck className="size-3.5" />
                  {topUp.sandbox ? "Modo de prueba: en el siguiente paso simulas el pago, sin tarjeta." : "Pagas con Culqi, la pasarela segura. No guardamos tu tarjeta."}
                </p>
                <Button type="submit" size="lg" loading={form.processing} disabled={!valid} icon={<CreditCard className="size-4" />}>
                  Recargar {valid ? formatMoney(amount) : ""}
                </Button>
              </div>
            </form>
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Panel title="Movimientos" padded={false} footer={transactions.last_page > 1 ? <Pagination page={transactions} /> : undefined}>
            {transactions.data.length > 0 ? (
              <WalletTransactionsTable rows={transactions.data} />
            ) : (
              <div className="p-5">
                <EmptyState icon={<History className="size-6" />} title="Aún no tienes movimientos" description="Tus recargas y regalos aparecerán aquí." />
              </div>
            )}
          </Panel>

          <Panel title="Recargas recientes" padded={false}>
            {payments.length > 0 ? (
              <ul className="divide-y divide-line">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="font-semibold tabular">{formatMoney(payment.amount_cents)}</p>
                      <p className="text-xs text-muted">{dateTime(payment.created_at)}</p>
                    </div>
                    <PaymentStatusBadge status={payment.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted">Todavía no recargaste saldo.</p>
            )}
          </Panel>
        </div>
      </div>
    </SiteLayout>
  );
}
