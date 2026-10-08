import { ArrowLeft, ArrowLeftRight, ArrowRight, Music, Pause, Play, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/Components/ui/button";
import { cn } from "@/lib/cn";
import { bytes, duration as formatDuration } from "@/lib/format";
import { compareAudio, printOf, WINDOW_SECONDS, type AcousticMatch, type AudioPrint } from "@/lib/media/fingerprint";
import type { DuplicateMatch } from "@/types/media";
import { choiceOf, decide, DecisionOptions, decisionOptions, replaceTarget, type DuplicateChoice, type DuplicateDecision, type DuplicateReview } from "./duplicates";
import { plain } from "./song-tools";

/** One of the two songs being compared. */
export interface CompareSide {
  key: string;
  /** Where the song is: new, in the library or elsewhere in this upload. */
  place: string;
  title: string;
  /** The author followed by the guests. */
  credit: string;
  album: string;
  year: string;
  duration: number | null;
  genres: string[];
  cover: string | null;
  /** The file being uploaded or the address of the library audio. */
  audio: Blob | string | null;
  /** Size of the file when it is known without downloading it. */
  bytes: number | null;
  fileName: string | null;
}

/** A song the new one may repeat, with what the server based its verdict on. */
export interface ComparePair {
  match: DuplicateMatch;
  other: CompareSide;
}

type Side = "a" | "b";
type PrintState = { status: "none" } | { status: "loading" } | { status: "ready"; print: AudioPrint } | { status: "error"; error: string };
type Agreement = "same" | "close" | "diff" | "one" | "none";

const SIDE_LOOK: Record<Side, { badge: string; played: string; ring: string }> = {
  a: { badge: "bg-signal text-white", played: "fill-signal", ring: "border-signal/60 ring-2 ring-signal/25" },
  b: { badge: "bg-info text-white", played: "fill-info", ring: "border-info/60 ring-2 ring-info/25" },
};

const words = (text: string) =>
  plain(text)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function agreeText(first: string, second: string): Agreement {
  const [a, b] = [words(first), words(second)];
  if (!a && !b) return "none";
  if (!a || !b) return "one";
  if (a === b) return "same";
  return a.includes(b) || b.includes(a) ? "close" : "diff";
}

function agreeList(first: string[], second: string[]): Agreement {
  const [a, b] = [new Set(first.map(words).filter(Boolean)), new Set(second.map(words).filter(Boolean))];
  if (!a.size && !b.size) return "none";
  if (!a.size || !b.size) return "one";
  const shared = [...a].filter((name) => b.has(name)).length;
  if (shared === a.size && shared === b.size) return "same";
  return shared ? "close" : "diff";
}

function agreeNumber(first: number | null, second: number | null, same: number, close: number): Agreement {
  if (first === null && second === null) return "none";
  if (first === null || second === null) return "one";
  const gap = Math.abs(first - second);
  return gap <= same ? "same" : gap <= close ? "close" : "diff";
}

const AGREEMENT: Record<Agreement, { mark: string; tone: string; label: string }> = {
  same: { mark: "=", tone: "bg-onair-soft text-onair", label: "Iguales" },
  close: { mark: "≈", tone: "bg-warning-soft text-warning", label: "Parecidos" },
  diff: { mark: "≠", tone: "bg-danger-soft text-danger", label: "Distintos" },
  one: { mark: "½", tone: "bg-raised text-muted", label: "Solo una lo tiene" },
  none: { mark: "—", tone: "bg-raised text-faint", label: "Ninguna lo tiene" },
};

const VERDICT: Record<AcousticMatch["verdict"], { title: string; tone: string; bar: string }> = {
  same: { title: "Suenan idénticas: es la misma grabación", tone: "border-danger/30 bg-danger-soft", bar: "bg-danger" },
  close: { title: "Suenan muy parecido, pero no idénticas", tone: "border-warning/30 bg-warning-soft", bar: "bg-warning" },
  different: { title: "Suenan distinto: son grabaciones diferentes", tone: "border-onair/30 bg-onair-soft", bar: "bg-onair" },
};

const seconds = (value: number) => `${Math.abs(value).toFixed(1).replace(".", ",")} s`;
const clock = (value: number) => formatDuration(Math.max(0, Math.floor(value)));
const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** The print of an audio while it is read; the reading is shared and kept, so reopening the comparison is instant. */
function usePrint(audio: Blob | string | null): PrintState {
  const [state, setState] = useState<{ of: Blob | string | null; value: PrintState }>({ of: null, value: { status: "none" } });
  useEffect(() => {
    if (!audio) return;
    let live = true;
    printOf(audio).then(
      (print) => live && setState({ of: audio, value: { status: "ready", print } }),
      (error: unknown) => live && setState({ of: audio, value: { status: "error", error: error instanceof Error ? error.message : String(error) } }),
    );
    return () => {
      live = false;
    };
  }, [audio]);
  if (!audio) return { status: "none" };
  return state.of === audio ? state.value : { status: "loading" };
}

/** An address the player can open: the library one as is, a file through an object URL released when it is no longer shown. */
function usePlayable(audio: Blob | string | null): string | null {
  const [file, setFile] = useState<{ of: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!(audio instanceof Blob)) return;
    const url = URL.createObjectURL(audio);
    setFile({ of: audio, url });
    return () => URL.revokeObjectURL(url);
  }, [audio]);
  if (typeof audio === "string") return audio;
  return audio && file?.of === audio ? file.url : null;
}

