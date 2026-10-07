import { cn } from "@/lib/cn";

type Tone = "signal" | "onair" | "gold" | "info";

const fills: Record<Tone, string> = {
  signal: "bg-signal",
  onair: "bg-onair",
  gold: "bg-gold",
  info: "bg-info",
};

/** How far a figure is from its target, as a rounded bar. */
export function GoalProgress({ current, target, tone = "gold", size = "md", label, className }: { current: number; target: number; tone?: Tone; size?: "sm" | "md" | "lg"; label?: string; className?: string }) {
  const percent = target > 0 ? Math.round(Math.max(0, Math.min(1, current / target)) * 100) : 0;
  const height = { sm: "h-1.5", md: "h-2", lg: "h-3" }[size];

  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-raised ring-1 ring-line ring-inset", height, className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", fills[tone])} style={{ width: `${Math.max(percent, current > 0 ? 3 : 0)}%` }} />
    </div>
  );
}
