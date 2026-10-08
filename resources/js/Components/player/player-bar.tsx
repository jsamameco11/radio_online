import { Link } from "@inertiajs/react";
import { Headphones, Loader2, Play, Square, Volume1, Volume2, VolumeX, X } from "lucide-react";
import { Equalizer, FrequencyTitle, StationLogo } from "@/Components/station/station-identity";
import { count } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ListenerState } from "@/types/radio";
import { usePlayer } from "./player-provider";

function headline(state: ListenerState): string {
  if (state.status === "connecting") return "Sintonizando…";
  if (state.status === "offline") return "Esta radio está fuera del aire en este momento";
  if (state.status === "error") return state.error ?? "No pudimos sintonizar esta radio";
  if (state.live) return state.liveTitle ?? "Transmisión en vivo";
  if (state.nowPlaying) return state.nowPlaying.artist ? `${state.nowPlaying.title} — ${state.nowPlaying.artist}` : state.nowPlaying.title;
  return state.status === "playing" ? "Sonando ahora" : "Pulsa play para escuchar";
}

/** Bottom bar of the public site with the station that is tuned in. */
export function PlayerBar() {
  const player = usePlayer();
  const { station, state } = player;
  if (!station) return null;

  const VolumeIcon = state.muted || state.volume === 0 ? VolumeX : state.volume < 0.5 ? Volume1 : Volume2;
  const playing = state.status === "playing";

  return (
    <div role="region" aria-label="Reproductor" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 shadow-[0_-8px_30px_-12px_rgb(0_0_0/0.18)] backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
        <button
          type="button"
          onClick={() => player.toggle()}
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105",
            player.active ? "bg-ink" : "bg-signal",
          )}
          aria-label={player.active ? "Detener" : "Escuchar"}
        >
          {state.status === "connecting" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : player.active ? (
            <Square className="size-4 fill-current" />
          ) : (
            <Play className="ml-0.5 size-5 fill-current" />
          )}
        </button>

        <Link href={`/radio/${station.frequency.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
          <StationLogo station={station} size="sm" className="hidden sm:flex" />
          <span className="min-w-0 space-y-0.5">
            <span className="flex items-center gap-2">
              <FrequencyTitle station={station} size="sm" className="flex-nowrap" />
              {state.live && <span className="shrink-0 rounded bg-signal px-1.5 py-px text-[0.6rem] font-bold tracking-widest text-white">EN VIVO</span>}
            </span>
            <span className={cn("flex items-center gap-2 text-xs", state.status === "error" ? "text-danger" : "text-muted")}>
              {playing && <Equalizer className="text-signal" />}
              <span className="truncate">{headline(state)}</span>
            </span>
          </span>
        </Link>

        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted tabular" title="Personas conectadas">
          <Headphones className="size-4" />
          {count(playing ? Math.max(state.listeners, station.listener_count) : station.listener_count, true)}
        </span>

        <div className="hidden items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={() => player.setMuted(!state.muted)}
            className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink"
            aria-label={state.muted ? "Activar sonido" : "Silenciar"}
          >
            <VolumeIcon className="size-5" />
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((state.muted ? 0 : state.volume) * 100)}
            onChange={(event) => player.setVolume(Number(event.target.value) / 100)}
            className="h-1 w-24 cursor-pointer accent-[var(--signal)]"
            aria-label="Volumen"
          />
        </div>

        <button type="button" onClick={() => player.dismiss()} className="rounded-lg p-1.5 text-faint hover:bg-raised hover:text-ink" aria-label="Cerrar reproductor">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
