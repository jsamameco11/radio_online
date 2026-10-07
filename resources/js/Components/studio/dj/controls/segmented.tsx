import { cn } from "@/lib/cn";

const TONES = {
  signal: "border-signal/60 bg-signal-soft text-signal",
  info: "border-info/60 bg-info-soft text-info",
  ink: "border-ink/40 bg-raised text-ink",
} as const;

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  tone?: keyof typeof TONES;
  /** Layout of the row (a flex row by default). */
  className?: string;
  buttonClassName?: string;
}

/** A row of mutually exclusive hardware-style buttons (pad modes, FX beats, crossfader curves…). */
export function Segmented<T extends string | number>({ label, value, options, onChange, tone = "signal", className, buttonClassName }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={className ?? "flex gap-1"}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.hint}
          onClick={() => onChange(option.value)}
          className={cn("rounded-md border font-semibold transition", value === option.value ? TONES[tone] : "border-line bg-raised text-muted hover:text-ink", buttonClassName)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
