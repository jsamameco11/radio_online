import { router } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RadioHeader } from "@/Components/studio/radio-header";
import { AddPanel } from "@/Components/studio/schedule/add-panel";
import { AutopilotPanel } from "@/Components/studio/schedule/autopilot-panel";
import { BlockRow } from "@/Components/studio/schedule/block-row";
import { DayTools } from "@/Components/studio/schedule/day-tools";
import { LaneRuler } from "@/Components/studio/schedule/lane-ruler";
import { RotationPanel } from "@/Components/studio/schedule/rotation-panel";
import { UpcomingSongs } from "@/Components/studio/schedule/upcoming-songs";
import { useDayProgram } from "@/Components/studio/schedule/use-day-program";
import { Input } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import { ServerClock } from "@/lib/radio/clock";
import { clock, dayLabel, longDuration } from "@/lib/radio/format";
import type { Autopilot, BroadcastPlaylist, BroadcastTrack, Option, ScheduleBlock } from "@/types/studio";

interface Day {
  date: string;
  blocks: number;
  seconds: number;
}

interface Props {
  date: string;
  today: string;
  timezone: string;
  now: number;
  bounds: [number, number];
  blocks: ScheduleBlock[];
  dayEnds: (number | null)[];
  days: Day[];
  tracks: BroadcastTrack[];
  playlists: BroadcastPlaylist[];
  autopilot: Autopilot;
  crossfade: number;
  layers: Option<number>[];
  maxTracks: number;
}

type Row = { type: "gap"; from: number; to: number } | { type: "block"; block: ScheduleBlock };

/** The station clock, ticking every second from the server time the page arrived with. */
function useNow(serverNow: number): number {
  const server = useRef(new ServerClock());
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    server.current.seed(serverNow);
    const timer = window.setInterval(() => setNow(server.current.now()), 1000);
    return () => window.clearInterval(timer);
  }, [serverNow]);
  return now;
}

