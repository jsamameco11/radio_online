import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { KIND_LABEL } from "@/Components/studio/console/labels";
import { cn } from "@/lib/cn";
import { clock } from "@/lib/radio/format";
import type { Option, ProgramItem, ProgramKind, ScheduleBlock } from "@/types/studio";
import { KIND_TONE } from "./kind-tone";

const HOUR = 3_600_000;

const DAY = 24 * HOUR;

/** Preset zooms, in pixels per hour (0 fits the whole day). */
const ZOOMS = [
  { label: "Día completo", perHour: 0 },
  { label: "Por hora", perHour: 360 },
  { label: "Por 30 min", perHour: 900 },
  { label: "Por 10 min", perHour: 2_700 },
  { label: "Por minuto", perHour: 21_600 },
] as const;

const MAX_PER_HOUR = 43_200;

/** Steps of the axis, from the widest; the labels take the first one at least LABEL_GAP px apart. */
const STEPS = [3 * HOUR, HOUR, 1_800_000, 900_000, 600_000, 300_000, 60_000, 30_000, 10_000];

const LABEL_GAP = 64;

const MINOR_GAP = 10;

/** A block or song is labelled once it is this wide. */
const LABEL_WIDTH = 70;

const LEGEND: ProgramKind[] = ["song", "jingle", "effect", "commercial", "program", "live"];

/**
 * The whole day lane by lane: the main program (with the songs the automatic music will play)
 * and each overlay layer. The zoom goes from the whole day to one minute per screen width, with
 * the presets, the slider or Ctrl + wheel, and the day scrolls sideways.
 */
