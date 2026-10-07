import { useForm } from "@inertiajs/react";
import { Banknote, Clock } from "lucide-react";
import type { FormEvent } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Input } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import type { PayoutMethodOption, PayoutMethodValue } from "@/types/growth";

interface Props {
  url: string;
  balanceCents: number;
  currency: string;
  minCents: number;
  methods: PayoutMethodOption[];
  inProcess: boolean;
}

const placeholders: Record<PayoutMethodValue, string> = {
  bank_transfer: "002-123-456789012-34",
  yape: "987 654 321",
  plin: "987 654 321",
  paypal: "tucorreo@ejemplo.com",
};

/** Takes station earnings out of its wallet: amount from the minimum up to the balance, and where to send it. */
export function WithdrawalForm({ url, balanceCents, currency, minCents, methods, inProcess }: Props) {
  const form = useForm({ amount: "", payout_method: methods[0]?.value ?? "yape", holder: "", account: "", bank: "" });
  const method = methods.find((item) => item.value === form.data.payout_method) ?? methods[0];
  const enough = balanceCents >= minCents;
  const disabled = !enough;
  const errors: Partial<Record<string, string>> = form.errors;

  form.transform(({ amount, account, bank, ...data }) => ({
    ...data,
    amount_cents: Math.round(Number(amount) * 100),
    account: data.payout_method === "yape" || data.payout_method === "plin" ? account.replace(/\s+/g, "") : account,
    bank: method?.needs_bank ? bank : null,
  }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(url, { preserveScroll: true, onSuccess: () => form.reset() });
  };

  const setAmount = (cents: number) => form.setData("amount", (cents / 100).toFixed(2));

  if (inProcess) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info-soft px-4 py-3.5 text-sm text-info">
        <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>Tienes un retiro en proceso. Te avisaremos por correo apenas lo enviemos; luego podrás pedir otro.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!enough && (
        <p className="rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">
          Podrás retirar cuando tu saldo llegue a <span className="font-semibold text-ink">{money(minCents, currency)}</span>. Te faltan{" "}
          <span className="font-semibold text-ink">{money(minCents - balanceCents, currency)}</span>: ¡cada regalo te acerca!
        </p>
      )}

      <Field label={`Monto a retirar (${currency})`} hint={`Mínimo ${money(minCents, currency)} · disponible ${money(balanceCents, currency)}`} error={errors.amount_cents}>
        {(id, invalid) => (
          <div className="space-y-2">
            <Input
              id={id}
              invalid={invalid}
              type="number"
              inputMode="decimal"
              min={minCents / 100}
              max={balanceCents / 100}
              step="0.01"
              required
              disabled={disabled}
              value={form.data.amount}
              onChange={(event) => form.setData("amount", event.target.value)}
              placeholder={(minCents / 100).toFixed(2)}
              className="h-12 text-lg font-semibold tabular"
            />
            {enough && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setAmount(minCents)} disabled={disabled}>
                  Mínimo
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setAmount(balanceCents)} disabled={disabled}>
                  Todo mi saldo
                </Button>
              </div>
            )}
          </div>
        )}
      </Field>

      <fieldset className="space-y-1.5" disabled={disabled}>
        <legend className="text-sm font-medium text-ink">¿Cómo quieres recibirlo?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {methods.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => form.setData("payout_method", item.value)}
              aria-pressed={form.data.payout_method === item.value}
              className={cn(
                "h-10 rounded-xl border text-sm font-medium transition disabled:opacity-50",
                form.data.payout_method === item.value ? "border-ink bg-ink text-canvas" : "border-line-strong bg-surface text-muted hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {errors.payout_method && <p className="text-xs text-danger">{errors.payout_method}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titular" hint="Nombre completo, tal como figura en la cuenta." error={errors.holder}>
          {(id, invalid) => (
            <Input id={id} invalid={invalid} required maxLength={120} disabled={disabled} value={form.data.holder} onChange={(event) => form.setData("holder", event.target.value)} autoComplete="name" />
          )}
        </Field>
        <Field label={method?.account_label ?? "Cuenta"} error={errors.account}>
          {(id, invalid) => (
            <Input
              id={id}
              invalid={invalid}
              required
              maxLength={120}
              disabled={disabled}
              type={form.data.payout_method === "paypal" ? "email" : "text"}
              inputMode={form.data.payout_method === "paypal" ? "email" : "numeric"}
              value={form.data.account}
              onChange={(event) => form.setData("account", event.target.value)}
              placeholder={placeholders[form.data.payout_method as PayoutMethodValue]}
            />
          )}
        </Field>
        {method?.needs_bank && (
          <Field label="Banco" error={errors.bank} className="sm:col-span-2">
            {(id, invalid) => (
              <Input id={id} invalid={invalid} required maxLength={80} disabled={disabled} value={form.data.bank} onChange={(event) => form.setData("bank", event.target.value)} placeholder="BCP, Interbank, BBVA…" />
            )}
          </Field>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">Descontamos el monto de tu saldo al enviar la solicitud. Si no podemos pagarlo, vuelve completo a tu saldo.</p>
        <Button type="submit" size="lg" icon={<Banknote className="size-4" />} loading={form.processing} disabled={disabled}>
          Solicitar retiro
        </Button>
      </div>
    </form>
  );
}
