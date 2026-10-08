import { Link } from "@inertiajs/react";
import { GripVertical, Headphones, Plus, Search, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentProps, type DragEvent } from "react";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { EFFECT_CATEGORIES, FACTORY_EFFECTS, previewEffect, stopPreview, type FactoryEffect } from "@/lib/radio/effects";
import { shortTitle } from "@/lib/radio/format";
import type { BroadcastTrack, TrackKind } from "@/types/studio";
import { dragEffect, dragTrack } from "./drag";
import { CategoryChip, effectLength, fold } from "./effects-library";
import { KIND_DOT } from "./labels";
import { BEDS, PLAYERS, type ConsoleApi } from "./use-console";
import { inBank, type PadsApi } from "./use-pads";
import { EFFECT_LABELS, isAnyFactoryTrack, type Sounds } from "./use-sounds";

type Filter = "all" | "factory" | TrackKind;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "song", label: "Música" },
  { id: "factory", label: "Efectos" },
  { id: "jingle", label: "Jingles" },
  { id: "commercial", label: "Anuncios" },
  { id: "program", label: "Programas" },
];

const SEND = [...BEDS, ...PLAYERS];

type Picked = { type: "track"; id: string } | { type: "effect"; id: string };

type Preview = { id: string; start: number; total: number };

/**
 * The sounds beside the live timeline: the library plus every factory effect. Hear one in the
 * headphones (only the operator), drag it onto a lane, a player or the pad bank (double click adds
 * it to the bank too), or send the selected one to a bed, a player, the bank or straight on air.
 * A factory effect joins the library the first time it is used.
 */
