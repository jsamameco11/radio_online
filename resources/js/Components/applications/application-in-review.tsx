import { Check, CreditCard, Hourglass, Mail, Plus } from "lucide-react";
import { FrequencyPaymentNotice } from "@/Components/site/frequency-payment-notice";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";
import type { FrequencyRequestItem } from "@/types/site";

interface ApplicationInReviewProps {
  request: FrequencyRequestItem;
  email: string;
  /** Shown when the platform lets the account have another application under review. */
  onApplyAgain?: () => void;
}

/** What the applicant sees once the application is sent: its state and what comes next, without the form. */
export function ApplicationInReview({ request, email, onApplyAgain }: ApplicationInReviewProps) {
  const awaitingPayment = request.status === "awaiting_payment";
  const needsCard = request.payment?.status.value === "card_required";
  const stages = awaitingPayment
    ? ([
        { title: "Solicitud enviada", text: `El ${dateTime(request.created_at, { dateStyle: "long", timeStyle: "short" })}.`, state: "done" },
        { title: "Aprobada", text: request.reviewed_at ? `El ${dateTime(request.reviewed_at, { dateStyle: "long", timeStyle: "short" })}.` : "Tu expediente fue aprobado.", state: "done" },
        { title: "Pago", text: "Tu banco rechazó el cobro. Paga con otra tarjeta y tu canal se abrirá al instante.", state: "current" },
      ] as const)
    : ([
        { title: "Solicitud enviada", text: `El ${dateTime(request.created_at, { dateStyle: "long", timeStyle: "short" })}.`, state: "done" },
        {
          title: needsCard ? "Registra tu tarjeta" : "En revisión",
          text: needsCard ? "Revisaremos tu expediente en cuanto registres la tarjeta del canal premium." : "Verificamos tu identidad y evaluamos el proyecto de tu canal.",
          state: "current",
        },
        {
          title: "Respuesta",
          text: request.payment
            ? `Te escribiremos a ${email}. Si la aprobamos, cobramos ${request.payment.amount} y tu estudio queda listo en tu canal.`
            : `Te escribiremos a ${email}. Si la aprobamos, tu estudio quedará listo en tu canal.`,
          state: "next",
        },
      ] as const);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className={cn("flex flex-col items-center gap-4 border-b border-line px-6 py-10 text-center", awaitingPayment ? "bg-danger-soft/40" : "bg-warning-soft/40")}>
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-full ring-8",
            awaitingPayment ? "bg-danger-soft text-danger ring-danger-soft/40" : "bg-warning-soft text-warning ring-warning-soft/40",
          )}
        >
          {awaitingPayment || needsCard ? <CreditCard className="size-6" aria-hidden /> : <Hourglass className="size-6" aria-hidden />}
        </span>
        <div className="space-y-2">
          <Badge tone={awaitingPayment ? "danger" : "warning"}>{request.status_label}</Badge>
          <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{awaitingPayment ? "Aprobada: falta tu pago" : needsCard ? "Falta registrar tu tarjeta" : "Solicitud en revisión"}</h2>
          <p className="mx-auto max-w-md text-sm text-muted">
            {awaitingPayment ? "Aprobamos tu solicitud para " : "Recibimos tu solicitud para "}
            <span className="font-display font-semibold text-ink tabular">{request.frequency.display}</span> · <span className="font-medium text-ink">{request.station_name}</span>.
            {awaitingPayment ? " Solo falta completar el pago." : " Nuestro equipo la está revisando."}
          </p>
        </div>
      </div>

      {request.payment && (
        <div className="border-b border-line px-6 py-5">
          <FrequencyPaymentNotice request={request} />
        </div>
      )}

      <ol className="space-y-5 px-6 py-6">
        {stages.map((stage, index) => (
          <li key={stage.title} className="flex gap-4">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1",
                stage.state === "done" && "bg-onair-soft text-onair ring-onair/30",
                stage.state === "current" && "bg-warning-soft text-warning ring-warning/30",
                stage.state === "next" && "bg-raised text-faint ring-line",
              )}
            >
              {stage.state === "done" ? <Check className="size-4" aria-hidden /> : stage.state === "current" ? <Hourglass className="size-4" aria-hidden /> : <Mail className="size-4" aria-hidden />}
              <span className="sr-only">Paso {index + 1}</span>
            </span>
            <span className="pt-1">
              <span className={cn("block text-sm font-medium", stage.state === "next" ? "text-muted" : "text-ink")}>{stage.title}</span>
              <span className="block text-xs text-muted">{stage.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-raised/50 px-6 py-4">
        <p className="text-xs text-muted">
          {request.payment && (awaitingPayment || needsCard) ? "Completa el paso de pago para continuar." : "No necesitas hacer nada más."} Si quieres retirarla, cancélala desde «Mis solicitudes».
        </p>
        {onApplyAgain && (
          <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={onApplyAgain}>
            Enviar otra solicitud
          </Button>
        )}
      </div>
    </section>
  );
}
