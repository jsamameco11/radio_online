import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/Components/player";
import { duration as formatDuration } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { EpisodeCard } from "@/types/site";

/**
 * On-demand player of an episode. Starting it silences the live player, and
 * tuning in a station pauses it, so two sounds never overlap.
 */
export function EpisodePlayer({ episode, className }: { episode: EpisodeCard; className?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const live = usePlayer();
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [length, setLength] = useState(episode.duration);

  useEffect(() => {
    if (live.active && playing) audio.current?.pause();
  }, [live.active, playing]);

  if (!episode.audio_url) {
    return <p className={cn("rounded-2xl bg-raised px-4 py-3 text-sm text-muted", className)}>El audio de este episodio no está disponible por ahora.</p>;
  }

  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (element.paused) {
      live.stop();
      void element.play();
    } else {
      element.pause();
    }
  };

  const skip = (seconds: number) => {
    if (audio.current) audio.current.currentTime = Math.max(0, Math.min(length, audio.current.currentTime + seconds));
  };

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 sm:gap-4 sm:p-4", className)}>
      <audio
        ref={audio}
        src={episode.audio_url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => Number.isFinite(event.currentTarget.duration) && setLength(event.currentTarget.duration)}
      />
      <button
        type="button"
        onClick={toggle}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-surface transition hover:scale-105"
        aria-label={playing ? "Pausar episodio" : "Reproducir episodio"}
      >
        {playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
      </button>
      <button type="button" onClick={() => skip(-15)} className="hidden rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink sm:block" aria-label="Retroceder 15 segundos">
        <RotateCcw className="size-4" />
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(length))}
          value={Math.round(position)}
          onChange={(event) => {
            if (audio.current) audio.current.currentTime = Number(event.target.value);
          }}
          className="h-1 w-full cursor-pointer accent-[var(--signal)]"
          aria-label="Posición del episodio"
        />
        <div className="flex justify-between text-xs text-muted tabular">
          <span>{formatDuration(position)}</span>
          <span>{formatDuration(length)}</span>
        </div>
      </div>
      <button type="button" onClick={() => skip(30)} className="hidden rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink sm:block" aria-label="Adelantar 30 segundos">
        <RotateCw className="size-4" />
      </button>
    </div>
  );
}