/** What to do given how the two sound, their quality and whether the new one can take the library one's place. */
function adviceFor(acoustic: AcousticMatch | null | undefined, quality: { mine: number | null; theirs: number | null }, canReplace: boolean, inBatch: boolean, lengthGap: number | null): { choice: DuplicateChoice | null; title: string; text: string } | null {
  if (acoustic === undefined) return null;
  if (acoustic === null) {
    return { choice: null, title: "Decide escuchándolas", text: "No pudimos comparar su sonido (alguna es muy corta o no se pudo leer). Escúchalas con A/B en el mismo punto antes de decidir." };
  }
  const length = lengthGap !== null && Math.abs(lengthGap) > 5 ? ` Ojo: la nueva dura ${seconds(lengthGap)} ${lengthGap > 0 ? "más" : "menos"}; puede tener otro inicio o final.` : "";
  if (acoustic.verdict === "same") {
    const { mine, theirs } = quality;
    if (canReplace && mine && theirs && mine >= theirs * 1.2 && mine - theirs >= 32) {
      return {
        choice: "replace",
        title: "Recomendado: reemplazar la de la biblioteca",
        text: `Es la misma grabación y la nueva tiene mejor calidad (${mine} kbps frente a ${theirs} kbps). Al reemplazarla mejora el sonido y conserva su nombre, portada, música automática y programación.${length}`,
      };
    }
    const worse = mine && theirs && mine < theirs * 0.85 ? " La que ya tienes incluso tiene mejor calidad." : "";
    return { choice: "skip", title: "Recomendado: no subirla", text: `${inBatch ? "Es la misma grabación que otra de esta subida: con una basta." : "Es la misma grabación que ya tienes: subirla otra vez solo la duplicaría."}${worse}${length}` };
  }
  if (acoustic.verdict === "close") {
    return { choice: null, title: "Escúchalas antes de decidir", text: "Se parecen mucho, pero no son idénticas: puede ser una remasterización, otra mezcla o un archivo con cortes. Usa A/B (barra espaciadora) para oírlas en el mismo punto." };
  }
  return { choice: "both", title: "Recomendado: guardar ambas", text: "Su sonido es distinto: son grabaciones diferentes de la canción (en vivo, acústica, otra versión o un cover), no un duplicado." };
}