export default function Schedule({ date, today, timezone, now: serverNow, bounds, blocks, dayEnds, days, tracks, playlists, autopilot, crossfade, layers, maxTracks }: Props) {
  const url = useStudioUrl();
  const now = useNow(serverNow);
  const [start, end] = bounds;
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const isToday = date === today;
  const isPast = date < today;
  const main = blocks.filter((block) => block.layer === 0);
  const overlays = blocks.length - main.length;
  const total = main.reduce((sum, block) => sum + (Math.min(block.end, end) - Math.max(block.start, start)), 0) / 1000;
  const automatic = !autopilot.paused && autopilot.level !== "none" && !autopilot.finished;
  const version = `${blocks.map((block) => `${block.id}:${block.start}:${block.end}`).join(",")}|${autopilot.paused}|${autopilot.label}|${autopilot.until ?? ""}`;
  const program = useDayProgram(url("/programacion/linea"), start, end, version);
  const songs = useMemo(() => (program ?? []).filter((item) => !item.slot), [program]);
  const songsBetween = (from: number, to: number) => songs.filter((song) => song.start < to && song.end > from);

  const rows = useMemo(() => {
    const list: Row[] = [];
    let cursor = start;
    for (const block of blocks.filter((item) => item.layer === 0)) {
      if (block.start - cursor > 1000) list.push({ type: "gap", from: cursor, to: block.start });
      cursor = Math.max(cursor, block.end);
    }
    if (end - cursor > 1000) list.push({ type: "gap", from: cursor, to: end });
    blocks.forEach((block) => list.push({ type: "block", block }));
    const at = (row: Row) => (row.type === "gap" ? row.from : row.block.start);
    return list.sort((a, b) => at(a) - at(b) || (a.type === "gap" ? -1 : 1));
  }, [blocks, start, end]);

  useEffect(() => () => audio.current?.pause(), []);

  useEffect(() => {
    const anchor = window.location.hash.startsWith("#bloque-") ? document.getElementById(window.location.hash.slice(1)) : null;
    anchor?.scrollIntoView({ block: "center" });
  }, [date]);

  function go(next: string) {
    router.get(url("/programacion"), { dia: next }, { preserveScroll: true });
  }

  function togglePreview(block: ScheduleBlock) {
    audio.current ??= new Audio();
    if (preview === block.id) {
      audio.current.pause();
      setPreview(null);
      return;
    }
    if (!block.src) return;
    audio.current.src = block.src;
    audio.current.onended = () => setPreview(null);
    void audio.current.play();
    setPreview(block.id);
  }

  return (
    <StudioLayout title="Programación">
      <div className="space-y-4">
        <RadioHeader
          title="Programación"
          description="Arma la línea de tiempo de cada día: la pista principal lleva el programa (audios, periodos de música automática y bloques en vivo) y hasta tres capas suenan encima. Los espacios libres se llenan con la música automática."
        />

        <nav aria-label="Días" className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {days.map((day) => (
            <button
              key={day.date}
              type="button"
              aria-current={day.date === date ? "date" : undefined}
              onClick={() => go(day.date)}
              className={cn("min-w-28 shrink-0 rounded-xl border px-3 py-2 text-left transition", day.date === date ? "border-signal bg-signal-soft" : "border-line bg-surface hover:border-line-strong")}
            >
              <span className="block text-sm font-semibold capitalize">{dayLabel(day.date, today)}</span>
              <span className="block text-xs text-muted">{day.blocks ? `${day.blocks} bloques · ${longDuration(day.seconds)}` : "Vacío"}</span>
            </button>
          ))}
          <label className="flex shrink-0 items-center gap-2 rounded-xl border border-dashed border-line px-3 text-xs font-medium text-muted">
            Otro día
            <Input type="date" value={date} onChange={(event) => event.target.value && go(event.target.value)} className="h-8 w-auto" />
          </label>
        </nav>

        <Panel
          title={<span className="capitalize">{new Date(`${date}T12:00:00Z`).toLocaleDateString("es-PE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })}</span>}
          description={`${main.length} bloques · ${longDuration(total)} programados${overlays ? ` · ${overlays} en capas` : ""} · ${autopilot.paused ? "música automática detenida" : `${longDuration(Math.max(0, 86400 - total))} de música automática`}`}
        >
          <LaneRuler blocks={blocks} layers={layers} start={start} now={now} isToday={isToday} timezone={timezone} songs={songs} />
        </Panel>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <Panel title="Línea de tiempo">
            {blocks.length === 0 ? (
              <p className="mb-3 rounded-xl border border-dashed border-line px-5 py-6 text-center text-sm text-muted">
                Este día no tiene bloques. {automatic ? "Suenan estas canciones de la música automática." : "Sin música automática, la radio estará en silencio."} Agrega bloques con el panel de la derecha.
              </p>
            ) : null}
            <ol className="space-y-2">
              {rows.map((row) => {
                if (row.type === "block") {
                  return (
                    <BlockRow
                      key={`${row.block.id}:${row.block.start}:${row.block.end}`}
                      blockUrl={url(`/programacion/bloques/${row.block.id}`)}
                      block={row.block}
                      date={date}
                      now={now}
                      timezone={timezone}
                      layers={layers}
                      playlists={playlists}
                      songs={row.block.layer === 0 ? songsBetween(row.block.start, row.block.end) : []}
                      editing={editing === row.block.id}
                      previewing={preview === row.block.id}
                      onEdit={() => setEditing(editing === row.block.id ? null : row.block.id)}
                      onPreview={() => togglePreview(row.block)}
                    />
                  );
                }
                const gapSongs = songsBetween(row.from, row.to);
                return (
                  <li key={`gap-${row.from}`} className="flex gap-3 rounded-xl border border-dashed border-line px-3.5 py-2">
                    <p className="w-16 shrink-0 font-mono text-xs text-muted tabular">{clock(row.from, timezone)}</p>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                        {gapSongs.length ? "Canciones que suenan" : automatic && !program ? "Cargando las canciones…" : "Silencio"} · {longDuration((row.to - row.from) / 1000)}
                      </p>
                      <UpcomingSongs songs={gapSongs} now={now} timezone={timezone} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>

          <aside className="space-y-4">
            {isPast ? (
              <Panel>
                <p className="text-sm text-muted">Este día ya pasó. Puedes copiar su programación a días futuros.</p>
              </Panel>
            ) : (
              <AddPanel
                key={date}
                storeUrl={url("/programacion/bloques")}
                date={date}
                isToday={isToday}
                dayEnds={dayEnds}
                tracks={tracks}
                playlists={playlists}
                layers={layers}
                maxTracks={maxTracks}
                timezone={timezone}
              />
            )}
            <AutopilotPanel musicUrl={url("/programacion/musica")} autopilot={autopilot} playlists={playlists} now={now} timezone={timezone} />
            <RotationPanel rotationUrl={url("/programacion/rotacion")} tracks={tracks} autopilot={autopilot} crossfade={crossfade} />
            <DayTools key={date} copyUrl={url("/programacion/copiar")} clearUrl={url(`/programacion/dias/${date}`)} date={date} today={today} hasBlocks={blocks.length > 0} />
          </aside>
        </div>
      </div>
    </StudioLayout>
  );
}
