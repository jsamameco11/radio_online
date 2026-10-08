import { ArrowDownRight, ChevronLeft, ChevronRight, Mic, Square, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { http } from "@/lib/http";
import { clock, shortTitle } from "@/lib/radio/format";
import type { BroadcastTrack, ProgramItem, ProgramLayer, ScheduleBlock } from "@/types/studio";
import { EFFECT_MIME, TRACK_MIME } from "./drag";
import { kindLabel } from "./labels";
import { BEDS, PLAYERS, type ConsoleApi, type TalkSpan } from "./use-console";
import type { Sounds } from "./use-sounds";

const SPANS = [
  { label: "1 min", ms: 60_000 },
  { label: "3 min", ms: 180_000 },
  { label: "10 min", ms: 600_000 },
  { label: "30 min", ms: 1_800_000 },
  { label: "1 h", ms: 3_600_000 },
  { label: "3 h", ms: 10_800_000 },
  { label: "6 h", ms: 21_600_000 },
  { label: "12 h", ms: 43_200_000 },
  { label: "24 h", ms: 86_400_000 },
] as const;

const DESK = new Set<string>([...BEDS, ...PLAYERS, "pad"]);

/** How long before a block of the main program the console warns about it. */
const ALERT_MS = 15 * 60_000;

/** From this zoom on, the program row shows the songs the server resolves beyond the queue. */
const RESOLVE_FROM = 600_000;

/** Longest stretch `/programacion/linea` resolves at once (App\Http\Requests\Studio\ProgramRangeRequest::SPAN). */
const RESOLVE_MAX = 36 * 3_600_000;

const SUB_ROW = 22;

interface Clip {
  key: string;
  title: string;
  kind: string;
  start: number;
  end: number;
  liveId?: string;
  quiet?: boolean;
  loop?: boolean;
  held?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  slot?: string | null;
}

/** The live desk, one lane per thing that can sound at once. `pip` is the lane's color on the board. */
const LANES: { id: string; label: string; hint: string; drop: boolean; pip: string }[] = [
  { id: "alert", label: "Programado", hint: "Nada programado en los próximos 15 min", drop: false, pip: "bg-danger" },
  { id: "program", label: "Programa", hint: "Suelta un audio para lanzarlo al aire", drop: true, pip: "bg-onair" },
  { id: "layers", label: "Capas prog.", hint: "Bloques que suenan encima de la programación", drop: false, pip: "bg-gold" },
  { id: "F1", label: "Fondo 1", hint: "Suelta un fondo", drop: true, pip: "bg-gold" },
  { id: "F2", label: "Fondo 2", hint: "Suelta un fondo", drop: true, pip: "bg-gold" },
  { id: "A", label: "Rep. A", hint: "Suelta un audio", drop: true, pip: "bg-info" },
  { id: "B", label: "Rep. B", hint: "Suelta un audio", drop: true, pip: "bg-info" },
  { id: "C", label: "Rep. C", hint: "Suelta un audio", drop: true, pip: "bg-info" },
  { id: "pad", label: "Botonera", hint: "Suelta para dispararlo", drop: true, pip: "bg-royal" },
  { id: "voice", label: "Voz", hint: "Aparece cuando hablas al aire", drop: false, pip: "bg-signal" },
];

function tone(kind: string, quiet: boolean): string {
  const solid =
    kind === "song" || kind === "fill" || kind === "auto"
      ? "bg-onair text-white"
      : kind === "jingle"
        ? "bg-gold text-white"
        : kind === "effect"
          ? "bg-royal text-white"
          : kind === "commercial"
            ? "bg-warning text-white"
            : kind === "program"
              ? "bg-info text-white"
              : kind === "live"
                ? "bg-signal text-white"
                : "bg-line-strong text-ink";
  return quiet ? "bg-onair/25 text-onair" : solid;
}

/** Room a ruler label needs, in pixels, so the times never touch each other or the edge. */
const MARK_WIDTH = 64;

function tick(span: number, marks: number): number {
  const steps = [5_000, 10_000, 15_000, 30_000, 60_000, 300_000, 900_000, 1_800_000, 3_600_000, 10_800_000, 21_600_000];
  return steps.find((step) => span / step <= marks) ?? 21_600_000;
}

function covered(block: ScheduleBlock, queue: ProgramItem[]): boolean {
  const pieces = queue.filter((item) => item.block === block.id);
  if (!pieces.length) return false;
  const heard = pieces.reduce((sum, item) => sum + Math.max(0, Math.min(item.end, block.end) - Math.max(item.start, block.start)), 0);
  return heard > (block.end - block.start) * 0.8;
}

function clipOf(item: { id?: string; title: string; kind: string; start: number; end: number; slot?: string | null }, quiet = false): Clip {
  return { key: `${item.id ?? item.title}-${item.start}`, title: item.title, kind: item.kind, start: item.start, end: item.end, quiet, slot: item.slot ?? null };
}

function layerClip(layer: ProgramLayer): Clip {
  return {
    key: layer.id,
    title: layer.title,
    kind: layer.kind,
    start: layer.start,
    end: layer.end,
    liveId: layer.source === "live" ? layer.id : undefined,
    quiet: layer.fading,
    loop: layer.loop,
    fadeIn: layer.fade_in,
    fadeOut: layer.fade_out,
  };
}

/** Overlapping clips go to sub-rows of the lane, so none hides another. */
function stack(clips: Clip[]): { clip: Clip; row: number }[] {
  const ends: number[] = [];
  return [...clips]
    .sort((a, b) => a.start - b.start)
    .map((clip) => {
      let row = ends.findIndex((end) => end <= clip.start);
      if (row < 0) row = ends.length;
      ends[row] = clip.end;
      return { clip, row };
    });
}

/** The program the server resolves song by song for the stretch on screen, at wide zooms. */
function useResolvedProgram(api: ConsoleApi, from: number, span: number): ProgramItem[] {
  const [items, setItems] = useState<ProgramItem[]>([]);
  const step = Math.max(span / 2, 60_000);
  const bucket = Math.floor(from / step) * step;
  const enabled = span >= RESOLVE_FROM;
  const { url } = api;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const to = Math.min(bucket + span * 2, bucket + RESOLVE_MAX);
    const load = () =>
      http
        .get<{ items: ProgramItem[] }>(url(`/programacion/linea?desde=${Math.round(bucket)}&hasta=${Math.round(to)}`))
        .then((data) => alive && setItems(data.items))
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [bucket, enabled, span, url]);

  return enabled ? items : [];
}

