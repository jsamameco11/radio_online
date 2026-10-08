import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
  /** Tighter spacing and type, for the modules of the live console desk. */
  dense?: boolean;
  className?: string;
  children: ReactNode;
}

/** A bordered surface with an optional header and footer: the basic block of every screen. */
export function Panel({ title, description, actions, footer, padded = true, dense = false, className, children }: PanelProps) {
  return (
    <section className={cn("border border-line bg-surface", dense ? "@container min-w-0 rounded-xl" : "rounded-2xl", className)}>
      {(title || actions) && (
        <header className={cn("flex flex-wrap items-start justify-between border-b border-line", dense ? "gap-2 px-3 py-2" : "gap-3 px-5 py-4")}>
          <div className="min-w-0">
            {title && <h2 className={cn("font-semibold break-words text-ink", dense ? "text-[13px]" : "text-sm")}>{title}</h2>}
            {description && <p className={cn("mt-0.5 break-words text-muted", dense ? "text-[11px] leading-snug" : "text-xs")}>{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padded && (dense ? "p-3" : "p-5"))}>{children}</div>
      {footer && <footer className={cn("flex items-center justify-end gap-2 border-t border-line", dense ? "px-3 py-2" : "px-5 py-3")}>{footer}</footer>}
    </section>
  );
}

/** A single figure with its label, for dashboards. */
export function Stat({ label, value, hint, icon }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between text-xs font-medium tracking-wide text-muted uppercase">
        <span>{label}</span>
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <div className="mt-2 font-display text-3xl font-semibold text-ink tabular">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