export function LaneRuler({ blocks, layers, start, now, isToday, timezone, songs }: { blocks: ScheduleBlock[]; layers: Option<number>[]; start: number; now: number; isToday: boolean; timezone: string; songs: ProgramItem[] }) {
  const end = start + DAY;
  const scroller = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, left: 0 });
  const [perHour, setPerHour] = useState(0);
  /** Moment to keep at the same spot of the screen when the zoom changes. */
  const anchor = useRef<{ at: number; x: number } | null>(null);
  const fit = viewport.width / 24;
  const scale = Math.max(fit, perHour) / HOUR;
  const width = Math.max(viewport.width, DAY * scale);
  const pos = (ms: number) => (Math.min(end, Math.max(start, ms)) - start) * scale;

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => setViewport({ width: element.clientWidth, left: element.scrollLeft });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || !anchor.current) return;
    element.scrollLeft = (anchor.current.at - start) * scale - anchor.current.x;
    anchor.current = null;
    setViewport({ width: element.clientWidth, left: element.scrollLeft });
  }, [scale, start]);

  function zoomTo(next: number, x = viewport.width / 2) {
    const element = scroller.current;
    const value = next <= fit ? 0 : Math.min(MAX_PER_HOUR, next);
    if (element) {
      const centred = isToday && perHour === 0 && value > 0 ? now : start + (element.scrollLeft + x) / scale;
      anchor.current = { at: centred, x };
    }
    setPerHour(value);
  }

  function showNow() {
    scroller.current?.scrollTo({ left: Math.max(0, pos(now) - scroller.current.clientWidth / 3), behavior: "smooth" });
  }

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoomTo(Math.max(fit, perHour || fit) * (event.deltaY < 0 ? 1.25 : 0.8), event.clientX - rect.left);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  });

  const label = [...STEPS].reverse().find((step) => step * scale >= LABEL_GAP) ?? STEPS[0];
  const minor = [...STEPS].reverse().find((step) => step * scale >= MINOR_GAP) ?? HOUR;
  const visibleFrom = start + Math.max(0, viewport.left - 200) / scale;
  const visibleTo = start + (viewport.left + viewport.width + 200) / scale;
  const ticks: number[] = [];
  if (scale > 0) for (let at = start + Math.ceil((visibleFrom - start) / minor) * minor; at <= Math.min(end, visibleTo); at += minor) ticks.push(at);
  const slider = perHour === 0 ? 0 : Math.round((Math.log(perHour / Math.max(1, fit)) / Math.log(MAX_PER_HOUR / Math.max(1, fit))) * 100);
  const autoSongs = songs.filter((song) => !song.slot && song.end > start && song.start < end);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-raised p-1" role="group" aria-label="Zoom de la línea de tiempo">
          {ZOOMS.map((zoom) => {
            const on = zoom.perHour === 0 ? perHour === 0 : Math.abs(perHour - zoom.perHour) < 1;
            return (
              <button key={zoom.label} type="button" aria-pressed={on} onClick={() => zoomTo(zoom.perHour)} className={cn("h-7 rounded-lg px-2.5 text-xs font-medium transition", on ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}>
                {zoom.label}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-muted">
          Zoom
          <input
            type="range"
            min={0}
            max={100}
            value={slider}
            onChange={(event) => {
              const share = Number(event.target.value) / 100;
              zoomTo(share === 0 ? 0 : Math.max(1, fit) * Math.pow(MAX_PER_HOUR / Math.max(1, fit), share));
            }}
            className="w-32 accent-signal"
            aria-label="Zoom libre"
          />
        </label>
        {isToday && perHour > 0 ? (
          <button type="button" onClick={showNow} className="rounded-full border border-line px-3 py-1 text-xs font-medium hover:border-line-strong">
            Ir a ahora
          </button>
        ) : null}
        <span className="text-xs text-faint">Ctrl + rueda del mouse para acercar o alejar.</span>
      </div>

      <div className="flex">
        <div className="w-24 shrink-0 space-y-1 pr-2 pt-0.5">
          {layers.map((layer) => (
            <p key={layer.value} className={cn("flex h-9 items-center text-xs capitalize", layer.value === 0 ? "font-semibold text-ink" : "text-muted")}>
              {layer.value === 0 ? "Principal" : layer.label}
            </p>
          ))}
        </div>
        <div ref={scroller} className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:thin]" onScroll={(event) => setViewport({ width: event.currentTarget.clientWidth, left: event.currentTarget.scrollLeft })}>
          <div className="relative space-y-1" style={{ width }}>
            {layers.map((layer) => (
              <div key={layer.value} className={cn("relative h-9 overflow-hidden rounded-lg border border-line", layer.value === 0 ? "bg-raised" : "bg-surface")}>
                {blocks
                  .filter((block) => block.layer === layer.value)
                  .map((block) => {
                    const left = pos(block.start);
                    const size = Math.max(3, pos(block.end) - left);
                    const labelled = layer.value > 0 || block.kind !== "auto";
                    return (
                      <a
                        key={block.id}
                        href={`#bloque-${block.id}`}
                        className={cn("absolute inset-y-1 overflow-hidden rounded-md px-1.5 text-[11px] leading-7 text-ink", KIND_TONE[block.kind] ?? "bg-line-strong")}
                        style={{ left, width: size }}
                        title={`${clock(block.start, timezone)}–${clock(block.end, timezone)} · ${block.title}`}
                      >
                        {labelled && size >= LABEL_WIDTH ? <span className="block truncate">{block.title}</span> : null}
                      </a>
                    );
                  })}
                {layer.value === 0
                  ? autoSongs.map((song) => {
                      const left = pos(song.start);
                      const size = Math.max(1, pos(song.end) - left);
                      return (
                        <span
                          key={song.id}
                          className="absolute inset-y-2 overflow-hidden rounded border-r border-surface bg-signal-soft px-1 text-[10px] leading-5 text-signal"
                          style={{ left, width: size }}
                          title={`${clock(song.start, timezone)}–${clock(song.end, timezone)} · ${song.title}${song.artist ? ` · ${song.artist}` : ""}`}
                        >
                          {size >= LABEL_WIDTH ? <span className="block truncate">{song.title}</span> : null}
                        </span>
                      );
                    })
                  : null}
                {isToday && now >= start && now < end ? <span className="absolute inset-y-0 w-0.5 bg-onair" style={{ left: pos(now) }} aria-hidden /> : null}
              </div>
            ))}
            <div className="relative h-5">
              {ticks.map((at) => {
                const major = (at - start) % label === 0;
                return (
                  <span key={at} className={cn("absolute top-0 border-l", major ? "h-2.5 border-line-strong" : "h-1.5 border-line")} style={{ left: pos(at) }}>
                    {major ? <span className="absolute left-1 top-1 font-mono text-[10px] whitespace-nowrap text-muted">{clock(at, timezone, label < 60_000)}</span> : null}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {LEGEND.map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", KIND_TONE[kind])} /> {KIND_LABEL[kind]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-signal-soft" /> Canción de la música automática
        </span>
        <span className="text-faint">· Las capas suenan encima de la pista principal.</span>
      </div>
    </div>
  );
}
