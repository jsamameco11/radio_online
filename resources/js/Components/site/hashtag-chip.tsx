import { Link } from "@inertiajs/react";
import { cn } from "@/lib/cn";

/** "#Futbol" linking to its page; slug is the lowercase name. */
export function HashtagChip({ name, live = false, hint, className }: { name: string; live?: boolean; hint?: string; className?: string }) {
  return (
    <Link
      href={`/hashtag/${name.toLowerCase()}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition",
        live ? "border-signal/30 bg-signal-soft text-signal hover:border-signal/60" : "border-line bg-surface text-ink hover:border-line-strong hover:bg-raised",
        className,
      )}
    >
      {live && <span className="size-1.5 rounded-full bg-signal animate-onair" aria-hidden />}
      <span>#{name}</span>
      {hint && <span className="text-xs font-normal text-muted tabular">{hint}</span>}
    </Link>
  );
}
