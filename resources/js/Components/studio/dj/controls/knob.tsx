import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";

const TONES = {
  signal: "text-signal",
  info: "text-info",
  gold: "text-gold",
  onair: "text-onair",
  ink: "text-ink",
} as const;

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Double click (or Enter) returns here. */
  defaultValue: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  /** The arc grows from the default value instead of from the minimum (EQ, filter). */
  bipolar?: boolean;
  tone?: keyof typeof TONES;
  size?: "sm" | "md";
  className?: string;
}

const START = -135;
const SWEEP = 270;

function arc(radius: number, from: number, to: number): string {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${20 + radius * Math.cos(rad)} ${20 + radius * Math.sin(rad)}`;
  };
  const [a, b] = from <= to ? [from, to] : [to, from];
  return `M ${point(a)} A ${radius} ${radius} 0 ${b - a > 180 ? 1 : 0} 1 ${point(b)}`;
}

/**
 * A rotary knob like the ones of a DJ mixer: drag up or down (Shift for fine steps), arrows on the
 * keyboard, double click to return to its default.
 */
export function Knob({ label, value, min, max, defaultValue, onChange, format, bipolar = false, tone = "signal", size = "md", className }: KnobProps) {
  const drag = useRef<{ y: number; value: number } | null>(null);
  const span = max - min;
  const ratio = (value - min) / span;
  const angle = START + ratio * SWEEP;
  const origin = bipolar ? START + ((defaultValue - min) / span) * SWEEP : START;
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  function down(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, value };
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const travel = event.shiftKey ? 600 : 160;
    let next = clamp(drag.current.value + ((drag.current.y - event.clientY) / travel) * span);
    if (bipolar && Math.abs(next - defaultValue) < span * 0.015) next = defaultValue;
    onChange(next);
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    const step = span / (event.shiftKey ? 200 : 40);
    const moves: Record<string, number> = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step };
    if (event.key in moves) onChange(clamp(value + moves[event.key]));
    else if (event.key === "Home") onChange(min);
    else if (event.key === "End") onChange(max);
    else if (event.key === "Enter") onChange(defaultValue);
    else return;
    event.preventDefault();
  }

  const pixels = size === "sm" ? "size-9" : "size-11";
  return (
    <div className={cn("flex flex-col items-center gap-0.5 select-none", className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value * 100) / 100}
        aria-valuetext={format ? format(value) : undefined}
        title={`${label}${format ? `: ${format(value)}` : ""} · doble clic para volver al centro`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onDoubleClick={() => onChange(defaultValue)}
        onKeyDown={key}
        className={cn("relative cursor-ns-resize touch-none rounded-full", pixels)}
      >
        <svg viewBox="0 0 40 40" className="size-full">
          <path d={arc(17, START, START + SWEEP)} className="stroke-line-strong" strokeWidth={3} fill="none" strokeLinecap="round" />
          {Math.abs(angle - origin) > 0.5 ? <path d={arc(17, origin, angle)} className={cn("stroke-current", TONES[tone])} strokeWidth={3} fill="none" strokeLinecap="round" /> : null}
          <circle cx={20} cy={20} r={12} className="fill-raised stroke-line" strokeWidth={1} />
          <line x1={20} y1={20} x2={20} y2={10} className="stroke-ink" strokeWidth={2.2} strokeLinecap="round" transform={`rotate(${angle} 20 20)`} />
        </svg>
      </div>
      <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">{label}</span>
      {format ? <span className="font-mono text-[10px] text-faint tabular">{format(value)}</span> : null}
    </div>
  );
}
