import { useForm } from "@inertiajs/react";
import { ArrowRight, BadgeCheck, Clock, Landmark, Send, ShieldCheck, Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import { MonetizationJourney } from "@/Components/studio/growth/monetization-journey";
import { MonetizedBadge } from "@/Components/studio/growth/monetized-badge";
import { WithdrawalForm } from "@/Components/studio/growth/withdrawal-form";
import { WithdrawalHistory } from "@/Components/studio/growth/withdrawal-history";
import { Badge } from "@/Components/ui/badge";
import { Button, ButtonLink } from "@/Components/ui/button";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { dateTime, money } from "@/lib/format";
import type { Paginated } from "@/types";
import type { MonetizationProgress, MonetizationRequestRow, PayoutMethodOption, WithdrawalRow } from "@/types/growth";

type Status = "monetized" | "pending" | "rejected" | "eligible" | "in_progress";

interface Props {
  status: Status;
  monetization: MonetizationProgress;
  request: MonetizationRequestRow | null;
  retryAt: string | null;
  wallet: { balance_cents: number; currency: string };
  withdrawals: Paginated<WithdrawalRow>;
  withdrawalInProcess: boolean;
  minWithdrawalCents: number;
  methods: PayoutMethodOption[];
  canAct: boolean;
}

export default function Monetization({ status, monetization, request, retryAt, wallet, withdrawals, withdrawalInProcess, minWithdrawalCents, methods, canAct }: Props) {
  const url = useStudioUrl();

  return (
    <StudioLayout title="Monetización">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Radio"
          title="Monetización"
          description="Tus ganancias son tuyas desde el día 1: retíralas cuando quieras. Y cuando tu audiencia crezca, conviértete en Radio monetizada."
          actions={monetization.monetized_at ? <MonetizedBadge since={monetization.monetized_at} /> : undefined}
        />

        <div className="grid gap-6 xl:grid-cols-5">
          <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 xl:col-span-2">
            <div className="absolute -top-20 -right-20 size-56 rounded-full bg-onair-soft blur-2xl" aria-hidden />
            <div className="relative flex h-full flex-col gap-5">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-onair text-on-primary">
                  <Landmark className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Saldo disponible</p>
                  <p className="font-display text-4xl font-semibold text-ink tabular">{money(wallet.balance_cents, wallet.currency)}</p>
                </div>
              </div>
              <ul className="space-y-2.5 text-sm text-muted">
                <li className="flex gap-2.5">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                  Cada regalo y cada mensaje destacado que recibes suma a este saldo.
                </li>
                <li className="flex gap-2.5">
                  <Send className="mt-0.5 size-4 shrink-0 text-onair" aria-hidden />
                  Retira desde {money(minWithdrawalCents, wallet.currency)} por transferencia, Yape, Plin o PayPal.
                </li>
                <li className="flex gap-2.5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
                  Tus datos de cobro se guardan cifrados y solo los ve el equipo de pagos.
                </li>
              </ul>
            </div>
          </section>

          <Panel className="xl:col-span-3" title="Retirar ganancias" description="Revisamos y enviamos cada retiro lo antes posible. Te avisamos por correo en cada paso.">
            {canAct ? (
              <WithdrawalForm
                url={url("/monetizacion/retiros")}
                balanceCents={wallet.balance_cents}
                currency={wallet.currency}
                minCents={minWithdrawalCents}
                methods={methods}
                inProcess={withdrawalInProcess}
              />
            ) : (
              <p className="text-sm text-muted">Solo el propietario de la radio puede solicitar retiros.</p>
            )}
          </Panel>
        </div>

        <Panel title="Historial de retiros" padded={false} footer={withdrawals.last_page > 1 ? <Pagination page={withdrawals} /> : undefined}>
          <WithdrawalHistory rows={withdrawals.data} />
        </Panel>

        {status === "monetized" && monetization.monetized_at && <MonetizedHero since={monetization.monetized_at} />}

        <MonetizationJourney
          progress={monetization}
          minWithdrawalCents={minWithdrawalCents}
          currency={wallet.currency}
          action={<JourneyAction status={status} request={request} retryAt={retryAt} canAct={canAct} />}
        />
      </div>
    </StudioLayout>
  );
}

function MonetizedHero({ since }: { since: string }) {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-gold/30 bg-linear-to-r from-gold-soft via-surface to-gold-soft px-6 py-5">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-gold text-on-primary">
        <BadgeCheck className="size-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-semibold text-ink">Tu radio es Radio monetizada</p>
        <p className="text-sm text-muted">Desde el {dateTime(since, { dateStyle: "long" })}. Es la distinción de las radios que construyeron una gran comunidad: ¡felicitaciones!</p>
      </div>
    </section>
  );
}

function JourneyAction({ status, request, retryAt, canAct }: { status: Status; request: MonetizationRequestRow | null; retryAt: string | null; canAct: boolean }) {
  const url = useStudioUrl();
  const can = useStudioCan();
  const form = useForm({});
  const errors: Partial<Record<string, string>> = form.errors;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(url("/monetizacion/solicitud"), { preserveScroll: true });
  };

  switch (status) {
    case "eligible":
      return canAct ? (
        <form onSubmit={submit} className="flex flex-col items-end gap-1.5">
          <Button type="submit" variant="signal" size="lg" icon={<BadgeCheck className="size-4" />} loading={form.processing}>
            Solicitar la monetización
          </Button>
          <span className="text-xs text-onair">¡Cumples todos los requisitos!</span>
          {errors.monetization && <span className="max-w-64 text-right text-xs text-danger">{errors.monetization}</span>}
        </form>
      ) : (
        <Badge tone="onair">Cumple los requisitos</Badge>
      );
    case "pending":
      return (
        <div className="flex flex-col items-end gap-1 text-right">
          <Badge tone="info">
            <Clock className="size-3.5" aria-hidden /> Solicitud en revisión
          </Badge>
          {request && <span className="text-xs text-muted">Enviada el {dateTime(request.created_at, { dateStyle: "medium" })}. Te avisaremos por correo.</span>}
        </div>
      );
    case "rejected":
      return (
        <div className="max-w-sm space-y-1 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          <p className="font-semibold text-warning">Revisamos tu solicitud y por ahora no fue aprobada</p>
          {request?.review_note && <p className="text-ink">“{request.review_note}”</p>}
          {retryAt && <p className="text-xs text-muted">Podrás solicitarla otra vez desde el {dateTime(retryAt, { dateStyle: "long" })}.</p>}
        </div>
      );
    case "in_progress":
      return can("analytics.view") ? (
        <ButtonLink href={url("/crecimiento")} variant="secondary" icon={<ArrowRight className="size-4" />}>
          Ver mis metas
        </ButtonLink>
      ) : null;
    default:
      return null;
  }
}
