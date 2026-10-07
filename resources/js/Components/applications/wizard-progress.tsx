import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface WizardProgressProps {
  steps: readonly { key: string; title: string; description: string }[];
  current: number;
  /** Furthest step reached: earlier ones can be revisited. */
  reached: number;
  /** Steps with validation errors from the server. */
  failing?: number[];
  onSelect: (index: number) => void;
}

/** Numbered steps of a long form with a progress bar; reached steps are clickable. */
export function WizardProgress({ steps, current, reached, failing = [], onSelect }: WizardProgressProps) {
  const percent = Math.round((current / (steps.length - 1)) * 100);

  return (
    <nav aria-label="Pasos de la solicitud" className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          Paso <span className="font-semibold text-ink tabular">{current + 1}</span> de {steps.length}
        </span>
        <span className="tabular">{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Avance">
        <div className="h-full rounded-full bg-signal transition-[width] duration-500" style={{ width: `${Math.max(percent, 4)}%` }} />
      </div>
      <ol className="grid grid-cols-5 gap-2">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const error = failing.includes(index);
          return (
            <li key={step.key}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                disabled={index > reached}
                aria-current={active ? "step" : undefined}
                className="group flex w-full flex-col items-center gap-2 text-center disabled:cursor-not-allowed sm:flex-row sm:items-start sm:text-left"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 transition",
                    error ? "bg-danger-soft text-danger ring-danger/40" : active ? "bg-ink text-surface ring-ink" : done ? "bg-onair-soft text-onair ring-onair/30" : "bg-surface text-faint ring-line-strong",
                  )}
                >
                  {done && !error ? <Check className="size-4" aria-hidden /> : index + 1}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className={cn("block truncate text-sm font-medium", active ? "text-ink" : "text-muted group-enabled:group-hover:text-ink")}>{step.title}</span>
                  <span className="block truncate text-xs text-faint">{step.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-sm font-medium sm:hidden">{steps[current]?.title}</p>
    </nav>
  );
}
