import { ArrowDownRight, Play, Repeat, Square, Volume1 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/Components/ui/button";
import { Panel } from "@/Components/ui/panel";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { shortTitle } from "@/lib/radio/format";
import type { BroadcastTrack } from "@/types/studio";
import { kindLabel } from "./labels";
import { TrackPicker } from "./track-picker";
import { BEDS, PLAYERS, type ConsoleApi } from "./use-console";

const FADES = [0, 1, 2, 3, 5, 8, 12];

/** Background beds and players: each one sounds on top of the program and of the others. */
export function Decks({ api, library }: { api: ConsoleApi; library: BroadcastTrack[] }) {
  return (
    <Panel title="Fondos y reproductores" description="Cada uno suena encima de la programación. Los fondos se repiten en bucle hasta que los detengas.">
      <div className="grid gap-3 md:grid-cols-2">
        {[...BEDS, ...PLAYERS].map((lane) => (
          <Deck key={lane} lane={lane} api={api} library={library} />
        ))}
      </div>
    </Panel>
  );
}

function Deck({ lane, api, library }: { lane: string; api: ConsoleApi; library: BroadcastTrack[] }) {
  const { now } = api;
  const layers = api.snapshot.radio.layers;
  const bed = (BEDS as readonly string[]).includes(lane);
  const [trackId, setTrackId] = useState("");
  const [volume, setVolume] = useState(bed ? 70 : 100);
  const [duck, setDuck] = useState(!bed);
  const [fadeIn, setFadeIn] = useState(bed ? 3 : 0);
  const [fadeOut, setFadeOut] = useState(bed ? 3 : 0);
  const [loop, setLoop] = useState(bed);
  const timer = useRef(0);
  const playing =
    layers.filter((layer) => layer.lane === lane && layer.source === "live" && !layer.fading && layer.start <= now && now < layer.end).sort((a, b) => b.start - a.start)[0] ?? null;
  const fading = layers.some((layer) => layer.lane === lane && layer.source === "live" && layer.fading && now < layer.end);
  const track = library.find((item) => item.id === trackId) ?? null;

  function choose(id: string) {
    setTrackId(id);
    const next = library.find((item) => item.id === id);
    if (next && !bed) setDuck(next.duck);
  }

  function adjust(nextVolume: number, nextDuck: boolean) {
    setVolume(nextVolume);
    setDuck(nextDuck);
    if (!playing) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void api.adjustLayer(playing.id, nextVolume, nextDuck), 150);
  }

  function start() {
    if (track) void api.play(track, lane, { volume, duck, fadeIn: fadeIn || (playing ? api.blend : 0), fadeOut, loop });
  }

  const span = playing ? Math.max(1, playing.loop ? (playing.length ?? 1) : playing.end - playing.start) : 1;
  const elapsed = playing ? now - playing.start : 0;
  const progress = ((playing?.loop ? elapsed % span : elapsed) / span) * 100;

  return (
    <div className={cn("space-y-2 rounded-xl border p-3", playing ? "border-onair/40 bg-onair-soft" : "border-line bg-raised")}>
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface font-mono text-xs font-semibold text-ink">{lane}</span>
        <TrackPicker library={library} value={trackId} onChange={choose} placeholder={bed ? "Fondo: elige un audio…" : "Elige un audio…"} className="h-9 min-w-0 flex-1" label={`Audio de ${lane}`} />
      </div>

      <div className="relative h-6 overflow-hidden rounded-md bg-surface">
        <span className="absolute inset-y-0 left-0 bg-onair/25" style={{ width: `${Math.min(100, progress)}%` }} />
        <span className="relative flex h-full items-center px-2 text-xs text-muted">
          {playing
            ? `${playing.loop ? "⟲ " : ""}${shortTitle(playing.title, 34)} · ${playing.loop ? duration((now - playing.start) / 1000) : `-${duration((playing.end - now) / 1000)}`}`
            : fading
              ? "Fundiendo…"
              : track
                ? `${kindLabel(track.kind)} · ${duration(track.duration)}`
                : "Libre"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="icon" variant="signal" disabled={!track} onClick={start} aria-label={playing ? `Cambiar ${lane} con empalme` : `Reproducir ${lane}`} title={playing ? "Cambiar con empalme" : "Reproducir"}>
          <Play className="size-4" />
        </Button>
        <Button size="icon" variant="secondary" disabled={!playing} onClick={() => playing && void api.stop({ layer: playing.id }, fadeOut || api.blend || 2)} aria-label={`Fundir ${lane}`} title="Fundir y detener">
          <ArrowDownRight className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" disabled={!playing && !fading} onClick={() => void api.stop({ lane })} aria-label={`Cortar ${lane}`} title="Cortar">
          <Square className="size-4" />
        </Button>
        <input type="range" min={0} max={100} value={volume} onChange={(event) => adjust(Number(event.target.value), duck)} className="min-w-16 flex-1 accent-signal" aria-label={`Volumen de ${lane}`} />
        <span className="w-7 text-right font-mono text-xs text-muted tabular">{volume}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <FadeSelect label="Entrada" value={fadeIn} onChange={setFadeIn} />
        <FadeSelect label="Salida" value={fadeOut} onChange={setFadeOut} />
        <Toggle on={loop} onClick={() => setLoop(!loop)} title="Repetir en bucle hasta detenerlo" icon={<Repeat className="size-3.5" />} label="Bucle" />
        <Toggle on={duck} onClick={() => adjust(volume, !duck)} title="Bajar la música mientras suena" icon={<Volume1 className="size-3.5" />} label="Bajar música" />
      </div>
    </div>
  );
}

function FadeSelect({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="inline-flex items-center gap-1" title={`Fundido de ${label.toLowerCase()}`}>
      {label}
      <select value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-7 rounded-md border border-line bg-surface px-1 text-xs text-ink" aria-label={`Fundido de ${label.toLowerCase()}`}>
        {FADES.map((item) => (
          <option key={item} value={item}>
            {item} s
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ on, onClick, title, icon, label }: { on: boolean; onClick: () => void; title: string; icon: ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} title={title} className={cn("inline-flex h-7 items-center gap-1 rounded-md border px-2 transition", on ? "border-signal/40 bg-signal-soft text-signal" : "border-line bg-surface text-muted hover:text-ink")}>
      {icon}
      {label}
    </button>
  );
}
