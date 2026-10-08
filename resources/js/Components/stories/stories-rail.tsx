import { useCallback, useEffect, useMemo, useState } from "react";
import { StationLogo } from "@/Components/station/station-identity";
import { cn } from "@/lib/cn";
import { http } from "@/lib/http";
import type { Station } from "@/types";
import type { Story, StoryRailItem } from "@/types/stories";
import { StoryRing } from "./story-ring";
import { seenUntil } from "./story-style";
import { StoryViewer } from "./story-viewer";

/** The stations with estados, as a row of logos at the top of the home page; hidden when there are none. */
export function StoriesRail({ className }: { className?: string }) {
  const [items, setItems] = useState<StoryRailItem[]>([]);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    http
      .get<{ stations: StoryRailItem[] }>("/estados")
      .then((data) => {
        if (!active) return;
        setItems(
          data.stations.map((item) => {
            const until = seenUntil(item.station.id);
            return { ...item, seen: item.seen || (until !== null && until >= item.latest_at) };
          }),
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const markSeen = useCallback((station: Station, _story: Story, last: boolean) => {
    if (!last) return;
    setItems((current) => current.map((item) => (item.station.id === station.id ? { ...item, seen: true } : item)));
  }, []);

  const stations = useMemo(() => items.map((item) => item.station), [items]);

  if (items.length === 0) return null;

  return (
    <section aria-label="Estados de las radios" className={className}>
      <ul className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pt-1 pb-2 [scrollbar-width:none]">
        {items.map((item, index) => (
          <li key={item.station.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setOpen(index)}
              className="group flex w-20 flex-col items-center gap-1.5 rounded-2xl text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              aria-label={`Ver los estados de ${item.station.display_name}${item.seen ? "" : " (nuevos)"}`}
            >
              <span className="relative">
                <StoryRing seen={item.seen} className="rounded-full transition group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                  <StationLogo station={item.station} size="md" className="rounded-full ring-0" />
                </StoryRing>
                {item.station.stream_status.value === "live" && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-md bg-signal px-1.5 py-px text-[0.6rem] font-bold tracking-wider whitespace-nowrap text-white ring-2 ring-canvas">
                    EN VIVO
                  </span>
                )}
              </span>
              <span className="w-full leading-tight">
                <span className={cn("block text-xs font-semibold tabular", item.seen ? "text-muted" : "text-ink")}>{item.station.frequency.label}</span>
                <span className="block truncate text-[0.7rem] text-faint">{item.station.name}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <StoryViewer stations={stations} startAt={open} onClose={() => setOpen(null)} onSeen={markSeen} />}
    </section>
  );
}
