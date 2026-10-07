import { cn } from "@/lib/cn";

interface BarListProps {
  items: { key: string; label: string; value: number; hint?: string }[];
  /** Background color class of the bars, e.g. "bg-onair". */
  tone?: string;
  format?: (value: number) => string;
  className?: string;
}

/** Ranked horizontal bars (countries, devices, sources). */
export function BarList({ items, tone = "bg-signal", format = String, className }: BarListProps) {
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item) => (
        <li key={item.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink">{item.label}</span>
            <span className="shrink-0 text-muted tabular">
              {format(item.value)}
              {item.hint && <span className="ml-2 text-xs text-faint">{item.hint}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-raised">
            <div className={cn("h-full rounded-full", tone)} style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
