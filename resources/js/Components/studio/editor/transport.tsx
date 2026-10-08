import { CircleHelp, Pause, Play, Repeat, SkipBack, SkipForward, ZoomIn, ZoomOut } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { preciseTime } from "@/lib/media/editor/recipe";
import { ZOOM_STEP } from "./use-editor-keys";

interface Props {
  playing: boolean;
  broken: boolean;
  time: number;
  editedTime: number;
  length: number;
  duration: number;
  loop: boolean;
  bypass: boolean;
  zoom: number;
  levels: () => [number, number];
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onLoop: (loop: boolean) => void;
  onBypass: (bypass: boolean) => void;
  onZoom: (factor: number | null) => void;
  onGuide: () => void;
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className="flex size-9 items-center justify-center rounded-full text-ink transition hover:bg-raised disabled:opacity-30">
      {children}
    </button>
  );
}

/** Stereo output level, updated every frame without re-rendering React. */
function Meters({ levels }: { levels: () => [number, number] }) {
  const left = useRef<HTMLSpanElement>(null);
  const right = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const width = (db: number) => `${Math.max(0, Math.min(100, ((db + 60) / 60) * 100))}%`;
    const tick = () => {
      const [l, r] = levels();
      if (left.current) left.current.style.width = width(l);
      if (right.current) right.current.style.width = width(r);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [levels]);

  return (
    <div className="hidden w-28 flex-col gap-1 sm:flex" title="Nivel de salida (izquierdo y derecho)">
      {[left, right].map((meter, index) => (
        <span key={index} className="flex items-center gap-1.5">
          <span className="w-2 text-[9px] font-semibold text-faint">{index ? "R" : "L"}</span>
          <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <span ref={meter} className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-onair via-gold to-danger transition-[width] duration-75" style={{ width: 0 }} />
          </span>
        </span>
      ))}
    </div>
  );
}

/** Play controls, precise clock, output meters, loop, original/edited comparison, zoom and the quick guide. */
export function Transport({ playing, broken, time, editedTime, length, duration, loop, bypass, zoom, levels, onSeek, onTogglePlay, onLoop, onBypass, onZoom, onGuide }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-full border border-line bg-canvas p-1">
        <ToolButton label="Ir al inicio (Inicio)" onClick={() => onSeek(0)}>
          <SkipBack className="size-4" />
        </ToolButton>
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={broken}
          title="Reproducir o pausar (Espacio)"
          aria-label={playing ? "Pausar" : "Reproducir"}
          className="flex size-10 items-center justify-center rounded-full bg-signal text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
        </button>
        <ToolButton label="Ir al final (Fin)" onClick={() => onSeek(duration)}>
          <SkipForward className="size-4" />
        </ToolButton>
      </div>

      <div className="min-w-[9.5rem] rounded-xl border border-line bg-canvas px-3.5 py-1.5">
        <p className="font-mono text-[17px] leading-tight font-semibold text-ink tabular">{preciseTime(time)}</p>
        <p className="text-[10px] text-muted tabular">
          editado {preciseTime(editedTime)} / {preciseTime(length)}
        </p>
      </div>

      <Meters levels={levels} />

      <span className="mx-1 hidden h-8 w-px bg-line md:block" />

      <button
        type="button"
        onClick={() => onLoop(!loop)}
        aria-pressed={loop}
        title="Repite la parte seleccionada mientras ajustas (L)"
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
          loop ? "border-info/50 bg-info-soft text-info" : "border-line bg-canvas text-muted hover:text-ink",
        )}
      >
        <Repeat className="size-3.5" /> Repetir selección
      </button>
      <div className="flex rounded-full border border-line bg-canvas p-1 text-xs font-semibold" title="Compara el sonido original con el editado (B)">
        <button type="button" onClick={() => onBypass(true)} aria-pressed={bypass} className={cn("rounded-full px-3 py-1.5 transition", bypass ? "bg-raised text-ink ring-1 ring-line-strong" : "text-muted hover:text-ink")}>
          Original
        </button>
        <button type="button" onClick={() => onBypass(false)} aria-pressed={!bypass} className={cn("rounded-full px-3 py-1.5 transition", !bypass ? "bg-signal text-white" : "text-muted hover:text-ink")}>
          Editado
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1 rounded-full border border-line bg-canvas p-1">
        <ToolButton label="Alejar (−)" onClick={() => onZoom(1 / ZOOM_STEP)} disabled={zoom <= 1}>
          <ZoomOut className="size-4" />
        </ToolButton>
        <button type="button" onClick={() => onZoom(null)} className="min-w-12 rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted tabular hover:text-ink" title="Ver todo el audio">
          {zoom <= 1 ? "Todo" : `${Math.round(zoom * 100)}%`}
        </button>
        <ToolButton label="Acercar (+) · también Ctrl + rueda del mouse" onClick={() => onZoom(ZOOM_STEP)}>
          <ZoomIn className="size-4" />
        </ToolButton>
      </div>
      <button
        type="button"
        onClick={onGuide}
        title="Guía rápida y atajos de teclado (?)"
        aria-label="Guía rápida y atajos de teclado"
        className="flex size-9 items-center justify-center rounded-full border border-line bg-canvas text-muted transition hover:border-line-strong hover:text-ink"
      >
        <CircleHelp className="size-4" />
      </button>
    </div>
  );
}