/** The wave of an audio with what was played, the coincidence along it and a click to jump to a moment. */
function Wave({ print, progress, side, timeline, total, onSeek }: { print: PrintState; progress: number; side: Side; timeline?: AcousticMatch["timeline"]; total: number; onSeek: (fraction: number) => void }) {
  const played = SIDE_LOOK[side].played;
  if (print.status !== "ready") {
    return (
      <div className={cn("grid h-16 place-items-center rounded-xl bg-raised text-xs font-medium", print.status === "error" ? "text-danger" : "animate-pulse text-muted")}>
        {print.status === "error" ? "No se pudo leer este audio" : print.status === "none" ? "Sin audio" : "Leyendo el audio…"}
      </div>
    );
  }
  const peaks = print.print.peaks;
  const width = peaks.length / print.print.covered;
  return (
    <div>
      <svg
        viewBox={`0 0 ${width} 48`}
        preserveAspectRatio="none"
        className="h-16 w-full cursor-pointer rounded-xl bg-raised"
        role="slider"
        aria-label="Posición del audio"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          onSeek(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)));
        }}
      >
        {Array.from(peaks, (peak, index) => {
          const height = Math.max(1.5, peak * 44);
          return <rect key={index} x={index + 0.15} y={24 - height / 2} width={0.7} height={height} className={index / width < progress ? played : "fill-line-strong"} />;
        })}
        {width > peaks.length + 1 && (
          <>
            <rect x={peaks.length} y={23.5} width={width - peaks.length} height={1} className={progress > peaks.length / width ? played : "fill-line-strong"} />
            <title>Para comparar solo descargamos el inicio; igual puedes escucharla completa.</title>
          </>
        )}
      </svg>
      {timeline && total > 0 && (
        <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-raised" title="Coincidencia del sonido a lo largo de la nueva: verde igual, ámbar parecido, rojo distinto.">
          {timeline.map((window) => (
            <span
              key={window.at}
              className={cn("absolute inset-y-0", window.score >= 0.7 ? "bg-onair" : window.score >= 0.5 ? "bg-warning" : "bg-danger")}
              style={{ left: `${(window.at / total) * 100}%`, width: `${(WINDOW_SECONDS / total) * 100}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SideCard({
  song,
  side,
  print,
  time,
  total,
  playing,
  playable,
  timeline,
  onToggle,
  onSeek,
}: {
  song: CompareSide;
  side: Side;
  print: PrintState;
  time: number;
  total: number;
  playing: boolean;
  playable: boolean;
  timeline?: AcousticMatch["timeline"];
  onToggle: () => void;
  onSeek: (fraction: number) => void;
}) {
  const look = SIDE_LOOK[side];
  return (
    <div className={cn("min-w-0 rounded-2xl border bg-surface p-4", playing ? look.ring : "border-line")}>
      <div className="flex items-start gap-3">
        {song.cover ? (
          <img src={song.cover} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-raised text-faint">
            <Music className="size-5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[0.68rem] font-semibold tracking-[0.08em] text-muted uppercase">
            <span className={cn("grid size-4 place-items-center rounded text-[0.62rem]", look.badge)}>{side.toUpperCase()}</span>
            {song.place}
          </span>
          <span className="mt-0.5 block truncate text-base font-semibold text-ink" title={song.title}>
            {song.title || "Sin nombre"}
          </span>
          <span className="block truncate text-sm text-muted">{song.credit || "Sin autor"}</span>
          {song.fileName && (
            <span className="block truncate text-xs text-faint" title={song.fileName}>
              {song.fileName}
            </span>
          )}
        </span>
      </div>
      <div className="mt-3">
        <Wave print={print} progress={total > 0 ? time / total : 0} side={side} timeline={timeline} total={total} onSeek={onSeek} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={!playable}
          title={`Tecla ${side.toUpperCase()}`}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition hover:opacity-90 disabled:opacity-50", look.badge)}
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {playing ? "Pausar" : `Escuchar ${side.toUpperCase()}`}
        </button>
        <span className="ml-auto text-xs text-muted tabular">
          {clock(time)} / {total > 0 ? clock(total) : "–:––"}
        </span>
      </div>
    </div>
  );
}

function Row({ label, mine, theirs, agreement, note }: { label: string; mine: ReactNode; theirs: ReactNode; agreement: Agreement; note?: string }) {
  const look = AGREEMENT[agreement];
  return (
    <tr className="border-t border-line align-top">
      <th scope="row" className="py-2 pr-3 text-left text-[0.7rem] font-semibold tracking-wide text-muted uppercase">
        {label}
      </th>
      <td className="py-2 pr-3 text-sm text-ink">{mine || <span className="text-faint">—</span>}</td>
      <td className="py-2 pr-3 text-sm text-ink">{theirs || <span className="text-faint">—</span>}</td>
      <td className="py-2 text-right">
        <span className={cn("inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold", look.tone)} title={note ?? look.label}>
          {look.mark}
        </span>
      </td>
    </tr>
  );
}

/** The two songs side by side, remounted for each pair so its players and analysis start fresh. */
function Comparison({ song, pair, review, decision, disabled, onChoose, onSwap }: { song: CompareSide; pair: ComparePair; review: DuplicateReview; decision: DuplicateDecision | null; disabled: boolean; onChoose: (decision: DuplicateDecision) => void; onSwap: () => void }) {
  const other = pair.other;
  const mine = usePrint(song.audio);
  const theirs = usePrint(other.audio);
  const sources = { a: usePlayable(song.audio), b: usePlayable(other.audio) };
  const playerA = useRef<HTMLAudioElement>(null);
  const playerB = useRef<HTMLAudioElement>(null);
  const players = { a: playerA, b: playerB };
  const [playing, setPlaying] = useState<Side | null>(null);
  const [times, setTimes] = useState({ a: 0, b: 0 });

  const acoustic = useMemo(
    () =>
      mine.status === "ready" && theirs.status === "ready"
        ? compareAudio(mine.print, theirs.print)
        : mine.status === "error" || theirs.status === "error" || mine.status === "none" || theirs.status === "none"
          ? null
          : undefined,
    [mine, theirs],
  );
  const lengthOf = (side: Side) => {
    const print = side === "a" ? mine : theirs;
    const data = side === "a" ? song : other;
    const element = players[side].current;
    if (element?.duration && Number.isFinite(element.duration)) return element.duration;
    return print.status === "ready" ? print.print.seconds : (data.duration ?? 0);
  };
  const secondsOf = (print: PrintState, data: CompareSide) => data.duration ?? (print.status === "ready" ? print.print.seconds : null);
  const bytesOf = (print: PrintState, data: CompareSide) => data.bytes ?? (print.status === "ready" ? print.print.bytes : null);
  const quality = { mine: mine.status === "ready" ? mine.print.kbps : null, theirs: theirs.status === "ready" ? theirs.print.kbps : null };
  const lengths = { mine: secondsOf(mine, song), theirs: secondsOf(theirs, other) };
  const lengthGap = lengths.mine !== null && lengths.theirs !== null ? lengths.mine - lengths.theirs : null;
  const loudness = { mine: mine.status === "ready" ? mine.print.loudness : null, theirs: theirs.status === "ready" ? theirs.print.loudness : null };
  const size = { mine: bytesOf(mine, song), theirs: bytesOf(theirs, other) };
  const options = decisionOptions(review);
  const canReplace = Boolean(pair.match.track) && replaceTarget(review)?.id === pair.match.track?.id;
  const advice = adviceFor(acoustic, quality, canReplace, !pair.match.track, lengthGap);
  const offset = acoustic?.offset ?? 0;
  const decibels = (value: number | null) => (value !== null ? `${value.toFixed(1).replace(".", ",")} dB` : null);

  function play(side: Side, at?: number) {
    const [me, rest] = side === "a" ? [playerA.current, playerB.current] : [playerB.current, playerA.current];
    if (!me) return;
    rest?.pause();
    if (at !== undefined) me.currentTime = Math.max(0, Math.min(at, (Number.isFinite(me.duration) ? me.duration : at) - 0.25));
    me.play().then(
      () => setPlaying(side),
      () => setPlaying(null),
    );
  }

  function toggle(side: Side) {
    if (playing === side) {
      players[side].current?.pause();
      setPlaying(null);
    } else {
      play(side);
    }
  }

  /** Jumps to the other song at the same moment of the music, so a difference is heard right away. */
  function swap() {
    if (playing === "a") play("b", (playerA.current?.currentTime ?? 0) + offset);
    else if (playing === "b") play("a", (playerB.current?.currentTime ?? 0) - offset);
    else play("a");
  }

  function seek(side: Side, fraction: number) {
    const total = lengthOf(side);
    if (!total) return;
    const player = players[side].current;
    if (playing === side || !player) play(side, fraction * total);
    else {
      player.currentTime = fraction * total;
      setTimes((now) => ({ ...now, [side]: fraction * total }));
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "a" || key === "b") {
        event.preventDefault();
        toggle(key);
      } else if (key === " ") {
        event.preventDefault();
        swap();
      } else if (/^[1-3]$/.test(key) && !disabled) {
        const option = options[Number(key) - 1];
        if (option) onChoose(decide(review, option.choice));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const audioFor = (side: Side) =>
    sources[side] ? (
      <audio
        ref={players[side]}
        src={sources[side] ?? undefined}
        preload="metadata"
        onTimeUpdate={(event) => {
          const at = event.currentTarget.currentTime;
          setTimes((now) => ({ ...now, [side]: at }));
        }}
        onPause={() => setPlaying((now) => (now === side ? null : now))}
        onEnded={() => setPlaying((now) => (now === side ? null : now))}
        hidden
      />
    ) : null;

  const reasons = pair.match.reasons.length ? pair.match.reasons.join(" · ") : null;

  return (
    <div className="space-y-4">
      {audioFor("a")}
      {audioFor("b")}

      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <SideCard song={song} side="a" print={mine} time={times.a} total={lengthOf("a")} playing={playing === "a"} playable={Boolean(sources.a)} timeline={acoustic?.timeline} onToggle={() => toggle("a")} onSeek={(fraction) => seek("a", fraction)} />
        <button
          type="button"
          onClick={swap}
          disabled={!sources.a || !sources.b}
          title="Salta a la otra canción en el mismo momento de la música (barra espaciadora)."
          className="mx-auto flex flex-col items-center gap-0.5 rounded-2xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink transition hover:border-line-strong disabled:opacity-50"
        >
          <ArrowLeftRight className="size-4" />
          A/B
          <span className="font-normal text-muted">espacio</span>
        </button>
        <SideCard song={other} side="b" print={theirs} time={times.b} total={lengthOf("b")} playing={playing === "b"} playable={Boolean(sources.b)} onToggle={() => toggle("b")} onSeek={(fraction) => seek("b", fraction)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Sus datos, campo por campo</p>
          <table className="mt-1 w-full table-fixed">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[33%]" />
              <col className="w-[33%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-[0.65rem] font-semibold tracking-[0.08em] text-muted uppercase">
                <th />
                <th className="pb-1">
                  <span className={cn("mr-1 rounded px-1", SIDE_LOOK.a.badge)}>A</span>
                  {song.place}
                </th>
                <th className="pb-1">
                  <span className={cn("mr-1 rounded px-1", SIDE_LOOK.b.badge)}>B</span>
                  {other.place}
                </th>
                <th />
              </tr>
            </thead>
            <tbody className="break-words">
              <Row label="Nombre" mine={song.title} theirs={other.title} agreement={agreeText(song.title, other.title)} />
              <Row label="Autor e invitados" mine={song.credit} theirs={other.credit} agreement={agreeList(song.credit.split(","), other.credit.split(","))} />
              <Row label="Álbum" mine={song.album} theirs={other.album} agreement={agreeText(song.album, other.album)} />
              <Row label="Año" mine={song.year} theirs={other.year} agreement={agreeNumber(song.year ? Number(song.year) : null, other.year ? Number(other.year) : null, 0, 1)} />
              <Row
                label="Duración"
                mine={lengths.mine ? clock(lengths.mine) : null}
                theirs={lengths.theirs ? clock(lengths.theirs) : null}
                agreement={agreeNumber(lengths.mine, lengths.theirs, 2, 6)}
                note={lengthGap !== null ? `Diferencia: ${seconds(lengthGap)}` : undefined}
              />
              <Row label="Géneros" mine={song.genres.join(", ")} theirs={other.genres.join(", ")} agreement={agreeList(song.genres, other.genres)} />
              <Row
                label="Calidad"
                mine={quality.mine ? `${quality.mine} kbps` : null}
                theirs={quality.theirs ? `${quality.theirs} kbps` : null}
                agreement={agreeNumber(quality.mine, quality.theirs, 16, 64)}
                note="Kilobits por segundo del archivo: a más, mejor sonido."
              />
              <Row label="Tamaño" mine={size.mine ? bytes(size.mine) : null} theirs={size.theirs ? bytes(size.theirs) : null} agreement={agreeNumber(size.mine, size.theirs, 64 * 1024, 1024 * 1024)} />
              <Row
                label="Volumen medio"
                mine={decibels(loudness.mine)}
                theirs={decibels(loudness.theirs)}
                agreement={agreeNumber(loudness.mine, loudness.theirs, 1.5, 4)}
                note="Nivel promedio de la señal; una diferencia grande suele ser otra masterización."
              />
            </tbody>
          </table>
          {reasons && <p className="mt-2 border-t border-line pt-2 text-xs text-muted">Por qué la marcamos como repetida: {reasons}.</p>}
          {pair.match.reasons.includes("nombre y autor al revés") && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-ink">
              <span className="min-w-0 flex-1">
                El nombre y el autor de la nueva están al revés: «{song.title}» es el autor y «{song.credit}» la canción.
              </span>
              <Button size="sm" variant="secondary" icon={<ArrowLeftRight className="size-3.5" />} onClick={onSwap} disabled={disabled}>
                Intercambiarlos
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className={cn("rounded-2xl border px-4 py-3 text-ink", acoustic ? VERDICT[acoustic.verdict].tone : "border-line bg-surface")}>
            <p className="text-xs font-semibold tracking-[0.08em] uppercase opacity-70">Comparación del sonido</p>
            {acoustic === undefined ? (
              <div className="mt-2 space-y-2">
                <p className="animate-pulse text-sm font-medium">Analizando el sonido de las dos…</p>
                <p className="text-xs text-muted">
                  {mine.status === "ready" ? "A leída" : "Leyendo A…"} · {theirs.status === "ready" ? "B leída" : other.audio instanceof Blob ? "Leyendo B…" : "Descargando B de la biblioteca…"}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-raised">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-line-strong" />
                </div>
              </div>
            ) : acoustic === null ? (
              <p className="mt-2 text-sm">{mine.status === "error" || theirs.status === "error" ? "No se pudo leer alguno de los audios para compararlos." : "Alguna es demasiado corta o no tiene audio para comparar su sonido."}</p>
            ) : (
              <div className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-3xl font-semibold tabular">{Math.round(acoustic.score * 100)}%</span>
                  <span className="text-sm font-medium">{VERDICT[acoustic.verdict].title}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                  <div className={cn("h-full rounded-full", VERDICT[acoustic.verdict].bar)} style={{ width: `${Math.max(3, Math.round(acoustic.score * 100))}%` }} />
                </div>
                <ul className="mt-2 space-y-0.5 text-xs opacity-85">
                  <li>
                    Comparamos {clock(acoustic.overlap)} de audio alineado.
                    {Math.abs(acoustic.offset) < 0.3 ? " Empiezan en el mismo punto." : ` ${acoustic.offset > 0 ? "B" : "A"} tiene ${seconds(acoustic.offset)} más de inicio; el A/B ya lo compensa.`}
                  </li>
                  <li>La franja bajo la onda de A muestra dónde coinciden: verde igual, ámbar parecido, rojo distinto.</li>
                  {pair.match.verdict !== "same" && acoustic.verdict === "same" && <li className="font-semibold">Aunque sus datos no coinciden del todo, el sonido es el mismo: es la misma grabación con otros datos.</li>}
                  {pair.match.verdict === "same" && acoustic.verdict === "different" && (
                    <li className="font-semibold">Sus datos dicen que es la misma canción, pero el sonido no: seguramente es otra versión (en vivo, acústica, otra mezcla) o un archivo mal etiquetado.</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {advice && (
            <div className="rounded-2xl border border-line bg-raised px-4 py-3">
              <p className="text-sm font-semibold text-ink">{advice.title}</p>
              <p className="mt-0.5 text-xs text-muted">{advice.text}</p>
            </div>
          )}

          <DecisionOptions review={review} decision={decision} disabled={disabled} suggested={advice?.choice} numbered onChoose={onChoose} />
        </div>
      </div>
    </div>
  );
}

/**
 * Both songs side by side to settle whether a new song is one already in the library (or elsewhere in the upload):
 * their data field by field, their waves, A/B listening at the same moment of the music and an acoustic comparison
 * that tells the very same recording from another version, with a recommendation and the three choices.
 */
export function CompareDialog({
  song,
  pairs,
  review,
  decision,
  disabled,
  position,
  onStep,
  onChoose,
  onSwap,
  onClose,
}: {
  song: CompareSide;
  pairs: ComparePair[];
  review: DuplicateReview;
  decision: DuplicateDecision | null;
  disabled: boolean;
  /** Where this song is among the repeated ones of the upload, and how many still wait for a choice. */
  position: { index: number; total: number; pending: number };
  onStep: (direction: -1 | 1) => void;
  onChoose: (decision: DuplicateDecision) => void;
  /** Swaps the name and the author of the new song, when they came the other way round. */
  onSwap: () => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const pair = pairs[Math.min(selected, pairs.length - 1)];
  const chosen = choiceOf(review, decision);

  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft" && position.total > 1) onStep(-1);
      else if (event.key === "ArrowRight" && position.total > 1) onStep(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep, position.total]);

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-black/60 backdrop-blur-sm sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Comparar canciones repetidas" onClick={onClose}>
      <div className="w-full max-w-6xl rounded-t-3xl border border-line bg-canvas p-5 text-ink shadow-2xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-semibold tracking-[0.1em] text-muted uppercase">
              Repetida {position.index + 1} de {position.total}
              {position.pending ? ` · ${position.pending === 1 ? "falta decidir 1" : `faltan decidir ${position.pending}`}` : " · ya decidiste todas"}
              {chosen && " · ya elegiste en esta"}
            </p>
            <h2 className="truncate text-lg font-semibold">¿Es la misma canción? Compáralas juntas</h2>
          </div>
          {position.total > 1 && (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="secondary" icon={<ArrowLeft className="size-3.5" />} onClick={() => onStep(-1)} title="Anterior (←)">
                Anterior
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onStep(1)} title="Siguiente (→)">
                Siguiente <ArrowRight className="size-3.5" />
              </Button>
            </div>
          )}
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Cerrar (Esc)" title="Cerrar (Esc)">
            <X className="size-5" />
          </Button>
        </div>

        {pairs.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Canciones con las que podría estar repetida">
            {pairs.map((entry, index) => (
              <button
                key={entry.other.key}
                type="button"
                role="tab"
                aria-selected={entry === pair}
                onClick={() => setSelected(index)}
                className={cn("max-w-xs truncate rounded-full px-3 py-1 text-xs font-medium transition", entry === pair ? "bg-primary text-on-primary" : "bg-raised text-ink hover:bg-surface")}
              >
                {entry.match.verdict === "same" ? "Misma" : "Posible"} · «{entry.other.title}» · {entry.other.place.toLowerCase()}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4">
          {pair ? (
            <Comparison key={`${song.key}|${pair.other.key}`} song={song} pair={pair} review={review} decision={decision} disabled={disabled} onChoose={onChoose} onSwap={onSwap} />
          ) : (
            <p className="rounded-2xl bg-raised px-4 py-6 text-center text-sm text-muted">Esta canción ya no tiene con qué compararse.</p>
          )}
        </div>

        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
          Atajos: <kbd className="font-semibold">A</kbd> / <kbd className="font-semibold">B</kbd> escuchar · <kbd className="font-semibold">Espacio</kbd> saltar a la otra en el mismo punto · <kbd className="font-semibold">1</kbd>{" "}
          <kbd className="font-semibold">2</kbd> <kbd className="font-semibold">3</kbd> decidir
          {position.total > 1 && (
            <>
              {" "}
              · <kbd className="font-semibold">←</kbd> <kbd className="font-semibold">→</kbd> anterior o siguiente
            </>
          )}{" "}
          · <kbd className="font-semibold">Esc</kbd> cerrar
        </p>
      </div>
    </div>,
    document.body,
  );
}
