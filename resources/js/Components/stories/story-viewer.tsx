import { Link, usePage } from "@inertiajs/react";
import { ChevronLeft, ChevronRight, Flag, Loader2, Pause, Play, Square, Volume2, VolumeX, X } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "@/Components/player";
import { Equalizer, FrequencyTitle, StationLogo } from "@/Components/station/station-identity";
import { cn } from "@/lib/cn";
import { ago } from "@/lib/format";
import { http } from "@/lib/http";
import type { SharedProps, Station } from "@/types";
import type { StationStories, Story } from "@/types/stories";
import { StoryReport } from "./story-report";
import { StoryStage } from "./story-stage";
import { rememberSeen, seenUntil, storedMuted, storeMuted } from "./story-style";

/** Where a station's stories start: the first not seen, its first or (going back) its last. */
type Entry = "unseen" | "start" | "end";

interface Position {
  station: number;
  story: number | null;
  entry: Entry;
}

interface StoryViewerProps {
  stations: Station[];
  startAt?: number;
  /** Stories already known, by frequency slug; the others are fetched when reached. */
  initial?: Record<string, Story[]>;
  /** Opens on this story instead of the first one not seen. */
  startStory?: string;
  /** Report reasons, when the stories came in `initial`. */
  reportReasons?: StationStories["report_reasons"];
  /** The studio previewing its own stories: no views, listening, links or reports. */
  preview?: boolean;
  onClose: () => void;
  /** A story was shown; `last` when it is the newest of its station. */
  onSeen?: (station: Station, story: Story, last: boolean) => void;
}

const HOLD_MS = 200;
const SWIPE_PX = 60;
const onMedia = "text-white [&_.text-faint]:text-white/60 [&_.text-muted]:text-white/70";
const chromeButton = "flex size-9 items-center justify-center rounded-full text-white transition hover:bg-white/15 focus-visible:bg-white/15 focus-visible:outline-none";

/**
 * Full-screen stories, one station after another. Tap the right or left half to move, hold
 * to pause, swipe sideways to change station and down to close; arrows, space and M on a
 * keyboard. Each story shown counts as a view (never in preview).
 */
