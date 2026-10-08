import { ExternalLink, GripHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/field";
import { duration } from "@/lib/format";
import { clock, localDate, longDuration, shortTitle } from "@/lib/radio/format";
import type { UpcomingBlock } from "@/types/studio";
import { kindLabel } from "./labels";
import type { ConsoleApi } from "./use-console";

const POSITION_KEY = "turadio.console.alert-position";

type Position = { x: number; y: number };

function savedPosition(): Position | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(POSITION_KEY) ?? "null") as Position | null;
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) ? value : null;
  } catch {
    return null;
  }
}

/** Keeps the bubble inside the window. */
function clamp(position: Position, element: HTMLElement | null): Position {
  const width = element?.offsetWidth ?? 280;
  const height = element?.offsetHeight ?? 44;
  return {
    x: Math.min(Math.max(8, position.x), Math.max(8, window.innerWidth - width - 8)),
    y: Math.min(Math.max(8, position.y), Math.max(8, window.innerHeight - height - 8)),
  };
}

/**
 * Floating warning of the console: what the main program has scheduled within the next minutes
 * and what waits for the live transmission to end. It can be dragged anywhere (the place is
 * remembered); clicking it shows the details and lets the operator move the block.
 */
export function UpcomingBubble({ api, timezone, openId, onOpen, scheduleUrl }: { api: ConsoleApi; timezone: string; openId: string | null; onOpen: (id: string | null) => void; scheduleUrl: ((block: UpcomingBlock) => string) | null }) {
  const { now } = api;
  const { upcoming } = api.snapshot;
  const [hidden, setHidden] = useState<string[]>([]);
  const [position, setPosition] = useState<Position | null>(savedPosition);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(null);

  const visible = upcoming.filter((block) => !hidden.includes(block.id) || block.id === openId);
  const selected = visible.find((block) => block.id === openId) ?? null;
  const first = selected ?? visible[0] ?? null;
  const live = Boolean(api.snapshot.live.session || api.snapshot.radio.live.cut);
  const selectedId = selected?.id;

  useEffect(() => {
    const keep = () => setPosition((value) => (value ? clamp(value, box.current) : value));
    window.addEventListener("resize", keep);
    return () => window.removeEventListener("resize", keep);
  }, []);

  useEffect(() => {
    if (openId && !upcoming.some((block) => block.id === openId)) onOpen(null);
  }, [openId, upcoming, onOpen]);

  useEffect(() => {
    if (!selectedId) return;
    const block = upcoming.find((item) => item.id === selectedId);
    if (block) setTime(clock(Math.max(block.start, Date.now()) + 15 * 60000, timezone));
  }, [selectedId, timezone]);

  if (!first) return null;

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    const node = box.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const state = drag.current;
    if (!state) return;
    if (!state.moved && Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 5) return;
    state.moved = true;
    setPosition(clamp({ x: event.clientX - state.dx, y: event.clientY - state.dy }, box.current));
  }

  function onPointerUp() {
    const state = drag.current;
    drag.current = null;
    if (!state || !first) return;
    if (state.moved) {
      setPosition((value) => {
        if (value) window.localStorage.setItem(POSITION_KEY, JSON.stringify(value));
        return value;
      });
      return;
    }
    onOpen(selected ? null : first.id);
  }

  async function move(change: Parameters<ConsoleApi["reschedule"]>[1]) {
    if (!selected) return;
    setBusy(true);
    const moved = await api.reschedule(selected.id, change);
    setBusy(false);
    if (moved && "time" in change) onOpen(null);
  }

  function hide(id: string) {
    setHidden((list) => [...list, id]);
    onOpen(null);
  }

  const place = position ? { left: position.x, top: position.y } : { right: 24, top: 84 };
  const others = visible.length - 1;

  return (
    <div ref={box} className="fixed z-40 w-max max-w-[min(22rem,calc(100vw-1rem))]" style={place} role="dialog" aria-label="Aviso de programación">
      <div
        className="flex cursor-grab touch-none items-center gap-2 rounded-full border border-danger/50 bg-danger px-3 py-2 text-white shadow-[0_14px_32px_-14px_var(--color-danger)] select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        title="Arrástralo donde no estorbe · clic para ver qué está programado"
      >
        <span className="size-2 shrink-0 animate-onair rounded-full bg-white" aria-hidden />
        <span className="shrink-0 font-mono text-[11px] font-semibold tabular">{first.held ? "En espera del vivo" : `Programado en ${duration(Math.max(0, first.start - now) / 1000)}`}</span>
        <span className="min-w-0 truncate text-xs font-medium">{shortTitle(first.title, 34)}</span>
        {others > 0 && !selected ? <span className="shrink-0 rounded-full bg-white/20 px-1.5 text-[10px] font-semibold">+{others}</span> : null}
        <GripHorizontal className="size-3.5 shrink-0 opacity-70" aria-hidden />
      </div>

      {selected ? (
        <div className="mt-1.5 space-y-2.5 rounded-xl border border-danger/30 bg-surface p-3 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="danger">{kindLabel(selected.kind)}</Badge>
            <span className="font-mono text-xs text-muted tabular">{selected.held ? "pendiente" : `${clock(selected.start, timezone)} – ${clock(selected.end, timezone)}`}</span>
            <span className="text-xs text-faint">{longDuration(selected.duration)}</span>
          </div>
          <div>
            <p className="text-sm font-semibold break-words">{selected.title}</p>
            {selected.artist ? <p className="text-xs break-words text-muted">{selected.artist}</p> : null}
            {selected.playlist ? <p className="text-xs break-words text-muted">Música: {selected.playlist}</p> : null}
          </div>
          {selected.note ? <p className="rounded-md bg-raised px-2 py-1 text-xs break-words text-muted">{selected.note}</p> : null}
          <p className="text-xs break-words text-danger">
            {!selected.held && selected.start > now ? <strong>Empieza en {duration((selected.start - now) / 1000)}. </strong> : null}
            {status(selected, live, timezone)}
          </p>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-faint uppercase">Reprogramar</p>
            <div className="flex flex-wrap gap-1.5">
              {[5, 15, 30].map((minutes) => (
                <Button key={minutes} size="sm" variant="secondary" disabled={busy} onClick={() => void move({ minutes })} title={`Correr ${minutes} minutos`}>
                  +{minutes} min
                </Button>
              ))}
            </div>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                void move({ time, date: localDate(Math.max(selected.start, now), timezone) });
              }}
            >
              <label className="shrink-0 text-xs text-muted" htmlFor="upcoming-time">
                Mover a las
              </label>
              <Input id="upcoming-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-8 w-28" required />
              <Button size="sm" type="submit" disabled={busy || !time}>
                Mover
              </Button>
            </form>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
            {scheduleUrl ? (
              <a href={scheduleUrl(selected)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-muted underline hover:text-ink" title="Se abre en otra pestaña para no interrumpir la transmisión">
                Abrir en Programación <ExternalLink className="size-3" />
              </a>
            ) : (
              <span />
            )}
            <div className="flex gap-1.5">
              {visible.length > 1 ? (
                <Button size="sm" variant="ghost" onClick={() => onOpen(visible[(visible.indexOf(selected) + 1) % visible.length].id)}>
                  Siguiente aviso
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => hide(selected.id)} title="Oculta este aviso; la programación no cambia">
                Ocultar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function status(block: UpcomingBlock, live: boolean, timezone: string): string {
  const audio = block.kind !== "live" && block.kind !== "auto";
  if (block.held) return "La transmisión en vivo está al aire: sonará apenas termines, y lo que sigue se corre.";
  if (block.kind === "live") return "Bloque en vivo: en modo automático la música se corta sola cuando te conectes.";
  if (live && audio) return "Estás en vivo: si a esa hora sigues al aire, esperará a que termines.";
  return `Sonará solo a las ${clock(block.start, timezone)}.`;
}
