import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const TONES = {
  signal: "border-signal/50 bg-signal-soft text-signal",
  onair: "border-onair/50 bg-onair-soft text-onair",
  gold: "border-gold/50 bg-gold-soft text-gold",
  info: "border-info/50 bg-info-soft text-info",
} as const;

interface PillProps {
  on: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}

/** A small hardware-style button that lights up in its tone while on. */
export function Pill({ on, onClick, title, children, tone = "signal", className }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={cn("inline-flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-semibold tracking-wide uppercase transition", on ? TONES[tone] : "border-line bg-raised text-muted hover:text-ink", className)}
    >
      {children}
    </button>
  );
}
