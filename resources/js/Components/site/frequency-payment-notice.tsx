import { AlertTriangle, CheckCircle2, Clock3, CreditCard, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { buttonClasses } from "@/Components/ui/button";
import { useAppUrl } from "@/lib/app-url";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";
import type { FrequencyPaymentInfo, FrequencyPaymentStatus, FrequencyRequestItem } from "@/types/site";

interface View {
  icon: ReactNode;
  tone: string;
  title: string;
  text: string;
  action?: string;
}

function view(payment: FrequencyPaymentInfo): View {
  const views: Record<FrequencyPaymentStatus, View> = {
    card_required: {
      icon: <CreditCard className="size-4" />,
      tone: "bg-warning-soft text-warning ring-warning/25",
      title: "Falta registrar tu tarjeta",
      text: `Tu solicitud no se revisará hasta que registres la tarjeta. Se cobrarán ${payment.amount} solo si la aprobamos.`,
      action: "Registrar tarjeta",
    },
    card_saved: {
      icon: <CreditCard className="size-4" />,
      tone: "bg-info-soft text-info ring-info/25",
      title: `Tarjeta registrada${payment.card ? ` · ${payment.card}` : ""}`,
      text: `Cobraremos ${payment.amount} solo si aprobamos tu solicitud. Hoy no se cobró nada.`,
      action: "Cambiar tarjeta",
    },
    failed: {
      icon: <XCircle className="size-4" />,
      tone: "bg-danger-soft text-danger ring-danger/25",
      title: "Tu banco rechazó el pago",
      text: `${payment.failure_reason ?? "No se pudo completar el cobro."} Aprobamos tu solicitud: paga ${payment.amount} con otra tarjeta y tu canal se abrirá en ese momento.`,
      action: `Pagar ${payment.amount}`,
    },
    unconfirmed: {
      icon: <Clock3 className="size-4" />,
      tone: "bg-warning-soft text-warning ring-warning/25",
      title: "Estamos confirmando tu pago",
      text: "Tu banco no respondió a tiempo. No vuelvas a pagar: lo revisamos y te escribiremos apenas se confirme.",
    },
    paid: {
      icon: <CheckCircle2 className="size-4" />,
      tone: "bg-onair-soft text-onair ring-onair/25",
      title: `Pagado · ${payment.amount}`,
      text: payment.charged_at ? `Cobrado el ${dateTime(payment.charged_at)}.` : "Pago confirmado.",
    },
    cancelled: {
      icon: <AlertTriangle className="size-4" />,
      tone: "bg-raised text-muted ring-line",
      title: "Pago cancelado",
      text: "No se cobró nada y eliminamos tu tarjeta.",
    },
  };

  return views[payment.status.value];
}

/** Where the payment of a priced frequency stands, with the next step for its applicant. */
export function FrequencyPaymentNotice({ request, showAction = true, className }: { request: FrequencyRequestItem; showAction?: boolean; className?: string }) {
  const appUrl = useAppUrl();
  const payment = request.payment;
  if (!payment) return null;

  const current = view(payment);
  const href = request.payment_url ? appUrl("public", request.payment_url) : null;

  return (
    <div className={cn("space-y-2 rounded-xl px-3.5 py-3 ring-1 ring-inset", current.tone, className)}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        {current.icon}
        {current.title}
      </p>
      <p className="text-xs leading-relaxed text-ink/80">{current.text}</p>
      {showAction && href && current.action && (
        <a href={href} className={buttonClasses(payment.status.value === "card_saved" ? "secondary" : "primary", "sm")}>
          <CreditCard className="size-3.5" /> {current.action}
        </a>
      )}
    </div>
  );
}
