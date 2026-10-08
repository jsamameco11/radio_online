import { Headphones, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import { BACKING_CATEGORIES, BACKING_TRACKS, bpmOf, keyOf, secondsOf, type BackingTrack } from "@/lib/dj/backing/catalog";
import { backingFile, backingUrl, previewBacking, stopBackingPreview } from "@/lib/dj/backing/render";
import type { DjEngine } from "@/lib/dj/engine";
import type { DeckId, DjState } from "@/lib/dj/types";

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const COUNTS = new Map(BACKING_CATEGORIES.map((category) => [category.id, BACKING_TRACKS.filter((track) => track.category === category.id).length]));

const LABELS = new Map(BACKING_CATEGORIES.map((category) => [category.id, category.label]));

/**
 * Backing tracks to build a set on: grooves, beats, bass lines, chords and percussion at an exact
 * tempo, made in this browser. They load into a deck or the sampler like any other audio.
 */
export function BackingTracks({ engine, state, onNotice }: { engine: DjEngine; state: DjState; onNotice: (text: string) => void }) {
  const [category, setCategory] = useState("grooves");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const search = fold(query.trim());
  const visible = useMemo(
    () => BACKING_TRACKS.filter((track) => (search ? fold(`${track.title} ${LABELS.get(track.category)} ${bpmOf(track)} ${keyOf(track)}`).includes(search) : track.category === category)),
    [category, search],
  );

  useEffect(() => () => stopBackingPreview(), []);

  function preview(track: BackingTrack) {
    if (playing === track.id) {
      stopBackingPreview();
      setPlaying(null);
      return;
    }
    setPlaying(track.id);
    void previewBacking(track, () => setPlaying((value) => (value === track.id ? null : value)));
  }

  async function toDeck(track: BackingTrack, id: DeckId) {
    setBusy(`${track.id}:${id}`);
    try {
      const file = await backingFile(track);
      await engine.load(id, { id: null, title: track.title, artist: `Pista DJ · ${keyOf(track)}`, bpm: bpmOf(track), file });
    } catch {
      onNotice(`No pudimos preparar «${track.title}». Inténtalo de nuevo.`);
    }
    setBusy(null);
  }

  async function toSampler(track: BackingTrack) {
    const free = state.sampler.findIndex((slot) => slot === null);
    if (free < 0) {
      onNotice("El sampler está lleno: vacía una ranura para sumar esta pista.");
      return;
    }
    setBusy(`${track.id}:s`);
    try {
      engine.setSample(free, { id: null, title: track.title, src: await backingUrl(track) });
    } catch {
      onNotice(`No pudimos preparar «${track.title}». Inténtalo de nuevo.`);
    }
    setBusy(null);
  }

  return (
    <section aria-label="Pistas para crear" className="@container flex min-w-0 flex-col gap-2.5 rounded-xl border border-line bg-surface p-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-ink">
            Pistas para crear <span className="font-mono text-[10px] font-medium text-faint tabular">{BACKING_TRACKS.length}</span>
          </h3>
          <p className="text-[11px] leading-snug text-muted">Bases a tempo exacto para mezclar, rapear o locutar encima. Pre-escúchalas en tus auriculares y cárgalas en un deck o en el sampler.</p>
        </div>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar: house, 128, La menor…" className="h-8 w-full text-xs @lg:w-56" aria-label="Buscar una pista" />
      </header>

      <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {BACKING_CATEGORIES.map((item) => {
          const on = !search && category === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setCategory(item.id);
                setQuery("");
              }}
              title={item.hint}
              aria-pressed={on}
              className={cn("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition", on ? "border-ink bg-ink text-canvas" : "border-line text-muted hover:text-ink")}
            >
              {item.label}
              <span className={cn("tabular", on ? "text-canvas/70" : "text-faint")}>{COUNTS.get(item.id)}</span>
            </button>
          );
        })}
      </div>

      <ul className="desk-rail grid max-h-72 gap-1.5 overflow-y-auto overscroll-contain pr-1 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {visible.map((track) => {
          const on = playing === track.id;
          return (
            <li key={track.id} className={cn("flex min-w-0 items-center gap-2 rounded-lg border p-1.5", on ? "border-signal bg-signal-soft" : "border-line bg-raised")}>
              <button
                type="button"
                onClick={() => preview(track)}
                className={cn("grid size-8 shrink-0 place-items-center rounded-md border transition", on ? "border-signal bg-signal text-white" : "border-line-strong bg-surface text-ink hover:bg-canvas")}
                aria-label={on ? `Detener la pre-escucha de ${track.title}` : `Pre-escuchar ${track.title}`}
                title="Pre-escucha: solo tú la oyes"
              >
                {on ? <Square className="size-3 fill-current" /> : <Headphones className="size-3.5" />}
              </button>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-ink" title={track.title}>
                  {track.title}
                </span>
                <span className="block truncate font-mono text-[10px] text-muted tabular">
                  {search ? `${LABELS.get(track.category)} · ` : ""}
                  {bpmOf(track)} BPM · {keyOf(track)} · {Math.round(secondsOf(track))} s
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                {([0, 1] as DeckId[]).map((id) => (
                  <LoadButton key={id} label={String(id + 1)} busy={busy === `${track.id}:${id}`} disabled={busy !== null || state.decks[id].playing || state.decks[id].loading} title={state.decks[id].playing ? `Detén el deck ${id + 1} para cargarla` : `Cargar en el deck ${id + 1}`} onClick={() => void toDeck(track, id)} />
                ))}
                <LoadButton label="S" busy={busy === `${track.id}:s`} disabled={busy !== null} title="Agregar al sampler" onClick={() => void toSampler(track)} />
              </span>
            </li>
          );
        })}
        {!visible.length ? <li className="col-span-full py-6 text-center text-xs text-muted">No hay pistas con ese nombre.</li> : null}
      </ul>
    </section>
  );
}

function LoadButton({ label, busy, disabled, title, onClick }: { label: string; busy: boolean; disabled: boolean; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn("grid size-7 place-items-center rounded-md border border-line-strong bg-surface font-mono text-[11px] font-semibold text-ink transition hover:bg-canvas disabled:opacity-45", busy && "animate-pulse")}
    >
      {label}
    </button>
  );
}
