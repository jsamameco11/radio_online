import { useForm } from "@inertiajs/react";
import { Banknote, Clock } from "lucide-react";
import type { FormEvent } from "react";
import { PayoutFields, payoutPayload } from "@/Components/studio/payout-fields";
import { Button } from "@/Components/ui/button";
import { Field, Input } from "@/Components/ui/field";
import { money } from "@/lib/format";
import type { PayoutMethodOption } from "@/types/growth";

interface Props {
  url: string;
  balanceCents: number;
  currency: string;
  minCents: number;
  methods: PayoutMethodOption[];
  inProcess: boolean;
}

/** Takes station earnings out of its wallet: amount from the minimum up to the balance, and where to send it. */
export function WithdrawalForm({ url, balanceCents, currency, minCents, methods, inProcess }: Props) {
  const form = useForm({ amount: "", payout_method: methods[0]?.value ?? "yape", holder: "", account: "", bank: "" });
  const enough = balanceCents >= minCents;
  const disabled = !enough;
  const errors: Partial<Record<string, string>> = form.errors;

  form.transform(({ amount, ...data }) => ({
    ...data,
    ...payoutPayload(data, methods),
    amount_cents: Math.round(Number(amount) * 100),
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

      <PayoutFields methods={methods} data={form.data} setData={(key, value) => form.setData(key, value)} errors={errors} disabled={disabled} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">Descontamos el monto de tu saldo al enviar la solicitud. Si no podemos pagarlo, vuelve completo a tu saldo.</p>
        <Button type="submit" size="lg" icon={<Banknote className="size-4" />} loading={form.processing} disabled={disabled}>
          Solicitar retiro
        </Button>
      </div>
    </form>
  );
}
