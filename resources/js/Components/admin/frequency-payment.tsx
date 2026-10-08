import { useForm } from "@inertiajs/react";
import { AlertTriangle, CheckCircle2, CreditCard, XCircle } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect } from "react";
import { DEFAULT_APPROVAL_NOTE } from "@/Components/admin/approval-fields";
import { fieldError } from "@/Components/forms/field-error";
import { Badge } from "@/Components/ui/badge";
import type { Tone } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Field, Input, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";
import type { FrequencyRequestRow } from "@/types/admin";
import type { FrequencyPaymentInfo, FrequencyPaymentStatus } from "@/types/site";

export const paymentTones: Record<FrequencyPaymentStatus, Tone> = {
  card_required: "warning",
  card_saved: "info",
  paid: "onair",
  failed: "danger",
  unconfirmed: "warning",
  cancelled: "neutral",
};

/** A priced request still to be charged: it is approved with the payment form, not by picking a frequency. */
export function chargesOnApproval(request: FrequencyRequestRow): request is FrequencyRequestRow & { payment: FrequencyPaymentInfo } {
  return !!request.payment && request.payment.status.value !== "paid";
}

/** The card on file can be charged now. */
export function canCharge(request: FrequencyRequestRow & { payment: FrequencyPaymentInfo }): boolean {
  return request.status === "pending" && request.payment.status.value === "card_saved" && !request.conflict;
}

/** Price, card and payment state of a priced frequency request. */
export function PaymentSummary({ payment, className }: { payment: FrequencyPaymentInfo; className?: string }) {
  const status = payment.status.value;

  return (
    <div className={cn("space-y-2 rounded-xl bg-raised px-3.5 py-3 text-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold">
          <CreditCard className="size-4 text-muted" />
          <span className="tabular">{payment.amount}</span>
        </span>
        <Badge tone={paymentTones[status]}>{payment.status.label}</Badge>
      </div>
      <p className="text-xs text-muted">
        {payment.card ? <span className="text-ink tabular">{payment.card}</span> : "Sin tarjeta registrada"}
        {payment.card_saved_at && ` · registrada ${dateTime(payment.card_saved_at, { dateStyle: "medium", timeStyle: "short" })}`}
        {payment.attempts > 0 && ` · ${payment.attempts} ${payment.attempts === 1 ? "intento de cobro" : "intentos de cobro"}`}
      </p>
      {status === "paid" && payment.charged_at && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-onair">
          <CheckCircle2 className="size-3.5" /> Cobrado el {dateTime(payment.charged_at)}
        </p>
      )}
      {status === "failed" && payment.failure_reason && (
        <p className="flex items-start gap-1.5 rounded-lg bg-danger-soft px-2.5 py-2 text-xs text-danger">
          <XCircle className="mt-px size-3.5 shrink-0" />
          <span>
            <strong className="font-semibold">Pago rechazado{payment.failed_at ? ` el ${dateTime(payment.failed_at)}` : ""}:</strong> {payment.failure_reason}
          </span>
        </p>
      )}
      {status === "unconfirmed" && (
        <p className="flex items-start gap-1.5 rounded-lg bg-warning-soft px-2.5 py-2 text-xs text-warning">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          La pasarela no confirmó el último cobro. Revísalo en el panel de Culqi antes de hacer nada más.
        </p>
      )}
    </div>
  );
}

/** Approve a priced request: the card on file is charged and, if it goes through, the station opens. */
export function PricedApprovalForm({
  request,
  onSuccess,
  onCancel,
  formId,
  onProcessing,
}: {
  request: FrequencyRequestRow & { payment: FrequencyPaymentInfo };
  onSuccess?: () => void;
  onCancel?: () => void;
  /** Rendered inside a modal whose footer holds the submit button. */
  formId?: string;
  onProcessing?: (processing: boolean) => void;
}) {
  const form = useForm({ note: DEFAULT_APPROVAL_NOTE });
  const payment = request.payment;
  const chargeable = canCharge(request);

  useEffect(() => onProcessing?.(form.processing), [form.processing, onProcessing]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(`/admin/solicitudes/${request.id}/aprobar`, { preserveScroll: true, onSuccess });
  };

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <PaymentSummary payment={payment} />
      {payment.status.value === "card_required" ? (
        <p className="text-sm text-warning">La persona aún no registra su tarjeta. Podrás aprobar cuando lo haga; le recordamos hacerlo en su perfil.</p>
      ) : request.conflict ? (
        <p className="text-sm text-warning">{request.frequency.display} ya no está libre. Rechaza la solicitud: no se cobró nada.</p>
      ) : (
        chargeable && (
          <p className="text-sm text-muted">
            Al aprobar se cobrarán <strong className="text-ink tabular">{payment.amount}</strong> a {payment.card}. Si el banco lo rechaza, la solicitud quedará como “pago pendiente” y la persona podrá pagar con otra tarjeta.
          </p>
        )
      )}
      <Field label="Nota" hint="Se incluye en el correo de aprobación. Puedes editarla." error={fieldError(form.errors, "note", "request", "frequency")}>
        {(id, invalid) => <Textarea id={id} invalid={invalid} rows={5} maxLength={500} value={form.data.note} onChange={(event) => form.setData("note", event.target.value)} />}
      </Field>
      {!formId && (
        <div className="flex gap-2">
          <Button type="submit" loading={form.processing} disabled={!chargeable} icon={<CreditCard className="size-4" />} className="flex-1">
            Aprobar y cobrar {payment.amount}
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Rechazar
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

/** After checking the processor's panel, records whether an unconfirmed charge went through. */
export function SettlePaymentModal({ request, onClose }: { request: FrequencyRequestRow & { payment: FrequencyPaymentInfo }; onClose: () => void }) {
  const form = useForm({ charged: true, reference: "" });
  const errors: Partial<Record<string, string>> = form.errors;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(`/admin/solicitudes/${request.id}/pago`, { preserveScroll: true, onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Cobro sin confirmar · ${request.station_name}`}
      description={`Busca el cargo de ${request.payment.amount} (${request.user.email}) en el panel de Culqi y registra lo que pasó.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="settle-payment" loading={form.processing} variant={form.data.charged ? "primary" : "danger"}>
            {form.data.charged ? "Confirmar pago y abrir la radio" : "Registrar que no se cobró"}
          </Button>
        </>
      }
    >
      <form id="settle-payment" onSubmit={submit} className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Resultado del cobro">
          {[
            { value: true, title: "Sí se cobró", text: "El cargo aparece como exitoso en Culqi." },
            { value: false, title: "No se cobró", text: "No hay cargo exitoso; se podrá volver a cobrar." },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={form.data.charged === option.value}
              onClick={() => form.setData("charged", option.value)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl p-3 text-left ring-1 transition",
                form.data.charged === option.value ? "bg-signal-soft ring-2 ring-signal" : "bg-surface ring-line hover:bg-raised",
              )}
            >
              <span className="text-sm font-semibold">{option.title}</span>
              <span className="text-xs text-muted">{option.text}</span>
            </button>
          ))}
        </div>
        {form.data.charged && (
          <Field label="Código del cargo" hint="Lo encuentras en el detalle del cargo en Culqi (chr_…)." error={errors.reference}>
            {(id, invalid) => <Input id={id} invalid={invalid} maxLength={120} value={form.data.reference} onChange={(event) => form.setData("reference", event.target.value)} autoFocus />}
          </Field>
        )}
        {fieldError(form.errors, "request", "frequency") && (
          <p role="alert" className="text-sm text-danger">
            {fieldError(form.errors, "request", "frequency")}
          </p>
        )}
      </form>
    </Modal>
  );
}
