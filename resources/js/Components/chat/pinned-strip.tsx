import { Pin } from "lucide-react";
import { useEffect, useState } from "react";
import { tierLook } from "@/Components/chat/highlight-tiers";
import { cn } from "@/lib/cn";

export interface PinnedItem {
  id: string;
  level: number;
  amount: string;
  name: string;
  body: string;
  createdAt: string;
  pinnedUntil: string;
}

/** Messages still pinned at this moment, re-evaluated every second. */
export function usePinnedNow<T extends { pinnedUntil: string }>(items: T[]): T[] {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (items.length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  return items.filter((item) => new Date(item.pinnedUntil).getTime() > now);
}

/**
 * The highlighted messages still pinned at the top of a chat, the most
 * valuable first, each with a bar that empties until it unpins.
 */
export function PinnedStrip({ items, className }: { items: PinnedItem[]; className?: string }) {
  const pinned = usePinnedNow(items).sort((a, b) => b.level - a.level || b.createdAt.localeCompare(a.createdAt));
  if (pinned.length === 0) return null;

  return (
    <div className={cn("flex snap-x gap-2 overflow-x-auto border-b border-line px-3 py-2.5", className)} aria-label="Mensajes destacados fijados">
      {pinned.map((item) => {
        const look = tierLook(item.level);
        const start = new Date(item.createdAt).getTime();
        const end = new Date(item.pinnedUntil).getTime();
        const left = Math.max(0, Math.min(1, (end - Date.now()) / Math.max(1, end - start)));

        return (
          <article key={item.id} className={cn("relative w-60 shrink-0 snap-start overflow-hidden rounded-xl border px-3 pt-2 pb-2.5", look.card)}>
            {look.sheen && <span className={cn("animate-sheen pointer-events-none absolute inset-0", look.accent)} aria-hidden />}
            <div className="relative flex items-center gap-1.5 text-xs">
              <Pin className={cn("size-3 shrink-0", look.accent)} aria-hidden />
              <span className="truncate font-semibold text-ink">{item.name}</span>
              <span className={cn("ml-auto shrink-0 rounded-full px-1.5 py-px text-[0.65rem] font-bold tabular", look.badge)}>{item.amount}</span>
            </div>
            <p className="relative mt-1 line-clamp-2 text-xs leading-snug text-ink">{item.body}</p>
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-line" aria-hidden>
              <span className={cn("block h-full transition-[width] duration-1000 ease-linear", look.bar)} style={{ width: `${left * 100}%` }} />
            </span>
          </article>
        );
      })}
    </div>
  );
}
