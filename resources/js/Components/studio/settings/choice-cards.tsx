import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Choice<T extends string> {
  value: T;
  title: string;
  description: ReactNode;
}

/** A radio group drawn as cards: each option with its title and what it does. */
export function ChoiceCards<T extends string>({ legend, name, value, choices, onChange, className }: { legend: string; name: string; value: T; choices: Choice<T>[]; onChange: (value: T) => void; className?: string }) {
  return (
    <fieldset className={cn("grid content-start gap-2", className)}>
      <legend className="mb-1.5 text-sm font-medium text-ink">{legend}</legend>
      {choices.map((choice) => {
        const active = choice.value === value;
        return (
          <label key={choice.value} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition", active ? "border-signal bg-signal-soft" : "border-line bg-surface hover:border-line-strong")}>
            <input type="radio" name={name} value={choice.value} checked={active} onChange={() => onChange(choice.value)} className="mt-0.5 size-4 shrink-0 accent-signal" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{choice.title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted">{choice.description}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
