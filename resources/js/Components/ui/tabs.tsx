import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}

export function Tabs<T extends string>({ value, onChange, items, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cn("inline-flex flex-wrap gap-1 rounded-xl border border-line bg-raised p-1", className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition",
            item.value === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {item.label}
          {item.count !== undefined && <span className="text-xs text-faint tabular">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
