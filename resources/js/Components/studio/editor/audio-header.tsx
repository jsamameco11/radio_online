import { Badge } from "@/Components/ui/badge";
import { cn } from "@/lib/cn";
import { duration as clock, dateTime } from "@/lib/format";
import { plural } from "@/lib/media/editor/describe";
import type { EditorTrack } from "@/types/media";
import { Cover } from "./cover";

function Figure({ label, value, note, highlight = false }: { label: string; value: string; note?: string; highlight?: boolean }) {
  return (
    <div className={cn("min-w-[5.75rem] rounded-xl border px-3.5 py-2", highlight ? "border-signal/40 bg-signal-soft" : "border-line bg-raised")}>
      <p className="text-[10.5px] font-semibold tracking-[0.12em] text-muted uppercase">{label}</p>
      <p className={cn("mt-0.5 font-display text-lg font-semibold tracking-tight tabular", highlight ? "text-signal" : "text-ink")}>{value}</p>
      {note && <p className="text-[10.5px] text-muted tabular">{note}</p>}
    </div>
  );
}

/** The audio being edited: cover, kind, title, where it is used and its length before and after the edit. */
export function AudioHeader({ track, total, length, loudness }: { track: EditorTrack; total: number; length: number; loudness: number | null }) {
  const changed = Math.abs(length - total) > 0.05;
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 md:flex-row md:items-center md:p-5">
      <Cover src={track.cover_url} className="size-16" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{track.kind_label}</Badge>
          {track.edited && (
            <Badge tone="signal">Editado{track.edited_at ? ` · ${dateTime(track.edited_at, { day: "numeric", month: "short" })}` : ""}</Badge>
          )}
          {track.episodes > 0 && <Badge tone="info">En {plural(track.episodes, "episodio", "episodios")}</Badge>}
          {track.upcoming > 0 && <Badge tone="gold">{plural(track.upcoming, "bloque programado", "bloques programados")}</Badge>}
        </div>
        <h2 className="mt-1.5 truncate font-display text-xl font-semibold tracking-tight text-ink">{track.title}</h2>
        {track.credit && <p className="truncate text-sm text-muted">{track.credit}</p>}
      </div>
      <div className="flex items-stretch gap-2">
        <Figure label={track.edited ? "Original" : "Duración"} value={clock(total)} />
        <Figure label="Editado" value={clock(length)} highlight={changed} note={Math.abs(length - total) > 0.5 ? `${length < total ? "−" : "+"}${clock(Math.abs(total - length))}` : undefined} />
        {loudness !== null && <Figure label="Volumen" value={loudness.toFixed(1)} note="LUFS" />}
      </div>
    </section>
  );
}
