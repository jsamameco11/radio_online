import { router, usePage } from "@inertiajs/react";
import { AlertCircle, CheckCircle2, Clock3, CreditCard, FlaskConical, Lock, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/Components/ui/button";
import { authenticateWithCulqi3DS, openCulqiCheckout } from "@/Components/wallet/culqi";
import type { Culqi3DSParameters } from "@/Components/wallet/culqi";
import { announceWalletChange } from "@/Components/wallet/wallet-events";
import SiteLayout from "@/Layouts/SiteLayout";
import { money } from "@/lib/format";
import { HttpError, http } from "@/lib/http";
import type { SharedProps } from "@/types";
import type { Payment, TopUpChargeResponse, TopUpCheckout } from "@/types/wallet";

const POLL_MS = 5000;
const MAX_POLLS = 24;

type Phase = "idle" | "opening" | "charging" | "authenticating";

interface Props {
  payment: Payment;
  balance_cents: number;
  sandbox: boolean;
  checkout: TopUpCheckout | null;
}

/** A top-up: pay it with Culqi (or the sandbox), then see whether it was credited. */
export default function TopUp({ payment, balance_cents, sandbox, checkout }: Props) {
  const { app } = usePage<SharedProps>().props;
  const status = payment.status.value;
  const verifying = status === "pending" && checkout === null;
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);
  const autoOpened = useRef(false);

  useEffect(() => announceWalletChange(balance_cents), [balance_cents]);

  useEffect(() => {
    if (!verifying || polls >= MAX_POLLS) return;
    const timer = window.setTimeout(() => {
      router.reload({ only: ["payment", "balance_cents", "checkout"] });
      setPolls((value) => value + 1);
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [verifying, polls]);

  const refresh = () => router.reload({ only: ["payment", "balance_cents", "checkout"] });

  const fail = (exception: unknown, fallback: string) => {
    setError(exception instanceof HttpError ? exception.firstError() : exception instanceof Error ? exception.message : fallback);
    setPhase("idle");
    refresh();
  };

  const charge = async (token: string, email?: string, authentication?: Culqi3DSParameters) => {
    if (!checkout) return;
    setError(null);
    setPhase(authentication ? "authenticating" : "charging");

    try {
      const response = await http.post<TopUpChargeResponse>(checkout.charge_url, { token, email, authentication_3DS: authentication });
      announceWalletChange(response.balance_cents);
      setPhase("idle");
      refresh();
    } catch (exception) {
      if (!authentication && exception instanceof HttpError && exception.body.reason === "authentication_required") {
        void authenticate(token, email ?? checkout.email);
        return;
      }
      fail(exception, "No pudimos procesar el pago. Inténtalo de nuevo.");
    }
  };

  const authenticate = async (token: string, email: string) => {
    if (!checkout?.public_key) return;
    setPhase("authenticating");

    try {
      const parameters = await authenticateWithCulqi3DS({
        publicKey: checkout.public_key,
        tokenId: token,
        email,
        amountCents: checkout.amount_cents,
        currency: checkout.currency,
      });
      await charge(token, email, parameters);
    } catch (exception) {
      fail(exception, "Tu banco no pudo verificar la compra.");
    }
  };

  const pay = async () => {
    if (!checkout) return;
    setError(null);

    if (checkout.driver === "sandbox") {
      await charge("sandbox");
      return;
    }

    setPhase("opening");
    try {
      await openCulqiCheckout(
        { publicKey: checkout.public_key ?? "", title: checkout.title ?? app.name, currency: checkout.currency, amountCents: checkout.amount_cents },
        {
          onToken: (token) => void charge(token.id, token.email),
          onError: (message) => {
            setError(message);
            setPhase("idle");
          },
        },
      );
      setPhase("idle");
    } catch (exception) {
      fail(exception, "No pudimos abrir la pasarela de pago.");
    }
  };

  useEffect(() => {
    if (autoOpened.current || checkout?.driver !== "culqi") return;
    autoOpened.current = true;
    void pay();
  });

  const amount = money(payment.amount_cents, app.currency);
  const busy = phase !== "idle";
  const payLabel = {
    idle: checkout?.driver === "sandbox" ? "Simular pago aprobado" : `Pagar ${amount}`,
    opening: "Abriendo Culqi…",
    charging: "Procesando tu pago…",
    authenticating: "Verificando con tu banco…",
  }[phase];

  const views: Record<Payment["status"]["value"], { icon: ReactNode; title: string; text: string }> = {
    succeeded: {
      icon: <CheckCircle2 className="size-14 text-onair" />,
      title: "¡Recarga acreditada!",
      text: `Sumamos ${amount} a tu billetera. Ya puedes enviar regalos.`,
    },
    refunded: {
      icon: <CheckCircle2 className="size-14 text-info" />,
      title: "Recarga reembolsada",
      text: `Devolvimos ${amount} a tu tarjeta.`,
    },
    pending: verifying
      ? {
          icon: <Clock3 className="size-14 animate-pulse text-warning" />,
          title: "Estamos confirmando tu pago",
          text:
            polls >= MAX_POLLS
              ? "Tu banco está tardando. Si se realizó el cobro, te acreditaremos el saldo apenas lo confirme: no vuelvas a pagar esta recarga."
              : "Esto puede tomar unos segundos. No vuelvas a pagar esta recarga.",
        }
      : {
          icon: <CreditCard className="size-14 text-ink" />,
          title: "Paga tu recarga",
          text: sandbox
            ? "Modo de prueba: simula un pago aprobado. No se cobra ninguna tarjeta."
            : "Ingresa tu tarjeta en la ventana segura de Culqi. Nosotros nunca vemos ni guardamos sus datos.",
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
  };
  const view = views[status];

  return (
    <SiteLayout title="Recarga de saldo">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6 py-10 text-center">
        {sandbox && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">
            <FlaskConical className="size-3.5" /> Modo de prueba · no se cobra ninguna tarjeta
          </span>
        )}
        {view.icon}
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold">{view.title}</h1>
          <p className="text-muted">{view.text}</p>
        </div>

        {error && status !== "failed" && (
          <p role="alert" className="flex w-full items-start gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-left text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}

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

        {checkout && (
          <div className="flex w-full flex-col items-center gap-2">
            <Button size="lg" className="w-full" loading={busy} onClick={() => void pay()} icon={sandbox ? <FlaskConical className="size-4" /> : <Lock className="size-4" />}>
              {payLabel}
            </Button>
            {!sandbox && <p className="text-xs text-muted">Pago procesado por Culqi. Tu banco puede pedirte confirmar la compra.</p>}
          </div>
        )}

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
