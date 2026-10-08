import { Radio } from "lucide-react";
import type { Station, StreamStatusValue } from "@/types";
import { cn } from "@/lib/cn";

const logoSizes = { xs: "size-8 rounded-lg", sm: "size-10 rounded-xl", md: "size-14 rounded-2xl", lg: "size-24 rounded-3xl", xl: "size-36 rounded-[2rem]" };

export function StationLogo({ station, size = "md", className }: { station: Pick<Station, "name" | "logo_url" | "accent_color">; size?: keyof typeof logoSizes; className?: string }) {
  if (station.logo_url) {
    return <img src={station.logo_url} alt={station.name} className={cn("shrink-0 object-cover ring-1 ring-line", logoSizes[size], className)} />;
  }

  return (
    <span
      className={cn("flex shrink-0 items-center justify-center text-white ring-1 ring-line", logoSizes[size], className)}
      style={{ background: station.accent_color ?? "linear-gradient(135deg, #1f1f2b, #0b0b10)" }}
      aria-hidden
    >
      <Radio className="size-1/2" />
    </span>
  );
}

/**
 * The station identity everywhere in the platform: "89.30 · Radio Aurora".
 * The frequency leads, in the display face with tabular figures.
 */
export function FrequencyTitle({ station, size = "md", className }: { station: Pick<Station, "name" | "frequency">; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const scales = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
    xl: "text-4xl sm:text-5xl",
  };

  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-baseline gap-x-2 font-display font-semibold text-ink", scales[size], className)}>
      <span className="tabular">{station.frequency.label}</span>
      <span className="text-faint" aria-hidden>
        ·
      </span>
      <span className="truncate">{station.name}</span>
    </span>
  );
}

const statusStyles: Record<StreamStatusValue, { dot: string; text: string; label: string }> = {
  live: { dot: "bg-signal animate-onair", text: "text-signal", label: "EN VIVO" },
  online: { dot: "bg-onair", text: "text-onair", label: "AL AIRE" },
  connecting: { dot: "bg-warning animate-onair", text: "text-warning", label: "CONECTANDO" },
  offline: { dot: "bg-faint", text: "text-muted", label: "FUERA DEL AIRE" },
  error: { dot: "bg-danger", text: "text-danger", label: "CON FALLAS" },
  maintenance: { dot: "bg-warning", text: "text-warning", label: "MANTENIMIENTO" },
};

export function StreamStatusBadge({ status, className }: { status: StreamStatusValue; className?: string }) {
  const style = statusStyles[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[0.7rem] font-bold tracking-[0.12em]", style.text, className)}>
      <span className={cn("size-2 rounded-full", style.dot)} aria-hidden />
      {style.label}
    </span>
  );
}

/** Three animated bars shown while something is playing. */
export function Equalizer({ className }: { className?: string }) {
  return (
    <span className={cn("animate-equalizer inline-flex h-3.5 items-end gap-0.5", className)} aria-hidden>
      <span className="h-full w-0.5 rounded-full bg-current" />
      <span className="h-full w-0.5 rounded-full bg-current" />
      <span className="h-full w-0.5 rounded-full bg-current" />
    </span>
  );
}
