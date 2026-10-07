import { cn } from "@/lib/cn";

/** Upload progress, from 0 to 1. */
export function ProgressBar({ value, tone = "signal", className }: { value: number; tone?: "signal" | "onair" | "danger"; className?: string }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-raised", className)} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", tone === "signal" ? "bg-signal" : tone === "onair" ? "bg-onair" : "bg-danger")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
