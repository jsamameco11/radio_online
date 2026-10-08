import { Field, Input } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import type { PayoutMethodOption, PayoutMethodValue } from "@/types/growth";

export interface PayoutData {
  payout_method: string;
  holder: string;
  account: string;
  bank: string;
}

interface Props {
  methods: PayoutMethodOption[];
  data: PayoutData;
  setData: (key: keyof PayoutData, value: string) => void;
  errors: Partial<Record<string, string>>;
  disabled?: boolean;
  legend?: string;
}

const placeholders: Record<PayoutMethodValue, string> = {
  bank_transfer: "002-123-456789012-34",
  yape: "987 654 321",
  plin: "987 654 321",
  paypal: "tucorreo@ejemplo.com",
};

/** What the backend expects of the payout fields: the phone without spaces and the bank only for transfers. */
export function payoutPayload(data: PayoutData, methods: PayoutMethodOption[]): { account: string; bank: string | null } {
  const method = methods.find((item) => item.value === data.payout_method);
  return {
    account: data.payout_method === "yape" || data.payout_method === "plin" ? data.account.replace(/\s+/g, "") : data.account,
    bank: method?.needs_bank ? data.bank : null,
  };
}

/** Where the platform sends money it owes: method, holder, account and, for transfers, the bank. */
export function PayoutFields({ methods, data, setData, errors, disabled = false, legend = "¿Cómo quieres recibirlo?" }: Props) {
  const method = methods.find((item) => item.value === data.payout_method) ?? methods[0];

  return (
    <>
      <fieldset className="space-y-1.5" disabled={disabled}>
        <legend className="text-sm font-medium text-ink">{legend}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {methods.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setData("payout_method", item.value)}
              aria-pressed={data.payout_method === item.value}
              className={cn(
                "h-10 rounded-xl border text-sm font-medium transition disabled:opacity-50",
                data.payout_method === item.value ? "border-ink bg-ink text-canvas" : "border-line-strong bg-surface text-muted hover:text-ink",
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
            <Input id={id} invalid={invalid} required maxLength={120} disabled={disabled} value={data.holder} onChange={(event) => setData("holder", event.target.value)} autoComplete="name" />
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
              type={data.payout_method === "paypal" ? "email" : "text"}
              inputMode={data.payout_method === "paypal" ? "email" : "numeric"}
              value={data.account}
              onChange={(event) => setData("account", event.target.value)}
              placeholder={placeholders[data.payout_method as PayoutMethodValue]}
            />
          )}
        </Field>
        {method?.needs_bank && (
          <Field label="Banco" error={errors.bank} className="sm:col-span-2">
            {(id, invalid) => (
              <Input id={id} invalid={invalid} required maxLength={80} disabled={disabled} value={data.bank} onChange={(event) => setData("bank", event.target.value)} placeholder="BCP, Interbank, BBVA…" />
            )}
          </Field>
        )}
      </div>
    </>
  );
}
