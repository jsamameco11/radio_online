import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "signal" | "onair" | "gold" | "info" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-raised text-muted ring-line",
  signal: "bg-signal-soft text-signal ring-signal/20",
  onair: "bg-onair-soft text-onair ring-onair/20",
  gold: "bg-gold-soft text-gold ring-gold/20",
  info: "bg-info-soft text-info ring-info/20",
  warning: "bg-warning-soft text-warning ring-warning/20",
  danger: "bg-danger-soft text-danger ring-danger/20",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}
