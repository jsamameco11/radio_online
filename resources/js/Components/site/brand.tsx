import { cn } from "@/lib/cn";

/** The platform mark: a tuning needle crossing the dial. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-ink" />
      <g className="stroke-surface" strokeWidth="1.6" strokeLinecap="round" opacity="0.55">
        <path d="M7 21v3M11 19v5M15 21v3M21 21v3M25 19v5" />
      </g>
      <path d="M18 6v18" className="stroke-signal" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="18" cy="6.5" r="2.4" className="fill-signal" />
    </svg>
  );
}

export function BrandName({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[1.05rem] leading-none font-semibold tracking-tight text-ink", className)}>
      Tu Radio <span className="text-signal">Online</span>
    </span>
  );
}
