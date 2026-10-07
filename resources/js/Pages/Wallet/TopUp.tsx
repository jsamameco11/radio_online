import { router, usePage } from "@inertiajs/react";
import { CheckCircle2, Clock3, FlaskConical, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/Components/ui/button";
import { announceWalletChange } from "@/Components/wallet/wallet-events";
import SiteLayout from "@/Layouts/SiteLayout";
import { money } from "@/lib/format";
import type { SharedProps } from "@/types";
import type { Payment } from "@/types/wallet";

const POLL_MS = 3000;
const MAX_POLLS = 20;

/** Where the listener lands after the checkout: credited, still confirming, or not paid. */
export default function TopUp({ payment, balance_cents, sandbox }: { payment: Payment; balance_cents: number; sandbox: boolean }) {
  const { app } = usePage<SharedProps>().props;
  const status = payment.status.value;
  const [polls, setPolls] = useState(0);

  useEffect(() => announceWalletChange(balance_cents), [balance_cents]);

  useEffect(() => {
    if (status !== "pending" || polls >= MAX_POLLS) return;
    const timer = window.setTimeout(() => {
      router.reload({ only: ["payment", "balance_cents"] });
      setPolls((value) => value + 1);
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [status, polls]);

  const amount = money(payment.amount_cents, app.currency);
  const view = {
    succeeded: {
      icon: <CheckCircle2 className="size-14 text-onair" />,
      title: "¡Recarga acreditada!",
      text: `Sumamos ${amount} a tu billetera. Ya puedes enviar regalos.`,
    },
    refunded: {
      icon: <CheckCircle2 className="size-14 text-info" />,
      title: "Recarga reembolsada",
      text: `Devolvimos ${amount} a tu medio de pago.`,
    },
    pending: {
      icon: <Clock3 className="size-14 animate-pulse text-warning" />,
      title: "Estamos confirmando tu pago…",
      text: polls >= MAX_POLLS ? "Tu banco está tardando. Te acreditaremos el saldo apenas confirme el pago." : "Esto toma unos segundos. No cierres esta página.",
    },
    failed: {
      icon: <XCircle className="size-14 text-danger" />,
      title: "No se pudo completar el pago",
      text: payment.failure_reason ?? "Tu banco rechazó el cargo. No se cobró nada.",
    },
    cancelled: {
      icon: <XCircle className="size-14 text-muted" />,
      title: "Recarga cancelada",
      text: "No se realizó ningún cobro. Puedes intentarlo de nuevo cuando quieras.",
    },
  }[status];

  return (
    <SiteLayout title="Recarga de saldo">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6 py-10 text-center">
        {sandbox && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">
            <FlaskConical className="size-3.5" /> Modo de prueba · no se cobró ninguna tarjeta
          </span>
        )}
        {view.icon}
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold">{view.title}</h1>
          <p className="text-muted">{view.text}</p>
        </div>
        <div className="w-full rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Recarga</span>
            <span className="font-semibold tabular">{amount}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted">Saldo actual</span>
            <span className="font-display text-lg font-semibold tabular">{money(balance_cents, app.currency)}</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink href="/billetera" variant="secondary">
            Ver mi billetera
          </ButtonLink>
          {status === "succeeded" ? (
            <ButtonLink href="/en-vivo" variant="signal">
              Escuchar radios en vivo
            </ButtonLink>
          ) : (
            (status === "failed" || status === "cancelled") && <ButtonLink href="/billetera">Intentar de nuevo</ButtonLink>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