export function LibraryRail({ api, sounds, bank }: { api: ConsoleApi; sounds: Sounds; bank: PadsApi }) {
  const { library } = sounds;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [, setTick] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const search = fold(query.trim());

  const tracks = useMemo(
    () =>
      filter === "factory"
        ? []
        : library.filter((track) => (filter === "all" ? !isAnyFactoryTrack(track) : track.kind === filter) && (!search || fold(`${track.title} ${track.artist ?? ""}`).includes(search))),
    [filter, library, search],
  );
  const effects = useMemo(
    () =>
      filter === "factory" || (filter === "all" && search)
        ? FACTORY_EFFECTS.filter((item) => (search ? fold(`${item.title} ${EFFECT_LABELS.get(item.category)}`).includes(search) : !category || item.category === category))
        : [],
    [category, filter, search],
  );
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    FACTORY_EFFECTS.forEach((item) => map.set(item.category, (map.get(item.category) ?? 0) + 1));
    return map;
  }, []);

  const pickedTrack = picked?.type === "track" ? (library.find((track) => track.id === picked.id) ?? null) : null;
  const pickedEffect = picked?.type === "effect" ? (FACTORY_EFFECTS.find((item) => item.id === picked.id) ?? null) : null;
  const pickedTitle = pickedTrack?.title ?? pickedEffect?.title ?? null;
  const ready = pickedEffect !== null || Boolean(pickedTrack?.playable);

  useEffect(() => {
    if (!preview) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 200);
    return () => window.clearInterval(timer);
  }, [preview]);

  useEffect(
    () => () => {
      audio.current?.pause();
      stopPreview();
    },
    [],
  );

  function silence() {
    audio.current?.pause();
    audio.current = null;
    stopPreview();
    setPreview(null);
  }

  function hearTrack(track: BroadcastTrack) {
    const same = preview?.id === track.id;
    silence();
    if (same || !track.src) return;
    const element = new Audio(track.src);
    audio.current = element;
    element.onended = () => setPreview((value) => (value?.id === track.id ? null : value));
    element.onerror = () => {
      setPreview(null);
      api.setNotice({ tone: "error", text: `No pudimos escuchar «${track.title}». Revisa el archivo en la biblioteca.` });
    };
    void element.play().catch(() => setPreview(null));
    setPreview({ id: track.id, start: performance.now(), total: track.duration });
  }

  function hearEffect(item: FactoryEffect) {
    const same = preview?.id === item.id;
    silence();
    if (same) return;
    setPreview({ id: item.id, start: performance.now(), total: item.seconds });
    void previewEffect(item, () => setPreview((value) => (value?.id === item.id ? null : value)));
  }

  function elapsed(id: string): number {
    if (preview?.id !== id) return 0;
    return audio.current ? audio.current.currentTime : Math.min(preview.total, (performance.now() - preview.start) / 1000);
  }

  async function chosen(): Promise<BroadcastTrack | null> {
    if (pickedEffect) return sounds.ensure(pickedEffect);
    if (pickedTrack && !pickedTrack.playable) {
      api.setNotice({ tone: "error", text: `«${pickedTrack.title}» no se puede reproducir. Revisa el archivo en la biblioteca.` });
      return null;
    }
    return pickedTrack;
  }

  async function send(lane: string) {
    const track = await chosen();
    if (track) await api.drop(track, lane);
  }

  async function fire() {
    const track = await chosen();
    if (track) await api.firePad(track);
  }

  async function onAir() {
    const track = await chosen();
    if (track) await api.launch(track);
  }

  function addTrack(track: BroadcastTrack) {
    if (!track.playable) return;
    void bank.add(track).then((result) => result.error && api.setNotice({ tone: "error", text: result.error }));
  }

  function addPicked() {
    if (pickedEffect) bank.load([pickedEffect]);
    else if (pickedTrack) addTrack(pickedTrack);
  }

  const pickedInBank = pickedEffect ? inBank(bank.pads, pickedEffect) : pickedTrack ? bank.pads.some((pad) => pad.id === pickedTrack.id) : false;
  const empty = !tracks.length && !effects.length;

  return (
    <section className="flex max-h-[28rem] min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface xl:h-0 xl:max-h-none xl:min-h-full" aria-label="Sonidos">
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="text-[0.68rem] font-semibold tracking-[0.16em] text-faint uppercase">Sonidos · arrastra</h2>
        <span className="font-mono text-xs text-muted tabular" title={`${library.length} en la biblioteca · ${FACTORY_EFFECTS.length} efectos de fábrica`}>
          {filter === "factory" ? FACTORY_EFFECTS.length : library.length}
        </span>
      </header>
      <div className="space-y-2 border-b border-line p-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar sonido o efecto…"
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
        {filter === "factory" && !search ? (
          <div className="desk-scroll -mx-2 flex gap-1 overflow-x-auto px-2 pb-0.5">
            <CategoryChip small on={!category} onClick={() => setCategory("")} label="Todos" count={FACTORY_EFFECTS.length} />
            {EFFECT_CATEGORIES.map((item) => (
              <CategoryChip small key={item.id} on={category === item.id} onClick={() => setCategory(item.id)} label={item.label} count={counts.get(item.id) ?? 0} title={item.hint} />
            ))}
          </div>
        ) : null}
      </div>

      <ul className="desk-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
        {empty ? (
          <li className="px-2 py-6 text-center text-xs text-muted">
            {library.length || filter === "factory" ? "Ningún sonido con ese filtro." : "Aún no hay audios en la biblioteca."}{" "}
            {filter !== "factory" ? (
              <Link href={api.url("/biblioteca")} className="font-medium text-ink underline">
                Súbelos en la Biblioteca
              </Link>
            ) : null}
          </li>
        ) : null}
        {tracks.map((track) => (
          <SoundRow
            key={track.id}
            title={track.title}
            meta={`${track.kind_label} · ${duration(track.duration)}`}
            dot={KIND_DOT[track.kind]}
            disabled={!track.playable}
            picked={picked?.type === "track" && picked.id === track.id}
            hearing={preview?.id === track.id ? { elapsed: elapsed(track.id), total: preview.total } : null}
            onPick={() => setPicked({ type: "track", id: track.id })}
            onHear={() => hearTrack(track)}
            onAdd={() => addTrack(track)}
            onDragStart={(event) => {
              dragTrack(event, track);
              setPicked({ type: "track", id: track.id });
            }}
          />
        ))}
        {effects.length && filter === "all" ? <li className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-[0.14em] text-faint uppercase">Efectos de fábrica</li> : null}
        {effects.map((item) => (
          <SoundRow
            key={item.id}
            title={item.title}
            meta={`${EFFECT_LABELS.get(item.category)} · ${effectLength(item.seconds)}`}
            dot={KIND_DOT.effect}
            picked={picked?.type === "effect" && picked.id === item.id}
            busy={sounds.storing.includes(item.id)}
            hearing={preview?.id === item.id ? { elapsed: elapsed(item.id), total: preview.total } : null}
            onPick={() => setPicked({ type: "effect", id: item.id })}
            onHear={() => hearEffect(item)}
            onAdd={() => bank.load([item])}
            onDragStart={(event) => {
              dragEffect(event, item);
              setPicked({ type: "effect", id: item.id });
            }}
          />
        ))}
      </ul>

      <div className="border-t border-line p-2">
        <p className="mb-1.5 truncate text-[10px] text-muted" title={pickedTitle ?? undefined}>
          {pickedTitle ? `Enviar «${shortTitle(pickedTitle, 26)}» a` : "Elige un sonido para enviarlo a"}
        </p>
        <div className="flex flex-wrap gap-1">
          {SEND.map((lane) => (
            <SendButton key={lane} disabled={!ready} onClick={() => void send(lane)} title={(BEDS as readonly string[]).includes(lane) ? `Fondo ${lane}: suena en bucle bajo la programación` : `Reproductor ${lane}: si ya suena, hace un fundido cruzado`}>
              {lane}
            </SendButton>
          ))}
          <SendButton disabled={!ready} onClick={() => void fire()} title="Suena una vez como un botón">
            Botón
          </SendButton>
          <SendButton disabled={!ready || pickedInBank} onClick={addPicked} title={pickedInBank ? "Ya está en la botonera" : "Lo agrega a la botonera"}>
            +Pad
          </SendButton>
          <SendButton disabled={!ready} onClick={() => void onAir()} title="Lo pone al aire en la pista principal (pide confirmación)">
            Aire
          </SendButton>
        </div>
      </div>
    </section>
  );
}

