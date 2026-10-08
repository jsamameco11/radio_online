import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { shortTitle } from "@/lib/radio/format";
import type { BroadcastTrack, TrackKind } from "@/types/studio";
import { BEDS, PLAYERS, type ConsoleApi } from "./use-console";

const TRACK = "application/x-turadio-track";

const FILTERS: { id: "all" | TrackKind; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "song", label: "Música" },
  { id: "effect", label: "Efectos" },
  { id: "commercial", label: "Anuncios" },
  { id: "program", label: "Programas" },
];

const SEND = [
  ...BEDS.map((lane) => ({ lane, label: lane })),
  ...PLAYERS.map((lane) => ({ lane, label: lane })),
  { lane: "pad", label: "Botón" },
  { lane: "program", label: "Aire" },
];

/**
 * The library beside the live timeline: search it, drag a sound onto a lane, or send the
 * selected one to a bed, a player, the pad bank or straight on air.
 */
export function LibraryRail({ api, library }: { api: ConsoleApi; library: BroadcastTrack[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [picked, setPicked] = useState<string | null>(null);
  const sounds = useMemo(() => {
    const term = query.trim().toLowerCase();
    return library.filter((track) => {
      const kind = filter === "all" || track.kind === filter || (filter === "effect" && track.kind === "jingle");
      const text = !term || `${track.title} ${track.artist ?? ""}`.toLowerCase().includes(term);
      return kind && text;
    });
  }, [filter, library, query]);
  const selected = library.find((track) => track.id === picked) ?? null;

  async function send(lane: string) {
    if (!selected) return;
    if (!selected.playable) {
      api.setNotice({ tone: "error", text: `«${selected.title}» no se puede reproducir. Revisa el archivo en la biblioteca.` });
      return;
    }
    if (lane === "program") {
      await api.run("post", "/lanzar", { type: "tracks", tracks: [selected.id] });
      return;
    }
    if (lane === "pad") {
      await api.firePad(selected);
      return;
    }
    const bed = (BEDS as readonly string[]).includes(lane);
    await api.play(selected, lane, { volume: bed ? 70 : 100, duck: !bed, fadeIn: bed ? api.blend : 0, fadeOut: bed ? api.blend : 0, loop: bed });
  }

  return (
    <section className="flex max-h-[28rem] min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface xl:h-0 xl:max-h-none xl:min-h-full" aria-label="Biblioteca">
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="text-[0.68rem] font-semibold tracking-[0.16em] text-faint uppercase">Biblioteca · arrastra</h2>
        <span className="font-mono text-xs text-muted tabular">{library.length}</span>
      </header>
      <div className="space-y-2 border-b border-line p-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar sonido…"
            aria-label="Buscar sonido"
            className="h-8 w-full rounded-lg border border-line bg-canvas pr-2 pl-8 text-xs text-ink placeholder:text-faint focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Tipo de audio">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn("h-6 rounded-full px-2 text-[10px] font-semibold tracking-wide uppercase", filter === item.id ? "bg-ink text-canvas" : "bg-raised text-muted hover:text-ink")}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="desk-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
        {sounds.length === 0 ? <li className="px-2 py-6 text-center text-xs text-muted">Ningún sonido con ese filtro.</li> : null}
        {sounds.map((track) => (
          <li key={track.id}>
            <button
              type="button"
              draggable={track.playable}
              onDragStart={(event) => {
                event.dataTransfer.setData(TRACK, track.id);
                event.dataTransfer.setData("text/plain", track.id);
                event.dataTransfer.effectAllowed = "copy";
                setPicked(track.id);
              }}
              onClick={() => setPicked(track.id)}
              aria-pressed={picked === track.id}
              title={track.playable ? `${track.title}. Arrástralo a la línea de tiempo.` : "Este archivo no se puede reproducir"}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left",
                picked === track.id ? "bg-royal-soft ring-1 ring-royal/40" : "hover:bg-raised",
                !track.playable && "opacity-45",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-ink">{shortTitle(track.title, 32)}</span>
                <span className="block truncate text-[10px] tracking-wide text-faint uppercase">
                  {track.kind_label} · {duration(track.duration)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t border-line p-2">
        <p className="mb-1.5 text-[10px] text-muted">Elige un sonido para enviarlo a</p>
        <div className="flex flex-wrap gap-1">
          {SEND.map((item) => (
            <button
              key={item.lane}
              type="button"
              disabled={!selected?.playable}
              onClick={() => void send(item.lane)}
              className="h-7 min-w-7 rounded-md border border-line bg-canvas px-1.5 font-mono text-[10px] font-semibold text-ink hover:border-royal/50 hover:text-royal disabled:opacity-40"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
