import { Link, usePage } from "@inertiajs/react";
import { ArrowRight, Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import { usePersistedFlag } from "@/lib/persisted";
import type { SharedProps } from "@/types";

/** "Pon a punto tu radio": the setup steps still pending, on top of every studio page until they are all done. */
export function SetupBanner() {
  const { studio } = usePage<SharedProps>().props;
  const url = useStudioUrl();
  const [collapsed, setCollapsed] = usePersistedFlag(`studio-setup:${studio?.station.frequency.slug}:collapsed`, false);

  const steps = studio?.setup ?? [];
  const done = steps.filter((step) => step.done).length;
  if (steps.length === 0 || done === steps.length) return null;

  const next = steps.find((step) => !step.done);
  const progress = Math.round((done / steps.length) * 100);

  return (
    <section aria-label="Pon a punto tu canal" className="mb-6 rounded-2xl border border-signal/25 bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-signal-soft text-signal">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold text-ink">Pon a punto tu canal</p>
          <p className="text-xs text-muted">
            {done} de {steps.length} listos
            {collapsed && next && <span className="hidden sm:inline"> · Siguiente: {next.label}</span>}
          </p>
        </div>
        <div className="hidden w-32 items-center gap-2 sm:flex" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Progreso">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
            <span className="block h-full rounded-full bg-signal transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </span>
          <span className="text-xs text-muted tabular">{progress}%</span>
        </div>
        {collapsed && next && (
          <Link
            href={url(next.href)}
            prefetch
            className="inline-flex items-center gap-1.5 rounded-xl bg-signal px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Continuar <ArrowRight className="size-3.5" />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Mostrar pasos" : "Ocultar pasos"}
          className="grid size-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
        >
          {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
      </div>

      {!collapsed && (
        <ul className="flex flex-wrap gap-2 border-t border-line px-4 py-3 sm:px-5">
          {steps.map((step) => (
            <li key={step.key}>
              {step.done ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-faint">
                  <Check className="size-3.5 text-onair" />
                  <span className="line-through">{step.label}</span>
                </span>
              ) : (
                <Link
                  href={url(step.href)}
                  prefetch
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    step === next ? "border-signal/40 bg-signal-soft text-signal" : "border-line-strong text-ink hover:border-signal/40 hover:text-signal",
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {step.label}
                  <ArrowRight className="size-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
