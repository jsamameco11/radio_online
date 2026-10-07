import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Option } from "@/types/site";

interface ChoiceChipsProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  label: string;
  invalid?: boolean;
}

/** Multiple choice as toggle chips, in the order of the options. */
export function ChoiceChips({ options, value, onChange, max, label, invalid = false }: ChoiceChipsProps) {
  const full = max !== undefined && value.length >= max;

  const toggle = (option: string) => {
    if (value.includes(option)) onChange(value.filter((item) => item !== option));
    else if (!full) onChange(options.map((item) => item.value).filter((item) => item === option || value.includes(item)));
  };

  return (
    <div role="group" aria-label={label} aria-invalid={invalid || undefined} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={!selected && full}
            onClick={() => toggle(option.value)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm ring-1 transition disabled:cursor-not-allowed disabled:opacity-40",
              selected ? "bg-primary text-on-primary ring-primary" : cn("bg-surface text-ink hover:bg-raised", invalid ? "ring-danger" : "ring-line-strong"),
            )}
          >
            {selected && <Check className="size-3.5" aria-hidden />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
