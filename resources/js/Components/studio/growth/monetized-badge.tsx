import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";

/** The "Radio monetizada" distinction the platform grants with an approved monetization request. */
export function MonetizedBadge({ since, size = "md", className }: { since?: string | null; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-gold-soft font-semibold text-gold ring-1 ring-gold/30 ring-inset",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className,
      )}
      title={since ? `Radio monetizada desde el ${dateTime(since, { dateStyle: "long" })}` : undefined}
    >
      <BadgeCheck className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      Radio monetizada
    </span>
  );
}
