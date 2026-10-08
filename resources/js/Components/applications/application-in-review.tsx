import { Check, Hourglass, Mail, Plus } from "lucide-react";
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
  const stages = [
    { title: "Solicitud enviada", text: `El ${dateTime(request.created_at, { dateStyle: "long", timeStyle: "short" })}.`, state: "done" },
    { title: "En revisión", text: "Verificamos tu identidad y evaluamos el proyecto de tu radio.", state: "current" },
    { title: "Respuesta", text: `Te escribiremos a ${email}. Si la aprobamos, tu estudio quedará listo en tu frecuencia.`, state: "next" },
  ] as const;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-col items-center gap-4 border-b border-line bg-warning-soft/40 px-6 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning ring-8 ring-warning-soft/40">
          <Hourglass className="size-6" aria-hidden />
        </span>
        <div className="space-y-2">
          <Badge tone="warning">{request.status_label}</Badge>
          <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Solicitud en revisión</h2>
          <p className="mx-auto max-w-md text-sm text-muted">
            Recibimos tu solicitud para <span className="font-display font-semibold text-ink tabular">{request.frequency.display}</span> · <span className="font-medium text-ink">{request.station_name}</span>. Nuestro equipo la está revisando.
          </p>
        </div>
      </div>

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
        <p className="text-xs text-muted">No necesitas hacer nada más. Si quieres retirarla, cancélala desde «Mis solicitudes».</p>
        {onApplyAgain && (
          <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={onApplyAgain}>
            Enviar otra solicitud
          </Button>
        )}
      </div>
    </section>
  );
}
