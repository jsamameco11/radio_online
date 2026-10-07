import { Loader2, Play, Square } from "lucide-react";
import { Equalizer } from "@/Components/station/station-identity";
import { buttonClasses } from "@/Components/ui/button";
import { cn } from "@/lib/cn";
import type { Station } from "@/types";
import { usePlayer } from "./player-provider";

interface ListenButtonProps {
  station: Station;
  size?: "sm" | "md" | "lg";
  /** Round icon-only button, for cards. */
  compact?: boolean;
  className?: string;
}

/** Tunes the player to a station, or stops it when that station is already sounding. */
export function ListenButton({ station, size = "md", compact = false, className }: ListenButtonProps) {
  const player = usePlayer();
  const current = player.isCurrent(station);
  const connecting = current && player.state.status === "connecting";
  const playing = current && player.state.status === "playing";
  const label = current && player.active ? `Detener ${station.display_name}` : `Escuchar ${station.display_name}`;

  const icon = connecting ? (
    <Loader2 className="size-4 animate-spin" />
  ) : current && player.active ? (
    <Square className="size-3.5 fill-current" />
  ) : (
    <Play className="size-4 fill-current" />
  );

  if (compact) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          player.toggle(station);
        }}
        className={cn(
          "flex size-11 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105",
          current && player.active ? "bg-ink" : "bg-signal",
          className,
        )}
        aria-label={label}
      >
        {icon}
      </button>
    );
  }

  return (
    <button type="button" onClick={() => player.toggle(station)} className={buttonClasses(current && player.active ? "primary" : "signal", size, cn("min-w-36", className))} aria-label={label}>
      {icon}
      {playing ? (
        <>
          Escuchando <Equalizer />
        </>
      ) : connecting ? (
        "Sintonizando…"
      ) : (
        "Escuchar"
      )}
    </button>
  );
}
