import { router, usePage } from "@inertiajs/react";
import { AlertCircle, ArrowLeft, CheckCircle2, CreditCard, FlaskConical, Lock, Mic2, RadioTower, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { FrequencyPaymentNotice } from "@/Components/site/frequency-payment-notice";
import { Badge } from "@/Components/ui/badge";
import { Button, ButtonLink, buttonClasses } from "@/Components/ui/button";
import { authenticateWithCulqi3DS, openCulqiCheckout } from "@/Components/wallet/culqi";
import type { Culqi3DSParameters } from "@/Components/wallet/culqi";
import SiteLayout from "@/Layouts/SiteLayout";
import { dateTime } from "@/lib/format";
import { HttpError, http } from "@/lib/http";
import type { SharedProps } from "@/types";
import type { FrequencyRequestItem } from "@/types/site";

type Mode = "card" | "pay";

type Phase = "idle" | "opening" | "sending" | "authenticating";

interface Checkout {
  driver: "culqi" | "sandbox";
  public_key?: string;
  title?: string;
  email: string;
  amount_cents: number;
  currency: string;
  action_url: string;
}

interface Props {
  request: FrequencyRequestItem & { payment: NonNullable<FrequencyRequestItem["payment"]> };
  mode: Mode | null;
  sandbox: boolean;
  checkout: Checkout | null;
  studioUrl: string | null;
}

const SANDBOX_APPROVED = "sandbox_approved";
const SANDBOX_DECLINED = "sandbox_declined";

/** A priced frequency: register the card charged on approval, or pay with another one after a decline. */
export default function FrequencyPayment({ request, mode, sandbox, checkout, studioUrl }: Props) {
  const { app } = usePage<SharedProps>().props;
  const payment = request.payment;
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = phase !== "idle";

  const refresh = () => router.reload({ only: ["request", "mode", "checkout", "studioUrl"] });

  const fail = (exception: unknown, fallback: string) => {
    setError(exception instanceof HttpError ? exception.firstError() : exception instanceof Error ? exception.message : fallback);
    setPhase("idle");
    refresh();
  };

  const send = async (token: string, email?: string, authentication?: Culqi3DSParameters) => {
    if (!checkout) return;
    setError(null);
    setPhase(authentication ? "authenticating" : "sending");

    try {
      await http.post(checkout.action_url, { token, email, authentication_3DS: authentication });
      setPhase("idle");
      refresh();
    } catch (exception) {
      if (!authentication && exception instanceof HttpError && exception.body.reason === "authentication_required") {
        void authenticate(token, email ?? checkout.email);
        return;
      }
      fail(exception, mode === "card" ? "No pudimos registrar tu tarjeta. Inténtalo de nuevo." : "No pudimos procesar el pago. Inténtalo de nuevo.");
    }
  };

  const authenticate = async (token: string, email: string) => {
    if (!checkout?.public_key) return;
    setPhase("authenticating");

    try {
      const parameters = await authenticateWithCulqi3DS({ publicKey: checkout.public_key, tokenId: token, email, amountCents: checkout.amount_cents, currency: checkout.currency });
      await send(token, email, parameters);
    } catch (exception) {
      fail(exception, "Tu banco no pudo verificar la tarjeta.");
    }
  };

  const openCheckout = async () => {
    if (!checkout) return;
    setError(null);
    setPhase("opening");

    try {
      await openCulqiCheckout(
        { publicKey: checkout.public_key ?? "", title: checkout.title ?? app.name, currency: checkout.currency, amountCents: checkout.amount_cents },
        {
          onToken: (token) => void send(token.id, token.email),
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

  const busyLabel = { idle: "", opening: "Abriendo Culqi…", sending: mode === "card" ? "Registrando tu tarjeta…" : "Procesando tu pago…", authenticating: "Verificando con tu banco…" }[phase];
  const status = payment.status.value;
  const approved = request.status === "approved";

  return (
    <SiteLayout title={`Pago de ${request.frequency.display}`}>
      <div className="mx-auto max-w-4xl space-y-6 py-4">
        <a href="/obten-tu-frecuencia" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Obtén tu canal
        </a>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="space-y-4 border-b border-line bg-raised/60 px-6 py-8 sm:px-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="gold">
                  <RadioTower className="size-3" /> Canal premium
                </Badge>
                {sandbox && (
                  <Badge tone="warning">
                    <FlaskConical className="size-3" /> Modo de prueba · no se cobra ninguna tarjeta
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-3xl font-semibold sm:text-4xl">
                {approved ? "¡Tu canal ya está abierto!" : mode === "pay" ? "Completa el pago de tu canal" : mode === "card" ? "Registra tu tarjeta" : "Pago de tu canal"}
              </h1>
              <p className="max-w-xl text-sm text-muted">
                {approved
                  ? `Cobramos ${payment.amount} y abrimos ${request.station_name} en ${request.frequency.display}. Ya puedes entrar a tu estudio.`
                  : mode === "pay"
                    ? `Aprobamos tu solicitud, pero tu banco rechazó el cobro. Paga ${payment.amount} con otra tarjeta y tu canal se abrirá en ese mismo momento.`
                    : mode === "card"
                      ? `No te cobramos nada ahora. Guardamos tu tarjeta en Culqi y cobramos ${payment.amount} solo si aprobamos tu solicitud. Si la rechazamos o la cancelas, la eliminamos.`
                      : "Aquí ves el estado del pago de tu solicitud."}
              </p>
            </div>

            <div className="space-y-5 px-6 py-6 sm:px-8">
              {approved ? (
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                  <CheckCircle2 className="size-14 text-onair" />
                  {studioUrl && (
                    <a href={studioUrl} className={buttonClasses("primary", "lg")}>
                      <Mic2 className="size-4" /> Entrar a mi estudio
                    </a>
                  )}
                </div>
              ) : (
                <FrequencyPaymentNotice request={request} showAction={false} />
              )}

              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
                </p>
              )}

              {checkout && mode && (
                <div className="space-y-3">
                  {checkout.driver === "sandbox" ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button size="lg" loading={busy} onClick={() => void send(SANDBOX_APPROVED)} icon={<FlaskConical className="size-4" />}>
                        {mode === "card" ? "Simular tarjeta válida" : "Simular pago aprobado"}
                      </Button>
                      <Button size="lg" variant="secondary" disabled={busy} onClick={() => void send(SANDBOX_DECLINED)}>
                        {mode === "card" ? "Simular tarjeta sin fondos" : "Simular pago rechazado"}
                      </Button>
                    </div>
                  ) : (
                    <Button size="lg" className="w-full" loading={busy} onClick={() => void openCheckout()} icon={<Lock className="size-4" />}>
                      {busy ? busyLabel : mode === "card" ? (status === "card_saved" ? "Usar otra tarjeta" : "Registrar tarjeta") : `Pagar ${payment.amount}`}
                    </Button>
                  )}
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <ShieldCheck className="size-3.5 shrink-0" />
                    {sandbox
                      ? mode === "card"
                        ? "La tarjeta “sin fondos” se registra bien, pero el cobro fallará al aprobar: así puedes probar el rechazo."
                        : "Simula el resultado del cobro sin usar una tarjeta real."
                      : "Tus datos viajan cifrados a Culqi; nosotros nunca vemos ni guardamos el número de tu tarjeta. Tu banco puede pedirte confirmar."}
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs text-muted">Tu solicitud</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular">{request.frequency.display}</p>
              <p className="text-sm font-medium">{request.station_name}</p>
              <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Precio</dt>
                  <dd className="font-display text-lg font-semibold tabular">{payment.amount}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Estado</dt>
                  <dd className="text-right">{request.status_label}</dd>
                </div>
                {payment.card && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">Tarjeta</dt>
                    <dd className="flex items-center gap-1.5 tabular">
                      <CreditCard className="size-3.5 text-muted" /> {payment.card}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Enviada</dt>
                  <dd>{dateTime(request.created_at, { dateStyle: "medium" })}</dd>
                </div>
              </dl>
            </div>
            <div className="space-y-2 rounded-2xl bg-raised p-5 text-xs text-muted">
              <p className="font-semibold text-ink">¿Cómo funciona el pago?</p>
              <p>1. Registras tu tarjeta al enviar la solicitud. No se cobra nada.</p>
              <p>2. Revisamos tu expediente. Si lo aprobamos, cobramos el precio y tu canal se abre al instante.</p>
              <p>3. Si tu banco rechaza el cobro, te avisamos aquí, en tu perfil y por correo para que pagues con otra tarjeta.</p>
            </div>
            <ButtonLink href="/obten-tu-frecuencia" variant="ghost" className="w-full">
              Ver mis solicitudes
            </ButtonLink>
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
