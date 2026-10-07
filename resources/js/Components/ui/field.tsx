import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 text-sm text-ink placeholder:text-faint transition focus:border-ink focus:outline-none focus:ring-0 disabled:opacity-60 aria-invalid:border-danger";

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (id: string, invalid: boolean) => ReactNode;
}

/** Label, control, hint and validation message, wired together for accessibility. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children(id, Boolean(error))}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

export function Input({ className, invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={cn(control, "h-10", className)} {...props} />;
}

export function Textarea({ className, invalid, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} className={cn(control, "min-h-24 py-2.5", className)} {...props} />;
}

export function Select({ className, invalid, children, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select aria-invalid={invalid || undefined} className={cn(control, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink", className)}>
      <input type="checkbox" className="size-4 rounded border-line-strong accent-[var(--ink)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <label className={cn("flex items-start justify-between gap-4", disabled && "opacity-60")}>
      {(label || description) && (
        <span className="space-y-0.5">
          {label && <span className="block text-sm font-medium text-ink">{label}</span>}
          {description && <span className="block text-xs text-muted">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-onair" : "bg-line-strong")}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition", checked ? "left-5.5" : "left-0.5")} />
      </button>
    </label>
  );
}