function SendButton({ children, ...props }: ComponentProps<"button">) {
  return (
    <button type="button" className="h-7 min-w-7 rounded-md border border-line bg-canvas px-1.5 font-mono text-[10px] font-semibold text-ink hover:border-royal/50 hover:text-royal disabled:opacity-40" {...props}>
      {children}
    </button>
  );
}

interface SoundRowProps {
  title: string;
  meta: string;
  dot: string;
  picked: boolean;
  disabled?: boolean;
  busy?: boolean;
  hearing: { elapsed: number; total: number } | null;
  onPick: () => void;
  onHear: () => void;
  onAdd: () => void;
  onDragStart: (event: DragEvent) => void;
}

function SoundRow({ title, meta, dot, picked, disabled = false, busy = false, hearing, onPick, onHear, onAdd, onDragStart }: SoundRowProps) {
  return (
    <li
      draggable={!disabled}
      onDragStart={onDragStart}
      onClick={onPick}
      onDoubleClick={() => !disabled && onAdd()}
      title={disabled ? "Este archivo no se puede reproducir" : `${title}. Arrástralo a la línea de tiempo, a un reproductor o a la botonera; doble clic lo suma a la botonera.`}
      aria-selected={picked}
      className={cn("group relative flex cursor-grab items-center gap-1.5 overflow-hidden rounded-lg py-1.5 pr-1 pl-0.5 active:cursor-grabbing", picked ? "bg-royal-soft ring-1 ring-royal/40" : "hover:bg-raised", disabled && "cursor-not-allowed opacity-45")}
    >
      <GripVertical className="size-3.5 shrink-0 text-faint" aria-hidden />
      <span className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-ink">{shortTitle(title, 32)}</span>
        <span className="block truncate text-[10px] tracking-wide text-faint uppercase">{hearing ? `${duration(hearing.elapsed)} / ${duration(hearing.total)}` : busy ? "Preparando…" : meta}</span>
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onHear();
        }}
        aria-label={hearing ? `Dejar de escuchar ${title}` : `Escuchar ${title} en los audífonos`}
        title={hearing ? "Detener" : "Escuchar en los audífonos (solo tú)"}
        className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", hearing ? "bg-signal text-canvas" : "text-muted hover:bg-canvas hover:text-ink")}
      >
        {hearing ? <Square className="size-3" /> : <Headphones className="size-3.5" />}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onAdd();
        }}
        aria-label={`Agregar ${title} a la botonera`}
        title="Agregar a la botonera"
        className="hidden size-6 shrink-0 items-center justify-center rounded-md text-muted group-hover:flex hover:bg-canvas hover:text-royal"
      >
        <Plus className="size-3.5" />
      </button>
      {hearing ? <span className="absolute bottom-0 left-0 h-0.5 bg-signal" style={{ width: `${Math.min(100, (hearing.elapsed / Math.max(0.1, hearing.total)) * 100)}%` }} aria-hidden /> : null}
    </li>
  );
}
