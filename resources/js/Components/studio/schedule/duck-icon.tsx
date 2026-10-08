import { cn } from "@/lib/cn";

/** Music lowered under a voice or an announcement. */
export function DuckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn("size-4", className)}>
      <path d="M3 9.5h3L10 6v12l-4-3.5H3z" />
      <path d="M14 10l3.5 3.5L21 10M17.5 13.5V5" />
    </svg>
  );
}
