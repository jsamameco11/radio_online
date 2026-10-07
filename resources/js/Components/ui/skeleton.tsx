import { cn } from "@/lib/cn";

/** Placeholder for content that is still loading (deferred props). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-raised", className)} />;
}

/** A list of placeholder rows, sized like the list it stands in for. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Cargando" className={cn("space-y-3", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10" />
      ))}
    </div>
  );
}
