import { ArrowDownRight, Play, Repeat, Square, Volume1 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Panel } from "@/Components/ui/panel";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { shortTitle } from "@/lib/radio/format";
import { useSoundDrop } from "./drag";
import { kindLabel } from "./labels";
import { TrackPicker } from "./track-picker";
import { BEDS, PLAYERS, type ConsoleApi } from "./use-console";
import type { Sounds } from "./use-sounds";

const FADES = [0, 1, 2, 3, 5, 8, 12];

/** Background beds and players: each one sounds on top of the program and of the others. */
export function Decks({ api, sounds }: { api: ConsoleApi; sounds: Sounds }) {
  return (
    <Panel dense title="Fondos y reproductores" description="Cada uno suena encima de la programación. Los fondos se repiten en bucle hasta que los detengas. Suelta un sonido sobre uno para reproducirlo.">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,12.75rem),1fr))] gap-1.5">
        {[...BEDS, ...PLAYERS].map((lane) => (
          <Deck key={lane} lane={lane} api={api} sounds={sounds} />
        ))}
      </div>
    </Panel>
  );
}

function Deck({ lane, api, sounds }: { lane: string; api: ConsoleApi; sounds: Sounds }) {
  const { library } = sounds;
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

  function start(next = track) {
    if (next) void api.play(next, lane, { volume, duck: bed ? duck : next.duck, fadeIn: fadeIn || (playing ? api.blend : 0), fadeOut, loop });
  }

  const drop = useSoundDrop(sounds, (dropped) => {
    if (!dropped.playable) {
      api.setNotice({ tone: "error", text: `«${dropped.title}» no se puede reproducir. Revisa el archivo en la biblioteca.` });
      return;
    }
    choose(dropped.id);
    start(dropped);
  });

  const span = playing ? Math.max(1, playing.loop ? (playing.length ?? 1) : playing.end - playing.start) : 1;
  const elapsed = playing ? now - playing.start : 0;
  const progress = ((playing?.loop ? elapsed % span : elapsed) / span) * 100;

  return (
    <div {...drop} className={cn("min-w-0 space-y-1 rounded-lg border p-1.5 data-drop:border-royal data-drop:ring-2 data-drop:ring-royal/40", playing ? "border-onair/40 bg-onair-soft" : "border-line bg-raised")}>
      <div className="flex items-center gap-1">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface font-mono text-[11px] font-semibold text-ink">{lane}</span>
        <TrackPicker library={library} value={trackId} onChange={choose} placeholder={bed ? "Fondo: elige…" : "Elige un audio…"} className="h-7 min-w-0 flex-1 rounded-lg px-2.5 pr-7 text-xs" label={`Audio de ${lane}`} />
      </div>

      <div className="relative h-5 overflow-hidden rounded bg-surface">
        <span className="absolute inset-y-0 left-0 bg-onair/25" style={{ width: `${Math.min(100, progress)}%` }} />
        <span className="relative block h-full truncate px-1.5 text-[11px] leading-5 text-muted">
          {playing
            ? `${playing.loop ? "⟲ " : ""}${shortTitle(playing.title, 34)} · ${playing.loop ? duration((now - playing.start) / 1000) : `-${duration((playing.end - now) / 1000)}`}`
            : fading
              ? "Fundiendo…"
              : track
                ? `${kindLabel(track.kind)} · ${duration(track.duration)}`
                : "Libre"}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <IconButton tone="signal" disabled={!track} onClick={() => start()} label={playing ? `Cambiar ${lane} con empalme` : `Reproducir ${lane}`} title={playing ? "Cambiar con empalme" : "Reproducir"}>
          <Play className="size-3.5" />
        </IconButton>
        <IconButton tone="secondary" disabled={!playing} onClick={() => playing && void api.stop({ layer: playing.id }, fadeOut || api.blend || 2)} label={`Fundir ${lane}`} title="Fundir y detener">
          <ArrowDownRight className="size-3.5" />
        </IconButton>
        <IconButton tone="ghost" disabled={!playing && !fading} onClick={() => void api.stop({ lane })} label={`Cortar ${lane}`} title="Cortar">
          <Square className="size-3.5" />
        </IconButton>
        <input type="range" min={0} max={100} value={volume} onChange={(event) => adjust(Number(event.target.value), duck)} className="desk-slider min-w-10 flex-1" aria-label={`Volumen de ${lane}`} />
        <span className="w-6 text-right font-mono text-[10px] text-muted tabular">{volume}</span>
      </div>

      <div className="flex items-center gap-1 text-[10px] text-muted">
        <FadeSelect label="Ent." name="entrada" value={fadeIn} onChange={setFadeIn} />
        <FadeSelect label="Sal." name="salida" value={fadeOut} onChange={setFadeOut} />
        <span className="ml-auto flex gap-1">
          <Toggle on={loop} onClick={() => setLoop(!loop)} title="Bucle: repetir hasta detenerlo" icon={<Repeat className="size-3.5" />} />
          <Toggle on={duck} onClick={() => adjust(volume, !duck)} title="Bajar la música mientras suena" icon={<Volume1 className="size-3.5" />} />
        </span>
      </div>
    </div>
  );
}

const ICON_TONES = {
  signal: "bg-signal text-white hover:opacity-90",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-raised",
  ghost: "text-muted hover:bg-surface hover:text-ink",
} as const;

function IconButton({ tone, disabled, onClick, label, title, children }: { tone: keyof typeof ICON_TONES; disabled: boolean; onClick: () => void; label: string; title: string; children: ReactNode }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-label={label} title={title} className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md transition disabled:pointer-events-none disabled:opacity-50", ICON_TONES[tone])}>
      {children}
    </button>
  );
}

function FadeSelect({ label, name, value, onChange }: { label: string; name: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="inline-flex items-center gap-0.5" title={`Fundido de ${name}`}>
      {label}
      <select value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-6 rounded border border-line bg-surface px-0.5 text-[11px] text-ink" aria-label={`Fundido de ${name}`}>
        {FADES.map((item) => (
          <option key={item} value={item}>
            {item} s
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ on, onClick, title, icon }: { on: boolean; onClick: () => void; title: string; icon: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={title} title={title} className={cn("inline-flex size-6 items-center justify-center rounded border transition", on ? "border-signal/40 bg-signal-soft text-signal" : "border-line bg-surface text-muted hover:text-ink")}>
      {icon}
    </button>
  );
}
