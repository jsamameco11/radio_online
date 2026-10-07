import { Link } from "@inertiajs/react";
import { ChevronLeft, ChevronRight, Radio } from "lucide-react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, WheelEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListenButton, usePlayer } from "@/Components/player";
import { StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { Switch } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import type { Station } from "@/types";
import type { DialBand } from "@/types/site";

const PX_PER_MHZ = 120;
/** How close the needle must be to a station to receive it, in MHz. */
const CAPTURE = 0.12;

function mhz(station: Station): number {
  return Number(station.frequency.label);
}

interface FmDialProps {
  stations: Station[];
  band: DialBand;
  /** Frequency slug to start on ("89-30"). */
  initial?: string | null;
}

/**
 * A receiver to tune by scrolling, dragging, with the arrows or the keyboard:
 * the needle stays in the middle and the band slides under it.
 */
export function FmDial({ stations, band, initial }: FmDialProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const player = usePlayer();
  const [position, setPosition] = useState(band.min);
  const [autoplay, setAutoplay] = useState(false);
  const width = (band.max - band.min) * PX_PER_MHZ;

  /** Every 0.1 MHz of the band, in tenths so the scale has no rounding drift. */
  const tenths = useMemo(() => {
    const list: number[] = [];
    for (let tenth = Math.ceil(band.min * 10); tenth <= Math.floor(band.max * 10); tenth++) list.push(tenth);
    return list;
  }, [band.min, band.max]);

  const tuned = useMemo(() => {
    let best: Station | null = null;
    for (const station of stations) {
      const distance = Math.abs(mhz(station) - position);
      if (distance <= CAPTURE && (!best || distance < Math.abs(mhz(best) - position))) best = station;
    }
    return best;
  }, [stations, position]);

  const tuneTo = useCallback(
    (frequency: number, smooth = true) => {
      const element = scroller.current;
      if (!element) return;
      element.scrollTo({ left: (frequency - band.min) * PX_PER_MHZ, behavior: smooth ? "smooth" : "auto" });
    },
    [band.min],
  );

  useEffect(() => {
    const start =
      stations.find((station) => station.frequency.slug === initial) ??
      (player.station ? stations.find((station) => player.isCurrent(station)) : undefined) ??
      stations.find((station) => station.stream_status.value === "live") ??
      stations.find((station) => station.stream_status.audible) ??
      stations[0];
    tuneTo(start ? mhz(start) : (band.min + band.max) / 2, false);
  }, []);

  useEffect(() => {
    if (!autoplay || !tuned || player.isCurrent(tuned)) return;
    const timer = window.setTimeout(() => player.play(tuned), 700);
    return () => window.clearTimeout(timer);
  }, [autoplay, tuned, player]);

  const onScroll = () => {
    const element = scroller.current;
    if (element) setPosition(band.min + element.scrollLeft / PX_PER_MHZ);
  };

  const neighbour = (direction: 1 | -1): Station | undefined => {
    const sorted = direction === 1 ? stations : [...stations].reverse();
    return sorted.find((station) => (direction === 1 ? mhz(station) > position + 0.05 : mhz(station) < position - 0.05));
  };

  const seek = (direction: 1 | -1) => {
    const next = neighbour(direction);
    if (next) tuneTo(mhz(next));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    if (event.shiftKey) seek(direction);
    else tuneTo(Math.min(band.max, Math.max(band.min, Math.round((position + direction * 0.1) * 10) / 10)));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !scroller.current) return;
    drag.current = { x: event.clientX, left: scroller.current.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current && scroller.current) scroller.current.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (scroller.current && Math.abs(event.deltaY) > Math.abs(event.deltaX)) scroller.current.scrollLeft += event.deltaY;
  };

  return (
    <div className="theme-dark overflow-hidden rounded-[2rem] border border-line bg-canvas text-ink shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)]">
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-2" aria-live="polite">
          <p className="flex items-baseline gap-2 font-display font-semibold tabular">
            <span className="text-6xl sm:text-7xl">{position.toFixed(2)}</span>
            <span className="text-xl text-muted">{band.name}</span>
          </p>
          {tuned ? (
            <div className="flex flex-wrap items-center gap-3">
              <StationLogo station={tuned} size="sm" />
              <Link href={`/radio/${tuned.frequency.slug}`} className="font-display text-xl font-semibold hover:underline">
                {tuned.name}
              </Link>
              <StreamStatusBadge status={tuned.stream_status.value} />
            </div>
          ) : (
            <p className="flex items-center gap-2 text-muted">
              <Radio className="size-4" /> Sin señal en esta frecuencia. Sigue girando.
            </p>
          )}
          {tuned?.current_topic && <p className="text-sm text-muted">Ahora: {tuned.current_topic.title}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => seek(-1)} className="flex size-11 items-center justify-center rounded-full border border-line-strong text-ink hover:bg-raised" aria-label="Radio anterior">
            <ChevronLeft className="size-5" />
          </button>
          {tuned ? (
            <ListenButton station={tuned} size="lg" />
          ) : (
            <span className="flex h-12 min-w-36 items-center justify-center rounded-xl border border-dashed border-line-strong px-4 text-sm text-faint">Busca una radio</span>
          )}
          <button type="button" onClick={() => seek(1)} className="flex size-11 items-center justify-center rounded-full border border-line-strong text-ink hover:bg-raised" aria-label="Radio siguiente">
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative border-t border-line bg-surface">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2 bg-signal shadow-[0_0_14px_var(--signal)]" aria-hidden />
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-surface to-transparent" aria-hidden />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-surface to-transparent" aria-hidden />
        <div
          ref={scroller}
          role="slider"
          tabIndex={0}
          aria-label="Dial de frecuencias"
          aria-valuemin={band.min}
          aria-valuemax={band.max}
          aria-valuenow={Number(position.toFixed(2))}
          aria-valuetext={tuned ? `${tuned.frequency.display}, ${tuned.name}` : `${position.toFixed(1)} ${band.name}, sin señal`}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          className="cursor-grab overflow-x-auto overscroll-x-contain [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
        >
          <div className="relative h-36 select-none" style={{ width: `calc(${width}px + 100%)` }}>
            <div className="absolute inset-y-0" style={{ left: "50%", width }}>
              {tenths.map((tenth) => {
                const major = tenth % 10 === 0;
                const half = tenth % 10 === 5;
                return (
                  <span key={tenth} className="absolute bottom-0" style={{ left: (tenth / 10 - band.min) * PX_PER_MHZ }}>
                    <span className={cn("absolute bottom-0 block w-px -translate-x-1/2", major ? "h-9 bg-ink" : half ? "h-6 bg-muted" : "h-3.5 bg-faint")} />
                    {major && (tenth / 10) % 2 === 0 && (
                      <span className="absolute bottom-11 -translate-x-1/2 font-display text-sm font-medium text-muted tabular">{tenth / 10}</span>
                    )}
                  </span>
                );
              })}
              {stations.map((station) => {
                const isTuned = tuned?.id === station.id;
                return (
                  <button
                    key={station.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => tuneTo(mhz(station))}
                    className="absolute top-4 -translate-x-1/2"
                    style={{ left: (mhz(station) - band.min) * PX_PER_MHZ }}
                    title={station.display_name}
                  >
                    <span
                      className={cn(
                        "block size-3 rounded-full ring-2 ring-surface transition",
                        station.stream_status.value === "live" ? "bg-signal" : station.stream_status.audible ? "bg-onair" : "bg-faint",
                        isTuned && "scale-150",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 text-xs text-muted sm:px-8">
        <span className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-signal" /> En vivo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-onair" /> Al aire
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-faint" /> Fuera del aire
          </span>
          <span className="hidden sm:inline">← → para girar · Shift + ← → salta de radio en radio</span>
        </span>
        <Switch checked={autoplay} onChange={setAutoplay} label="Escuchar al sintonizar" />
      </div>
    </div>
  );
}