export function StoryViewer({ stations, startAt = 0, initial, startStory, reportReasons = [], preview = false, onClose, onSeen }: StoryViewerProps) {
  const { auth } = usePage<SharedProps>().props;
  const player = usePlayer();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const elapsed = useRef(0);
  const viewed = useRef(new Set<string>());
  const requested = useRef(new Set(Object.keys(initial ?? {})));
  const pendingStart = useRef(startStory);
  const gesture = useRef<{ x: number; y: number; timer: number; held: boolean } | null>(null);
  const reducedMotion = useRef(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const [reels, setReels] = useState<Record<string, Story[]>>(initial ?? {});
  const [reasons, setReasons] = useState(reportReasons);
  const [position, setPosition] = useState<Position>({ station: startAt, story: null, entry: "unseen" });
  const [readyId, setReadyId] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [muted, setMuted] = useState(storedMuted);
  const [drag, setDrag] = useState(0);

  const station = stations[position.station] as Station | undefined;
  const reel = station ? reels[station.frequency.slug] : undefined;
  const story = reel && position.story !== null ? reel[position.story] : undefined;
  const ready = story !== undefined && (story.kind === "text" || readyId === story.id);
  const halted = held || paused || hidden || reporting;
  const haltedRef = useRef(halted);
  haltedRef.current = halted;

  const close = useCallback(() => dialogRef.current?.close(), []);

  const load = useCallback(
    (target: Station | undefined) => {
      if (preview || !target || requested.current.has(target.frequency.slug)) return;
      const slug = target.frequency.slug;
      requested.current.add(slug);
      http
        .get<StationStories>(`/radio/${slug}/estados`)
        .then((data) => {
          setReels((current) => ({ ...current, [slug]: data.stories }));
          setReasons(data.report_reasons);
        })
        .catch(() => setReels((current) => ({ ...current, [slug]: [] })));
    },
    [preview],
  );

  const restart = () => {
    elapsed.current = 0;
    if (videoRef.current) videoRef.current.currentTime = 0;
  };

  const next = () => {
    if (reel && position.story !== null && position.story < reel.length - 1) setPosition({ ...position, story: position.story + 1 });
    else if (position.station < stations.length - 1) setPosition({ station: position.station + 1, story: null, entry: "unseen" });
    else close();
  };

  const prev = () => {
    if (position.story !== null && position.story > 0) setPosition({ ...position, story: position.story - 1 });
    else if (position.station > 0) setPosition({ station: position.station - 1, story: null, entry: "end" });
    else restart();
  };

  const jump = (delta: 1 | -1) => {
    const target = position.station + delta;
    if (target >= 0 && target < stations.length) setPosition({ station: target, story: null, entry: "start" });
    else if (delta > 0) close();
  };

  const navigation = useRef({ next });
  navigation.current = { next };

  const toggleMute = () => {
    storeMuted(!muted);
    setMuted(!muted);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    stageRef.current?.focus();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    const visibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", visibility);
    return () => {
      root.style.overflow = overflow;
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (!reel) load(station);
    load(stations[position.station + 1]);
  }, [station, reel, stations, position.station, load]);

  useEffect(() => {
    if (!station || !reel || position.story !== null) return;
    if (reel.length === 0) {
      const target = position.station + (position.entry === "end" ? -1 : 1);
      if (target >= 0 && target < stations.length) setPosition({ station: target, story: null, entry: position.entry });
      else close();
      return;
    }
    const wanted = pendingStart.current ? reel.findIndex((item) => item.id === pendingStart.current) : -1;
    pendingStart.current = undefined;
    const until = seenUntil(station.id);
    const unseen = reel.findIndex((item) => !(item.seen || viewed.current.has(item.id) || (until !== null && item.created_at <= until)));
    const index = wanted >= 0 ? wanted : position.entry === "end" ? reel.length - 1 : position.entry === "start" ? 0 : Math.max(0, unseen);
    setPosition({ ...position, story: index });
  }, [station, reel, position, stations.length, close]);

  useEffect(() => {
    elapsed.current = 0;
  }, [story?.id]);

  useEffect(() => {
    if (!story || !ready) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (!haltedRef.current) elapsed.current += now - last;
      last = now;
      const video = videoRef.current;
      const fraction =
        story.kind === "video" && video ? (video.duration ? video.currentTime / Math.min(video.duration, story.duration_ms / 1000) : 0) : elapsed.current / story.duration_ms;
      if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, fraction)})`;
      if (fraction >= 1) {
        navigation.current.next();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [story, ready]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready) return;
    video.muted = muted;
    if (halted) video.pause();
    else
      video.play().catch(() => {
        if (!video.muted) setMuted(true);
      });
  }, [halted, ready, muted, story?.id]);

  useEffect(() => {
    if (!story || !ready || !station || !reel || viewed.current.has(story.id)) return;
    viewed.current.add(story.id);
    const last = story.id === reel[reel.length - 1].id;
    if (!preview) {
      void http.post(`/radio/${station.frequency.slug}/estados/${story.id}/visto`).catch(() => undefined);
      if (last) rememberSeen(station.id, story.created_at);
    }
    onSeen?.(station, story, last);
  }, [story, ready, station, reel, preview, onSeen]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const timer = window.setTimeout(() => {
      if (!gesture.current) return;
      gesture.current.held = true;
      setHeld(true);
    }, HOLD_MS);
    gesture.current = { x: event.clientX, y: event.clientY, timer, held: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.held && Math.hypot(dx, dy) > 10) window.clearTimeout(start.timer);
    if (!reducedMotion.current && !start.held && dy > 0 && dy > Math.abs(dx)) setDrag(dy);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    gesture.current = null;
    setDrag(0);
    if (!start) return;
    window.clearTimeout(start.timer);
    if (start.held) {
      setHeld(false);
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (dy > SWIPE_PX * 1.5 && dy > Math.abs(dx)) close();
    else if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) jump(dx < 0 ? 1 : -1);
    else if (event.clientX - event.currentTarget.getBoundingClientRect().left < event.currentTarget.clientWidth / 2) prev();
    else next();
  };

  const onPointerCancel = () => {
    if (gesture.current) window.clearTimeout(gesture.current.timer);
    gesture.current = null;
    setDrag(0);
    setHeld(false);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (reporting) return;
    const control = (event.target as HTMLElement).closest("button, a, input, textarea, select");
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev();
    } else if (event.key === " " && !control) {
      event.preventDefault();
      setPaused((value) => !value);
    } else if (event.key.toLowerCase() === "m" && story?.kind === "video") {
      toggleMute();
    }
  };

  const upcoming =
    reel && position.story !== null && position.story < reel.length - 1
      ? reel[position.story + 1]
      : stations[position.station + 1]
        ? reels[stations[position.station + 1].frequency.slug]?.[0]
        : undefined;
  const backdrop = story?.kind === "image" ? story.media_url : story?.kind === "video" ? story.poster_url : null;
  const current = station !== undefined && player.isCurrent(station);
  const playing = current && player.state.status === "playing";
  const connecting = current && player.state.status === "connecting";

  return (
    <dialog
      ref={dialogRef}
      aria-label={station ? `Estados de ${station.display_name}` : "Estados"}
      onClose={onClose}
      onCancel={(event) => {
        if (!reporting) return;
        event.preventDefault();
        setReporting(false);
      }}
      onKeyDown={onKeyDown}
      className="fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none overflow-hidden bg-black p-0 text-white backdrop:bg-black"
    >
      {backdrop && <img src={backdrop} alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full scale-125 object-cover opacity-40 blur-3xl" />}
      <div className="relative flex size-full items-center justify-center gap-6">
        <button type="button" onClick={prev} className={cn(chromeButton, "hidden size-11 bg-white/10 sm:flex")} aria-label="Estado anterior">
          <ChevronLeft className="size-6" />
        </button>

        <div
          className="relative h-dvh w-full overflow-hidden sm:aspect-[9/16] sm:h-[min(94dvh,calc(100dvw*16/9))] sm:w-auto sm:rounded-2xl sm:shadow-2xl"
          style={drag > 0 ? { transform: `translateY(${drag}px) scale(${1 - Math.min(drag, 400) / 2000})`, opacity: 1 - Math.min(drag, 400) / 800 } : undefined}
        >
          {story ? (
            <StoryStage key={story.id} story={story} videoRef={videoRef} muted={muted} onReady={() => setReadyId(story.id)} onEnded={next} className="size-full" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Loader2 className="size-8 animate-spin text-white/70" aria-label="Cargando estados" />
            </div>
          )}
          {story && !ready && <Loader2 className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/70" aria-hidden />}

          <div
            ref={stageRef}
            tabIndex={-1}
            className="absolute inset-0 touch-none outline-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onContextMenu={(event) => event.preventDefault()}
          />

          <header className={cn("absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-10 motion-safe:transition-opacity", held && "opacity-0")}>
            <div className="flex gap-1" aria-hidden>
              {reel?.map((item, index) => (
                <span key={item.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                  <span
                    ref={index === position.story ? barRef : undefined}
                    className="block h-full origin-left bg-white"
                    style={{ transform: `scaleX(${position.story !== null && index < position.story ? 1 : 0})` }}
                  />
                </span>
              ))}
            </div>
            {station && (
              <div className="mt-3 flex items-center gap-2.5">
                {preview ? (
                  <StationLogo station={station} size="xs" className="rounded-full" />
                ) : (
                  <Link href={`/radio/${station.frequency.slug}`} className="shrink-0 rounded-full" aria-label={`Ver ${station.display_name}`}>
                    <StationLogo station={station} size="xs" className="rounded-full" />
                  </Link>
                )}
                <div className="min-w-0 flex-1 leading-tight">
                  <FrequencyTitle station={station} size="sm" className={cn(onMedia, "flex-nowrap")} />
                  <p className="flex items-center gap-1.5 text-xs text-white/70">
                    {story && <span>{ago(story.created_at)}</span>}
                    {station.stream_status.value === "live" && <span className="rounded bg-signal px-1 text-[0.6rem] font-bold tracking-wider text-white">EN VIVO</span>}
                  </p>
                </div>
                <button type="button" onClick={() => setPaused((value) => !value)} className={chromeButton} aria-label={paused ? "Reanudar" : "Pausar"}>
                  {paused ? <Play className="size-5 fill-current" /> : <Pause className="size-5 fill-current" />}
                </button>
                {story?.kind === "video" && (
                  <button type="button" onClick={toggleMute} className={chromeButton} aria-label={muted ? "Activar sonido" : "Silenciar"} aria-pressed={!muted}>
                    {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                  </button>
                )}
                {!preview && auth.user && reasons.length > 0 && (
                  <button type="button" onClick={() => setReporting(true)} className={chromeButton} aria-label="Reportar estado">
                    <Flag className="size-4.5" />
                  </button>
                )}
                <button type="button" onClick={close} className={chromeButton} aria-label="Cerrar estados">
                  <X className="size-6" />
                </button>
              </div>
            )}
          </header>

          {!preview && station && (
            <footer
              className={cn(
                "absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent px-4 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))] motion-safe:transition-opacity",
                held && "opacity-0",
              )}
            >
              <button
                type="button"
                onClick={() => player.toggle(station)}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-signal px-5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
              >
                {connecting ? <Loader2 className="size-4 animate-spin" /> : current && player.active ? <Square className="size-3.5 fill-current" /> : <Play className="size-4 fill-current" />}
                {playing ? (
                  <>
                    Escuchando <Equalizer />
                  </>
                ) : connecting ? (
                  "Sintonizando…"
                ) : (
                  "Escuchar la radio"
                )}
              </button>
              <Link
                href={`/radio/${station.frequency.slug}`}
                className="inline-flex h-11 items-center rounded-full bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
              >
                Ver la radio
              </Link>
            </footer>
          )}

          {reporting && station && story && (
            <StoryReport url={`/radio/${station.frequency.slug}/estados/${story.id}/reportar`} reasons={reasons} onClose={() => setReporting(false)} />
          )}
        </div>

        <button type="button" onClick={next} className={cn(chromeButton, "hidden size-11 bg-white/10 sm:flex")} aria-label="Siguiente estado">
          <ChevronRight className="size-6" />
        </button>
      </div>

      <p className="sr-only" aria-live="polite">
        {station && story && reel ? `${station.display_name}: estado ${(position.story ?? 0) + 1} de ${reel.length}${paused ? ", en pausa" : ""}` : ""}
      </p>

      {upcoming?.kind === "image" && upcoming.media_url && <img src={upcoming.media_url} alt="" aria-hidden className="hidden" />}
      {upcoming?.kind === "video" && upcoming.media_url && <video src={upcoming.media_url} preload="auto" muted aria-hidden className="hidden" />}
    </dialog>
  );
}
