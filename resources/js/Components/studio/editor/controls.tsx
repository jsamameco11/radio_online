import type { CSSProperties, ReactNode } from "react";
import { Badge } from "@/Components/ui/badge";
import { cn } from "@/lib/cn";
import type { Recipe } from "@/lib/media/editor/recipe";
import { NumberField } from "./number-field";

/** A change of the recipe; changes with the same group made within a moment undo as one step. */
export type Update = (patch: Partial<Recipe>, group?: string) => void;

const thumb =
  "[&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-signal [&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-signal [&::-moz-range-thumb]:bg-ink";

export const rangeClass = cn("h-1.5 cursor-pointer appearance-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal", thumb);

/** Track of a range filled from the neutral point to the value, so a boost and a cut read at a glance. */
export function rangeFill(value: number, min: number, max: number, neutral: number, direction: "right" | "top" = "right"): CSSProperties {
  const percent = ((value - min) / (max - min)) * 100;
  const zero = ((neutral - min) / (max - min)) * 100;
  const from = Math.min(zero, percent);
  const to = Math.max(zero, percent);
  return { background: `linear-gradient(to ${direction}, var(--line-strong) ${from}%, var(--signal) ${from}% ${to}%, var(--line-strong) ${to}%)` };
}

interface SliderProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (value: number) => string;
  group: keyof Recipe;
  onChange: Update;
  badge?: ReactNode;
  neutral?: number;
  unit?: string;
  digits?: number;
  signed?: boolean;
}

/** A control with its typed value, a text status and double click to go back to neutral. */
export function Slider({ label, hint, value, min, max, step = 1, format, group, onChange, badge, neutral = 0, unit, digits = 0, signed = false }: SliderProps) {
  const set = (next: number) => onChange({ [group]: next } as Partial<Recipe>, group);
  return (
    <div title="Doble clic para volver a cero" onDoubleClick={() => set(neutral)}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-ink">
          {label}
          {badge}
        </span>
        <NumberField value={value} min={min} max={max} step={step} digits={digits} unit={unit} signed={signed} neutral={neutral} label={label} onCommit={set} className="w-[5.25rem] shrink-0" />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={format(value)}
        onChange={(event) => set(Number(event.target.value))}
        className={cn(rangeClass, "mt-3 w-full")}
        style={rangeFill(value, min, max, neutral)}
      />
      <div className="mt-1.5 flex items-start justify-between gap-3">
        {hint && <span className="block text-[11.5px] leading-[1.45] text-muted">{hint}</span>}
        <span className={cn("ml-auto shrink-0 text-[11px] font-medium", value !== neutral ? "text-signal" : "text-faint")}>{format(value)}</span>
      </div>
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange, badge }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void; badge?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 text-left">
      <span className={cn("mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition", checked ? "bg-signal" : "bg-line-strong")}>
        <span className={cn("size-4 rounded-full bg-ink shadow transition", checked && "translate-x-4")} />
      </span>
      <span>
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          {label}
          {badge}
        </span>
        {hint && <span className="mt-0.5 block text-[11.5px] leading-[1.45] text-muted">{hint}</span>}
      </span>
    </button>
  );
}

/** Marks a treatment the browser cannot play live. */
export function FinalOnly() {
  return (
    <span title="Este filtro se aplica en el servidor: escúchalo con «Escuchar el resultado final».">
      <Badge tone="info" className="px-2 text-[10px] font-semibold">
        En la muestra final
      </Badge>
    </span>
  );
}
