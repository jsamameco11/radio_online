import { CheckCircle2, Headphones, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { GoalProgress } from "@/Components/studio/growth/goal-progress";
import { MonetizedBadge } from "@/Components/studio/growth/monetized-badge";
import { cn } from "@/lib/cn";
import { count, dateTime, money } from "@/lib/format";
import type { MonetizationProgress } from "@/types/growth";

const day = (date: string, options: Intl.DateTimeFormatOptions) => dateTime(`${date}T12:00:00`, options);

/**
 * The road to "Radio monetizada": subscribers and consecutive days with a big
 * live audience, the last days' peaks, and the call to action of each stage.
 */
export function MonetizationJourney({ progress, minWithdrawalCents, currency, action }: { progress: MonetizationProgress; minWithdrawalCents: number; currency: string; action?: ReactNode }) {
  const { subscribers, live } = progress;
  const missingSubscribers = Math.max(0, subscribers.target - subscribers.current);
  const peakScale = Math.max(live.threshold, ...live.recent_days.map((item) => item.peak));

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-linear-to-br from-raised to-surface px-6 py-5">
        <div className="max-w-2xl space-y-1.5">
          <p className="text-xs font-semibold tracking-[0.14em] text-gold uppercase">Programa de monetización</p>
          <h2 className="font-display text-xl font-semibold text-ink">{progress.monetized_at ? "¡Eres Radio monetizada!" : "Conviértete en Radio monetizada"}</h2>
          <p className="text-sm text-muted">
            Al alcanzar {count(subscribers.target)} suscriptores y {live.days_required} días seguidos con {count(live.threshold)} oyentes en vivo, solicita la monetización y conviértete en Radio
            monetizada.
          </p>
        </div>
        {progress.monetized_at ? <MonetizedBadge since={progress.monetized_at} /> : action}
      </header>

      <div className="grid gap-6 px-6 py-5 lg:grid-cols-2">
        <Requirement
          icon={<Users className="size-4" />}
          met={subscribers.met}
          title={`${count(subscribers.target)} suscriptores`}
          hint={subscribers.met ? "¡Meta cumplida!" : `Te faltan ${count(missingSubscribers)}. Comparte tu radio e invita a tus oyentes a suscribirse.`}
        >
          <GoalProgress current={subscribers.current} target={subscribers.target} tone="onair" size="lg" label="Suscriptores" />
          <p className="text-xs text-muted tabular">
            <span className="font-semibold text-ink">{count(subscribers.current)}</span> de {count(subscribers.target)}
          </p>
        </Requirement>

        <Requirement
          icon={<Headphones className="size-4" />}
          met={live.met}
          title={`${live.days_required} días seguidos con ${count(live.threshold)} oyentes en vivo`}
          hint={
            live.met
              ? "¡Meta cumplida!"
              : live.current_run > 0
                ? `Vas ${live.current_run} de ${live.days_required}: vuelve a superar ${count(live.threshold)} oyentes hoy para no cortar la racha.`
                : `Un día cuenta cuando una de tus transmisiones llega a ${count(live.threshold)} oyentes a la vez.`
          }
        >
          <div className="flex gap-1.5" aria-label={`Mejor racha: ${live.best_run} de ${live.days_required} días`}>
            {Array.from({ length: live.days_required }, (_, index) => (
              <span key={index} className={cn("h-3 flex-1 rounded-full", index < Math.min(live.best_run, live.days_required) ? "bg-signal" : "bg-raised ring-1 ring-line ring-inset")} />
            ))}
          </div>
          <p className="text-xs text-muted">
            Mejor racha: <span className="font-semibold text-ink tabular">{live.best_run === 1 ? "1 día" : `${live.best_run} días`}</span>
            {live.best_run_days.length > 0 && ` (${live.best_run_days.map((item) => day(item.date, { day: "numeric", month: "short" })).join(", ")})`}
          </p>
        </Requirement>
      </div>

      <div className="space-y-2 border-t border-line px-6 py-5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold tracking-[0.14em] text-muted uppercase">Pico en vivo · últimos {live.recent_days.length} días</span>
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span className="h-0.5 w-4 border-t border-dashed border-signal" aria-hidden /> Meta: {count(live.threshold)}
          </span>
        </div>
        <div className="relative flex h-24 items-end gap-1" role="img" aria-label="Pico de oyentes en vivo por día">
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-signal/60" style={{ bottom: `${(live.threshold / peakScale) * 100}%` }} aria-hidden />
          {live.recent_days.map((item) => (
            <div key={item.date} className="group relative flex h-full flex-1 items-end">
              <div
                className={cn("w-full rounded-t transition", item.qualifies ? "bg-signal" : "bg-line-strong group-hover:bg-faint")}
                style={{ height: item.peak > 0 ? `${Math.max(4, (item.peak / peakScale) * 100)}%` : "2px" }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg group-hover:block">
                <p className="font-semibold tabular">{count(item.peak)} oyentes</p>
                <p className="text-muted capitalize">{day(item.date, { weekday: "long", day: "numeric", month: "short" })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="flex items-center gap-3 border-t border-line bg-onair-soft/50 px-6 py-3.5 text-sm text-ink">
        <Wallet className="size-4 shrink-0 text-onair" aria-hidden />
        <p>
          Tus ganancias son tuyas desde el día 1: puedes retirarlas desde <span className="font-semibold">{money(minWithdrawalCents, currency)}</span>.
        </p>
      </footer>
    </section>
  );
}

function Requirement({ icon, met, title, hint, children }: { icon: ReactNode; met: boolean; title: string; hint: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", met ? "bg-onair text-on-primary" : "bg-raised text-muted ring-1 ring-line ring-inset")}>
          {met ? <CheckCircle2 className="size-4" aria-hidden /> : icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="text-xs text-muted">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
