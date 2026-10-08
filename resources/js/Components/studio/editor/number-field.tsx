import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface Props {
  value: number;
  min: number;
  max: number;
  step: number;
  digits: number;
  unit?: string;
  signed?: boolean;
  neutral?: number;
  label: string;
  onCommit: (value: number) => void;
  className?: string;
}

/**
 * A value typed by hand: accepts comma or point, clamps to the range and rounds to the precision
 * the server keeps. Enter or leaving the field applies it, Esc discards it, ↑ ↓ nudge it (Shift: ×10).
 */
export function NumberField({ value, min, max, step, digits, unit, signed = false, neutral = 0, label, onCommit, className }: Props) {
  const [draft, setDraftState] = useState<string | null>(null);
  const typed = useRef<string | null>(null);
  const setDraft = (next: string | null) => {
    typed.current = next;
    setDraftState(next);
  };
  const show = (number: number) => `${signed && number > 0 ? "+" : ""}${number.toFixed(digits)}`;
  const fit = (number: number) => {
    const factor = 10 ** digits;
    return Math.min(max, Math.max(min, Math.round(number * factor) / factor));
  };

  const commit = () => {
    const text = typed.current;
    setDraft(null);
    if (text === null) return;
    const parsed = Number(text.trim().replace(",", ".").replace("−", "-"));
    if (text.trim() !== "" && Number.isFinite(parsed)) onCommit(fit(parsed));
  };

  const nudge = (direction: 1 | -1, large: boolean) => {
    const next = fit(value + direction * step * (large ? 10 : 1));
    setDraft(show(next));
    onCommit(next);
  };

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-lg border pr-2 transition focus-within:border-signal focus-within:ring-2 focus-within:ring-signal/25",
        value !== neutral ? "border-signal/40 bg-signal-soft" : "border-line-strong bg-canvas",
        className,
      )}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={draft ?? show(value)}
        onFocus={(event) => {
          setDraft(show(value));
          const field = event.currentTarget;
          requestAnimationFrame(() => field.select());
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setDraft(null);
            event.currentTarget.blur();
          } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            nudge(event.key === "ArrowUp" ? 1 : -1, event.shiftKey);
          }
        }}
        className="h-full w-full min-w-0 bg-transparent pl-2 text-right text-xs font-semibold text-ink tabular outline-none"
      />
      {unit && <span className="ml-1 shrink-0 text-[11px] font-medium text-muted">{unit}</span>}
    </span>
  );
}
