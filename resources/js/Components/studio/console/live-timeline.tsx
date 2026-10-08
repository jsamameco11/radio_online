import { useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { clock, shortTitle } from "@/lib/radio/format";
import type { BroadcastTrack, ProgramItem, ProgramLayer, ScheduleBlock } from "@/types/studio";
import { kindLabel } from "./labels";
import { BEDS, PLAYERS, type ConsoleApi } from "./use-console";

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

const TRACK = "application/x-turadio-track";

interface Clip {
  key: string;
  title: string;
  kind: string;
  start: number;
  end: number;
  liveId?: string;
  quiet?: boolean;
}

/** The live desk, one lane per thing that can sound at once. */
const LANES: { id: string; label: string; hint: string; drop: boolean }[] = [
  { id: "program", label: "Programa", hint: "Suelta un audio para lanzarlo al aire", drop: true },
  { id: "layers", label: "Capas prog.", hint: "Bloques que suenan encima de la programación", drop: false },
  { id: "F1", label: "Fondo 1", hint: "Suelta un fondo", drop: true },
  { id: "F2", label: "Fondo 2", hint: "Suelta un fondo", drop: true },
  { id: "A", label: "Rep. A", hint: "Suelta un audio", drop: true },
  { id: "B", label: "Rep. B", hint: "Suelta un audio", drop: true },
  { id: "C", label: "Rep. C", hint: "Suelta un audio", drop: true },
  { id: "pad", label: "Botonera", hint: "Suelta para dispararlo", drop: true },
  { id: "voice", label: "Voz", hint: "Aparece cuando hablas al aire", drop: false },
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

function clipOf(item: { id?: string; title: string; kind: string; start: number; end: number }, quiet = false, liveId?: string): Clip {
  return { key: `${item.id ?? item.title}-${item.start}`, title: item.title, kind: item.kind, start: item.start, end: item.end, quiet, liveId };
}

/**
 * The live timeline: what is on the program, on each bed and player, on the pad bank and on the
 * voice, around the present. Library audios drop onto a lane and sound for every listener.
 */
export function LiveTimeline({ api, library, day, timezone }: { api: ConsoleApi; library: BroadcastTrack[]; day: ScheduleBlock[]; timezone: string }) {
  const { now, snapshot } = api;
  const { radio, live } = snapshot;
  const [span, setSpan] = useState<number>(180_000);
  const [follow, setFollow] = useState(true);
  const [origin, setOrigin] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const board = useRef<HTMLDivElement | null>(null);
  const ruler = useRef<HTMLDivElement | null>(null);
  const [rulerWidth, setRulerWidth] = useState(0);
  const start = follow ? now - span * 0.28 : (origin ?? now - span * 0.28);
  const ratio = (now - start) / span;

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
    if (lane === "program") {
      await api.run("post", "/lanzar", { type: "tracks", tracks: [track.id] });
      return;
    }
    if (lane === "pad") {
      await api.firePad(track);
      return;
    }
    const bed = (BEDS as readonly string[]).includes(lane);
    await api.play(track, lane, { volume: bed ? 70 : 100, duck: !bed, fadeIn: bed ? api.blend : 0, fadeOut: bed ? api.blend : 0, loop: bed });
  }

  function onDrop(event: DragEvent, lane: string) {
    event.preventDefault();
    setOver(null);
    const id = event.dataTransfer.getData(TRACK) || event.dataTransfer.getData("text/plain");
    const track = library.find((item) => item.id === id);
    if (track) void place(track, lane);
  }

  const queue = radio.queue;
  const clips: Record<string, Clip[]> = {
    program: [
      ...day.filter((block) => block.layer === 0 && !covered(block, queue)).map((block) => clipOf(block, true)),
      ...queue.map((item) => clipOf(item)),
    ],
    layers: [
      ...day.filter((block) => block.layer > 0).map((block) => clipOf(block, true)),
      ...radio.layers.filter((layer) => !DESK.has(layer.lane) && layer.source === "live").map((layer) => layerClip(layer)),
    ],
    voice: voiceClips(radio.live, live, now, api.talking || api.speaking),
  };
  for (const lane of [...BEDS, ...PLAYERS, "pad"] as const) {
    clips[lane] = radio.layers.filter((layer) => layer.lane === lane).map((layer) => layerClip(layer));
  }

  const marks: number[] = [];
  const step = tick(span, rulerWidth ? Math.min(8, Math.max(2, Math.floor(rulerWidth / MARK_WIDTH))) : 8);
  for (let at = Math.ceil(start / step) * step; at < start + span; at += step) marks.push(at);

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface" aria-label="Línea de tiempo en vivo">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <h2 className="mr-auto text-[0.68rem] font-semibold tracking-[0.16em] text-faint uppercase">Línea de tiempo en vivo</h2>
        <div role="radiogroup" aria-label="Zoom de la línea de tiempo" className="flex flex-wrap gap-0.5 rounded-lg bg-canvas p-0.5">
          {SPANS.map((item) => (
            <button
              key={item.ms}
              type="button"
              role="radio"
              aria-checked={span === item.ms}
              onClick={() => zoom(item.ms)}
              className={cn("h-7 rounded-md px-2 text-[11px] font-medium transition", span === item.ms ? "bg-ink text-canvas" : "text-muted hover:text-ink")}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setFollow(true)} className={cn("h-7 rounded-md px-2.5 text-[11px] font-semibold", follow ? "bg-signal text-white" : "bg-raised text-muted hover:text-ink")} aria-pressed={follow}>
          Ahora
        </button>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          Empalme
          <input type="range" min={0} max={12} step={0.5} value={api.blend} onChange={(event) => api.setBlend(Number(event.target.value))} className="desk-slider w-16" aria-label="Segundos del empalme" />
          <span className="w-6 font-mono tabular">{api.blend}s</span>
        </label>
        <button type="button" onClick={() => void api.stop({}, Math.max(api.blend, 0.5))} className="h-7 rounded-md border border-gold/40 bg-gold-soft px-2.5 text-[11px] font-semibold text-gold hover:bg-gold hover:text-white">
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
      </header>

      <div ref={board} className="relative cursor-grab touch-none active:cursor-grabbing" onPointerDown={panFrom}>
        <div ref={ruler} className="relative ml-28 h-7 border-b border-line bg-canvas">
          {marks.map((at) => (
            <span key={at} className="absolute top-0 h-full border-l border-line pl-1 font-mono text-[10px] leading-7 whitespace-nowrap text-faint tabular" style={{ left: `${((at - start) / span) * 100}%` }}>
              {!rulerWidth || ((at - start) / span) * rulerWidth + MARK_WIDTH <= rulerWidth ? clock(at, timezone, span <= 600_000) : null}
            </span>
          ))}
        </div>
        {LANES.map((lane, index) => {
          const row = (clips[lane.id] ?? []).filter((clip) => clip.end > start && clip.start < start + span);
          return (
          <div key={lane.id} className={cn("grid grid-cols-[7rem_minmax(0,1fr)] border-b border-line/80 last:border-b-0", index % 2 === 1 && "bg-canvas/50")}>
            <div className="flex items-center px-3 text-[11px] font-medium text-muted">{lane.label}</div>
            <div
              className={cn("relative h-9 overflow-hidden", over === lane.id && "bg-royal-soft")}
              onDragOver={
                lane.drop
                  ? (event) => {
                      event.preventDefault();
                      setOver(lane.id);
                    }
                  : undefined
              }
              onDragLeave={() => setOver((value) => (value === lane.id ? null : value))}
              onDrop={lane.drop ? (event) => onDrop(event, lane.id) : undefined}
            >
              {row.length === 0 ? <span className="absolute inset-0 flex items-center px-2 text-[11px] text-faint">{lane.hint}</span> : null}
              {row.map((clip) => {
                const liveId = clip.liveId;
                return <Block key={clip.key} clip={clip} start={start} span={span} now={now} onStop={liveId ? () => void api.stop({ layer: liveId }, Math.max(api.blend, 0.5)) : undefined} />;
              })}
            </div>
          </div>
          );
        })}
        {ratio > 0 && ratio < 1 ? (
          <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-signal shadow-[0_0_10px_var(--color-signal)]" style={{ left: `calc(7rem + (100% - 7rem) * ${ratio})` }}>
            <span className="absolute top-1 left-1/2 -translate-x-1/2 rounded-md bg-signal px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white tabular">{clock(now, timezone, true)}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function layerClip(layer: ProgramLayer): Clip {
  return { key: layer.id, title: layer.title, kind: layer.kind, start: layer.start, end: layer.end, liveId: layer.source === "live" ? layer.id : undefined };
}

function voiceClips(onAir: { cut: boolean; window: { start: number; end: number | null; title: string } | null }, desk: { session: string | null; started_at: number | null; title: string }, now: number, talking: boolean): Clip[] {
  if (onAir.cut && onAir.window) {
    return [clipOf({ id: "voice", title: onAir.window.title || "Voz al aire", kind: "live", start: onAir.window.start, end: onAir.window.end ?? now + 2_000 })];
  }
  if (desk.session && talking && desk.started_at) {
    return [clipOf({ id: "mic", title: desk.title || "Voz al aire", kind: "live", start: Math.max(desk.started_at, now - 60_000), end: now + 2_000 })];
  }
  return [];
}

function Block({ clip, start, span, now, onStop }: { clip: Clip; start: number; span: number; now: number; onStop?: () => void }) {
  const visibleStart = Math.max(clip.start, start);
  const visibleEnd = Math.min(clip.end, start + span);
  if (visibleEnd <= visibleStart) return null;
  const left = ((visibleStart - start) / span) * 100;
  const width = ((visibleEnd - visibleStart) / span) * 100;
  const remain = clip.end > now && clip.start <= now ? `-${duration((clip.end - now) / 1000)}` : "";
  const label = `${kindLabel(clip.kind)} · ${clip.title}${remain ? ` ${remain}` : ""}`;
  const className = cn("absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md px-1.5 text-left text-[11px] font-medium", tone(clip.kind, Boolean(clip.quiet)), clip.quiet && "opacity-80");
  const style = { left: `${left}%`, width: `${Math.max(width, 0.4)}%` };

  if (onStop) {
    return (
      <button type="button" className={className} style={style} title={`${label}. Clic para fundirlo.`} onClick={onStop}>
        <span className="truncate">{shortTitle(clip.title, 42)}</span>
      </button>
    );
  }

  return (
    <div className={className} style={style} title={label}>
      <span className="truncate">{width > 4 ? shortTitle(clip.title, 42) : ""}</span>
    </div>
  );
}