/**
 * The live timeline: what is on the program, on each bed and player, on the pad bank and on the
 * voice, around the present, with the scheduled blocks coming within 15 minutes. Any sound of the
 * library or a factory effect drops onto a lane and sounds for every listener.
 */
export function LiveTimeline({ api, sounds, day, timezone, onAlert }: { api: ConsoleApi; sounds: Sounds; day: ScheduleBlock[]; timezone: string; onAlert: (id: string) => void }) {
  const { now, snapshot } = api;
  const { radio, live, upcoming } = snapshot;
  const [span, setSpan] = useState<number>(180_000);
  const [follow, setFollow] = useState(true);
  const [origin, setOrigin] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const board = useRef<HTMLDivElement | null>(null);
  const ruler = useRef<HTMLDivElement | null>(null);
  const [rulerWidth, setRulerWidth] = useState(0);
  const start = follow ? now - span * 0.28 : (origin ?? now - span * 0.28);
  const end = start + span;
  const ratio = (now - start) / span;
  const resolved = useResolvedProgram(api, start, span);

  useEffect(() => {
    const node = ruler.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setRulerWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = board.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      const horizontal = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (event.ctrlKey || !horizontal) return;
      event.preventDefault();
      const delta = (event.shiftKey ? event.deltaY : event.deltaX) / node.clientWidth;
      setFollow(false);
      setOrigin((value) => (value ?? now - span * 0.28) + delta * span);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [now, span]);

  function zoom(next: number) {
    if (!follow) {
      const center = (origin ?? now - span * 0.28) + span / 2;
      setOrigin(center - next / 2);
    }
    setSpan(next);
  }

  function pan(step: number) {
    setFollow(false);
    setOrigin(start + step * span * 0.5);
  }

  function panFrom(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a, input, select")) return;
    const from = start;
    const x = event.clientX;
    const width = event.currentTarget.clientWidth;
    const move = (ev: globalThis.PointerEvent) => {
      setFollow(false);
      setOrigin(from - ((ev.clientX - x) / width) * span);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async function place(track: BroadcastTrack, lane: string) {
    if (!track.playable) {
      api.setNotice({ tone: "error", text: `«${track.title}» no se puede reproducir. Revisa el archivo en la biblioteca.` });
      return;
    }
    if (lane === "program") await api.launch(track);
    else if (lane === "pad") await api.firePad(track);
    else await api.drop(track, lane);
  }

  function carries(event: DragEvent): boolean {
    const types = Array.from(event.dataTransfer.types);
    return types.includes(TRACK_MIME) || types.includes(EFFECT_MIME);
  }

  function onDrop(event: DragEvent, lane: string) {
    setOver(null);
    if (!carries(event)) return;
    event.preventDefault();
    void sounds.resolve(event.dataTransfer).then((track) => track && place(track, lane));
  }

  const queue = radio.queue;
  const queueStart = queue[0]?.start ?? now;
  const queueEnd = queue.at(-1)?.end ?? now;
  const beyond = resolved.filter((item) => item.start >= queueEnd || item.end <= queueStart);
  const alerts = upcoming.filter((block) => !block.held);
  const held = upcoming.filter((block) => block.held);
  const talks = api.talks.map((spanItem: TalkSpan, index) => ({ key: `talk-${index}-${spanItem.start}`, title: live.title || "Voz al aire", kind: "live", start: spanItem.start, end: spanItem.end ?? now + 2_000 }));

  const clips: Record<string, Clip[]> = {
    alert: [
      ...alerts.map((block) => ({ ...clipOf(block), slot: block.id })),
      ...held.map((block) => ({ ...clipOf({ ...block, start: now, end: now + Math.max(block.end - block.start, 60_000) }), slot: block.id, held: true })),
    ],
    program: [
      ...day.filter((block) => block.layer === 0 && !covered(block, queue) && !resolved.some((item) => item.block === block.id)).map((block) => ({ ...clipOf(block, true), slot: block.id })),
      ...queue.map((item) => clipOf(item)),
      ...beyond.map((item) => clipOf(item)),
    ],
    layers: [
      ...day.filter((block) => block.layer > 0).map((block) => clipOf(block, true)),
      ...radio.layers.filter((layer) => !DESK.has(layer.lane)).map((layer) => layerClip(layer)),
    ],
    voice: [...talks, ...voiceWindow(radio.live, now)],
  };
  for (const lane of [...BEDS, ...PLAYERS, "pad"] as const) {
    clips[lane] = radio.layers.filter((layer) => layer.lane === lane).map((layer) => layerClip(layer));
  }

  const sounding = (lane: string) => radio.layers.some((layer) => layer.lane === lane && layer.source === "live" && !layer.fading && layer.start <= now && now < layer.end);
  const layersOn = radio.layers.filter((layer) => layer.start <= now && now < layer.end).length;
  const next = alerts[0] ?? null;
  const zone = Math.max(0, Math.min(1, (now + ALERT_MS - start) / span)) - Math.max(0, Math.min(1, (now - start) / span));
  const ahead = next && next.start >= end ? next : null;

  const marks: number[] = [];
  const step = tick(span, rulerWidth ? Math.min(8, Math.max(2, Math.floor(rulerWidth / MARK_WIDTH))) : 8);
  for (let at = Math.ceil(start / step) * step; at < end; at += step) marks.push(at);

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-[inset_0_1px_0_color-mix(in_oklab,var(--ink)_6%,transparent)]" aria-label="Línea de tiempo en vivo">
      <header className="border-b border-line bg-canvas/70">
        <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
          <h2 className="inline-flex items-center gap-2 text-[0.68rem] font-semibold tracking-[0.16em] text-faint uppercase">
            <span className="size-2 animate-onair rounded-full bg-signal" aria-hidden />
            Línea de tiempo en vivo
          </h2>
          <div className="mr-auto flex min-w-0 flex-wrap items-center gap-1">
            {api.talking ? (
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-signal px-2 text-[10px] font-semibold text-white">
                <Mic className="size-3" /> Mic
              </span>
            ) : null}
            {layersOn ? <span className="inline-flex h-5 items-center rounded-full bg-raised px-2 text-[10px] font-semibold text-muted">{layersOn} en capas</span> : null}
            {next ? (
              <button type="button" onClick={() => onAlert(next.id)} className="inline-flex h-5 items-center rounded-full bg-danger-soft px-2 text-[10px] font-semibold text-danger hover:bg-danger hover:text-white">
                Programado en {duration(Math.max(0, next.start - now) / 1000)}
              </button>
            ) : null}
            {held.length ? (
              <button type="button" onClick={() => onAlert(held[0].id)} className="inline-flex h-5 items-center rounded-full bg-warning-soft px-2 text-[10px] font-semibold text-warning">
                {held.length} en espera del vivo
              </button>
            ) : null}
          </div>
          <div role="radiogroup" aria-label="Zoom de la línea de tiempo" className="desk-scroll flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-surface p-0.5">
            {SPANS.map((item) => (
              <button
                key={item.ms}
                type="button"
                role="radio"
                aria-checked={span === item.ms}
                onClick={() => zoom(item.ms)}
                className={cn("h-7 shrink-0 rounded-md px-2 text-[11px] font-medium transition", span === item.ms ? "bg-ink text-canvas" : "text-muted hover:text-ink")}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={() => pan(-1)} className="flex size-7 items-center justify-center rounded-md bg-raised text-muted hover:text-ink" aria-label="Ver antes" title="Ver antes">
              <ChevronLeft className="size-3.5" />
            </button>
            <button type="button" onClick={() => setFollow(true)} className={cn("h-7 shrink-0 rounded-md px-2.5 text-[11px] font-semibold", follow ? "bg-signal text-white" : "bg-raised text-muted hover:text-ink")} aria-pressed={follow}>
              Ahora
            </button>
            <button type="button" onClick={() => pan(1)} className="flex size-7 items-center justify-center rounded-md bg-raised text-muted hover:text-ink" aria-label="Ver después" title="Ver después">
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            Empalme
            <input type="range" min={0} max={12} step={0.5} value={api.blend} onChange={(event) => api.setBlend(Number(event.target.value))} className="desk-slider w-20" aria-label="Segundos del empalme" />
            <span className="w-6 font-mono tabular">{api.blend}s</span>
          </label>
          <button type="button" onClick={() => void api.stop({}, Math.max(api.blend, 0.5))} className="ml-auto h-7 rounded-md border border-gold/40 bg-gold-soft px-2.5 text-[11px] font-semibold text-gold hover:bg-gold hover:text-white">
            Fundir todo
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("¿Cortar ahora todos los fondos, reproductores y efectos?")) void api.stop({});
            }}
            className="h-7 rounded-md bg-danger px-2.5 text-[11px] font-semibold text-white hover:opacity-90"
          >
            Cortar todo
          </button>
        </div>
      </header>

      <div ref={board} className="relative cursor-grab touch-none bg-[linear-gradient(180deg,color-mix(in_oklab,var(--canvas)_55%,transparent),transparent_2.5rem)] active:cursor-grabbing" onPointerDown={panFrom}>
        <div className="pointer-events-none absolute top-7 right-0 bottom-0 left-28 z-0" aria-hidden>
          {marks.map((at) => (
            <span key={at} className="absolute inset-y-0 w-px bg-line/80" style={{ left: `${((at - start) / span) * 100}%` }} />
          ))}
          {zone > 0 ? <span className="absolute inset-y-0 bg-danger/[0.07]" style={{ left: `${Math.max(0, ratio) * 100}%`, width: `${zone * 100}%` }} /> : null}
          {alerts
            .filter((block) => block.start > start && block.start < end)
            .map((block) => (
              <span key={block.id} className="absolute inset-y-0 w-px border-l border-dashed border-danger/70" style={{ left: `${((block.start - start) / span) * 100}%` }} />
            ))}
        </div>
        <div ref={ruler} className="relative z-10 ml-28 h-7 border-b border-line bg-canvas">
          {marks.map((at) => (
            <span key={at} className="absolute top-0 h-full border-l border-line pl-1 font-mono text-[10px] leading-7 whitespace-nowrap text-faint tabular" style={{ left: `${((at - start) / span) * 100}%` }}>
              {!rulerWidth || ((at - start) / span) * rulerWidth + MARK_WIDTH <= rulerWidth ? clock(at, timezone, span <= 600_000) : null}
            </span>
          ))}
        </div>
        {LANES.map((lane, index) => {
          const row = stack((clips[lane.id] ?? []).filter((clip) => clip.end > start && clip.start < end));
          const rows = row.reduce((max, item) => Math.max(max, item.row + 1), 1);
          const desk = DESK.has(lane.id);
          const on = desk && sounding(lane.id);
          return (
            <div key={lane.id} className={cn("relative z-10 grid grid-cols-[7rem_minmax(0,1fr)] border-b border-line/80 last:border-b-0", index % 2 === 1 && "bg-canvas/40", lane.id === "alert" && "bg-danger/[0.04]")}>
              <div className="flex min-w-0 items-center gap-1.5 border-r border-line/80 bg-surface/80 px-2 text-[11px] font-medium text-muted">
                <span className={cn("h-3.5 w-1 shrink-0 rounded-full", lane.pip)} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{lane.label}</span>
                {on ? (
                  <>
                    <button type="button" onClick={() => void api.stop({ lane: lane.id }, Math.max(api.blend, 0.5))} className="flex size-5 shrink-0 items-center justify-center rounded text-gold hover:bg-gold-soft" aria-label={`Fundir ${lane.label}`} title="Fundir">
                      <ArrowDownRight className="size-3" />
                    </button>
                    <button type="button" onClick={() => void api.stop({ lane: lane.id })} className="flex size-5 shrink-0 items-center justify-center rounded text-danger hover:bg-danger-soft" aria-label={`Cortar ${lane.label}`} title="Cortar">
                      <Square className="size-2.5" />
                    </button>
                  </>
                ) : null}
              </div>
              <div
                className={cn("relative overflow-hidden transition-colors", over === lane.id && "bg-royal-soft ring-1 ring-royal/40 ring-inset")}
                style={{ height: rows > 1 ? 8 + rows * SUB_ROW : 44 }}
                onDragOver={
                  lane.drop
                    ? (event) => {
                        if (!carries(event)) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                        setOver(lane.id);
                      }
                    : undefined
                }
                onDragLeave={() => setOver((value) => (value === lane.id ? null : value))}
                onDrop={lane.drop ? (event) => onDrop(event, lane.id) : undefined}
              >
                {row.length === 0 ? <span className="absolute inset-0 flex items-center px-2 text-[11px] text-faint">{lane.hint}</span> : null}
                {row.map(({ clip, row: sub }) => {
                  const liveId = clip.liveId;
                  const slot = clip.slot && upcoming.some((block) => block.id === clip.slot) ? clip.slot : null;
                  return (
                    <Block
                      key={clip.key}
                      clip={clip}
                      start={start}
                      span={span}
                      now={now}
                      top={rows > 1 ? 4 + sub * SUB_ROW : 6}
                      height={rows > 1 ? SUB_ROW - 2 : 32}
                      onOpen={slot ? () => onAlert(slot) : undefined}
                      onFade={liveId ? () => void api.stop({ layer: liveId }, Math.max(api.blend, 0.5)) : undefined}
                      onCut={liveId ? () => void api.stop({ layer: liveId }) : undefined}
                    />
                  );
                })}
                {lane.id === "alert" && ahead ? (
                  <button type="button" onClick={() => onAlert(ahead.id)} className="absolute inset-y-1.5 right-1 flex items-center gap-1 rounded-md bg-danger px-2 text-[10px] font-semibold text-white" title={ahead.title}>
                    {shortTitle(ahead.title, 18)} en {duration(Math.max(0, ahead.start - now) / 1000)} <ChevronRight className="size-3" />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {ratio > 0 && ratio < 1 ? (
          <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-signal shadow-[0_0_14px_2px_var(--color-signal)]" style={{ left: `calc(7rem + (100% - 7rem) * ${ratio})` }}>
            <span className="absolute top-1 left-1/2 -translate-x-1/2 rounded-md bg-signal px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white shadow-[0_6px_16px_-6px_var(--color-signal)] tabular">{clock(now, timezone, true)}</span>
            <span className="absolute top-7 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-signal" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** The voice of an external live signal (the console's own voice comes from its talk spans). */
function voiceWindow(onAir: { cut: boolean; window: { start: number; end: number | null; title: string } | null }, now: number): Clip[] {
  if (!onAir.cut || !onAir.window) return [];
  return [clipOf({ id: "voice", title: onAir.window.title || "Voz al aire", kind: "live", start: onAir.window.start, end: onAir.window.end ?? now + 2_000 })];
}

interface BlockProps {
  clip: Clip;
  start: number;
  span: number;
  now: number;
  top: number;
  height: number;
  onOpen?: () => void;
  onFade?: () => void;
  onCut?: () => void;
}

function Block({ clip, start, span, now, top, height, onOpen, onFade, onCut }: BlockProps) {
  const visibleStart = Math.max(clip.start, start);
  const visibleEnd = Math.min(clip.end, start + span);
  if (visibleEnd <= visibleStart) return null;
  const left = ((visibleStart - start) / span) * 100;
  const width = ((visibleEnd - visibleStart) / span) * 100;
  const length = Math.max(1, clip.end - clip.start);
  const remain = clip.end > now && clip.start <= now && !clip.held ? `-${duration((clip.end - now) / 1000)}` : "";
  const label = `${kindLabel(clip.kind)} · ${clip.title}${clip.held ? " · en espera del vivo" : ""}${remain ? ` ${remain}` : ""}`;
  const fadeIn = clip.fadeIn ? Math.min(100, ((clip.fadeIn * 1000) / length) * 100) : 0;
  const fadeOut = clip.fadeOut ? Math.min(100, ((clip.fadeOut * 1000) / length) * 100) : 0;
  const shiftIn = ((visibleStart - clip.start) / length) * 100;
  const shiftOut = ((clip.end - visibleEnd) / length) * 100;
  const scale = (visibleEnd - visibleStart) / length;
  const action = onOpen ?? onFade;
  const className = cn(
    "absolute flex items-center gap-1 overflow-hidden rounded-md border border-white/15 text-left text-[11px] font-semibold shadow-[0_8px_16px_-12px_rgba(0,0,0,0.8)]",
    clip.held ? "bg-warning text-white" : tone(clip.kind, Boolean(clip.quiet)),
    clip.quiet && "border-dashed opacity-80",
  );
  const style = { left: `${left}%`, width: `${Math.max(width, 0.4)}%`, top, height };
  const body = (
    <>
      {fadeIn ? <span className="pointer-events-none absolute inset-y-0 left-0 bg-[linear-gradient(to_top_right,transparent_49%,color-mix(in_oklab,var(--canvas)_45%,transparent)_51%)]" style={{ left: `${-shiftIn / scale}%`, width: `${fadeIn / scale}%` }} aria-hidden /> : null}
      {fadeOut ? <span className="pointer-events-none absolute inset-y-0 bg-[linear-gradient(to_top_left,transparent_49%,color-mix(in_oklab,var(--canvas)_45%,transparent)_51%)]" style={{ right: `${-shiftOut / scale}%`, width: `${fadeOut / scale}%` }} aria-hidden /> : null}
      {clip.loop ? <span className="relative shrink-0" aria-label="En bucle">⟲</span> : null}
      {clip.held ? <span className="relative shrink-0" aria-label="En espera">⏸</span> : null}
      <span className="relative truncate">{width > 4 ? shortTitle(clip.title, 42) : ""}</span>
      {remain && width > 8 ? <span className="relative ml-auto shrink-0 font-mono text-[10px] opacity-80 tabular">{remain}</span> : null}
    </>
  );

  if (!action) {
    return (
      <div className={cn(className, "px-1.5")} style={style} title={label}>
        {body}
      </div>
    );
  }

  return (
    <div className={cn(className, "group")} style={style}>
      <button type="button" className="flex h-full min-w-0 flex-1 items-center gap-1 px-1.5 text-left" title={onOpen ? `${label}. Clic para ver el aviso.` : `${label}. Clic para fundirlo.`} onClick={action}>
        {body}
      </button>
      {onCut && width > 6 ? (
        <button type="button" onClick={onCut} className="relative mr-0.5 hidden size-4 shrink-0 items-center justify-center rounded bg-canvas/35 group-hover:flex" aria-label={`Cortar ${clip.title}`} title="Cortar">
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
