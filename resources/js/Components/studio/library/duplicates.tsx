import { ArrowLeftRight, Music, Pause, Play } from "lucide-react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { cn } from "@/lib/cn";
import { duration as formatDuration } from "@/lib/format";
import { http } from "@/lib/http";
import type { DuplicateMatch, Identity } from "@/types/media";

/** Not reviewed yet (null), reviewed (the matches, maybe none) or the review could not be done. */
export type DuplicateReview = DuplicateMatch[] | null | "error";

/** What the user decided for a song that repeats another: leave it out, put its audio in place of the library one, or keep both. */
export type DuplicateChoice = "skip" | "replace" | "both";

/** A choice holds for the songs it was made about: if the repeated songs change, the user decides again. */
export interface DuplicateDecision {
  choice: DuplicateChoice;
  about: string;
}

export interface SongToReview {
  key: string;
  title: string;
  artist: string;
  featured: string[];
  album: string;
  year: string;
  duration: number | null;
  identity: Identity | null;
}

/**
 * Asks which of the `judge` songs repeat a song of the library or an earlier song of the same upload; the others only
 * count as earlier songs. Null when it could not ask.
 */
export async function reviewDuplicates(url: string, songs: SongToReview[], judge: string[]): Promise<Record<string, DuplicateMatch[]> | null> {
  const list = songs.map((song) => ({
    key: song.key,
    title: song.title.trim(),
    artist: song.artist.trim() || null,
    featured: song.featured.map((name) => name.trim()).filter(Boolean),
    album: song.album.trim() || null,
    year: song.year.length === 4 ? Number(song.year) : null,
    duration: song.duration || null,
    ids: song.identity?.ids ?? null,
  }));
  const response = await http.post<{ results: Record<string, DuplicateMatch[]> }>(url, { songs: list, judge }).catch(() => null);
  return response ? response.results : null;
}

const matchesOf = (review: DuplicateReview) => (Array.isArray(review) ? review : []);

/** Matches that may be the same song (not just another version of it): the user has to decide on them. */
export const concerns = (review: DuplicateReview) => matchesOf(review).filter((match) => match.verdict !== "version");

/** The songs a decision is about: `t:` a library song by its id, `b:` a song of the upload by its key. */
export const concernKey = (review: DuplicateReview) =>
  concerns(review)
    .map((match) => (match.track ? `t:${match.track.id}` : `b:${match.batch}`))
    .join("|");

/** Whether the song may be a duplicate, so it is not saved until the user says what to do with it. */
export function needsDecision(review: DuplicateReview) {
  return concerns(review).length > 0;
}

/** The library song whose audio this one would replace: the closest one that may be the same song. */
export function replaceTarget(review: DuplicateReview) {
  return concerns(review).find((match) => match.track)?.track ?? null;
}

/** The user's choice for the song as it is reviewed now, or null when there is nothing to decide or it was not decided yet. */
export function choiceOf(review: DuplicateReview, decision: DuplicateDecision | null): DuplicateChoice | null {
  if (!decision || !needsDecision(review) || decision.about !== concernKey(review)) return null;
  if (decision.choice === "replace" && !replaceTarget(review)) return null;
  return decision.choice;
}

/** A possible duplicate still waiting for the user's choice. */
export function isPending(review: DuplicateReview, decision: DuplicateDecision | null) {
  return needsDecision(review) && choiceOf(review, decision) === null;
}

export function decide(review: DuplicateReview, choice: DuplicateChoice): DuplicateDecision {
  return { choice, about: concernKey(review) };
}

/** What the user can do with a song that may repeat another; replacing only when it repeats a library song. */
export function decisionOptions(review: DuplicateReview): { choice: DuplicateChoice; title: string; hint: string }[] {
  const target = replaceTarget(review);
  const inBatch = concerns(review).every((match) => match.batch);
  return [
    { choice: "skip", title: "No subirla", hint: inBatch ? "Se guarda solo la otra de esta subida." : "Te quedas con la que ya está en la biblioteca." },
    ...(target
      ? [{ choice: "replace" as const, title: "Reemplazar la de la biblioteca", hint: `Este audio toma el lugar de «${target.title}»: conserva su nombre, portada, géneros, música automática y programación.` }]
      : []),
    { choice: "both", title: "Guardar ambas", hint: "Quedan las dos en la biblioteca, como canciones aparte." },
  ];
}

/** What the player calls a match when it is being listened to: the library song, or the song of the upload by its key. */
export const listenKey = (match: DuplicateMatch) => (match.track ? `track:${match.track.id}` : (match.batch ?? ""));

/** How a card is shaded: songs that may repeat another stand out until the user decides, and then show the decision. */
export function duplicateShade(review: DuplicateReview, decision: DuplicateDecision | null): string | null {
  const [first] = matchesOf(review);
  if (!first) return null;
  if (!needsDecision(review)) return "border-info/30 bg-info-soft/30";
  const choice = choiceOf(review, decision);
  if (choice === "skip") return "border-line bg-raised opacity-75";
  if (choice === "replace") return "border-info/40 bg-info-soft/40";
  if (choice === "both") return "border-onair/40 bg-onair-soft/30";
  return concerns(review).some((match) => match.verdict === "same") ? "border-danger/50 bg-danger-soft/40 ring-2 ring-danger/20" : "border-warning/50 bg-warning-soft/40 ring-2 ring-warning/20";
}

const CHOSEN: Record<DuplicateChoice, { text: string; tone: "neutral" | "info" | "onair" }> = {
  skip: { text: "No se subirá", tone: "neutral" },
  replace: { text: "Reemplazará la de la biblioteca", tone: "info" },
  both: { text: "Se guardarán ambas", tone: "onair" },
};

export function DuplicateBadge({ review, decision }: { review: DuplicateReview; decision: DuplicateDecision | null }) {
  if (review === null) return null;
  if (review === "error") {
    return (
      <span title="No pudimos compararla con la biblioteca. Al subirla, el servidor igual revisa que no esté repetida.">
        <Badge>No se pudo revisar si está repetida</Badge>
      </span>
    );
  }
  const [first] = review;
  if (!first) return <Badge tone="onair">No está repetida</Badge>;
  const choice = choiceOf(review, decision);
  if (choice) return <Badge tone={CHOSEN[choice].tone}>{CHOSEN[choice].text}</Badge>;
  const here = first.batch ? "en esta subida" : "en la biblioteca";
  if (first.verdict === "same") return <Badge tone="danger">{first.batch ? "Repetida en esta subida" : "Ya está en la biblioteca"} · elige qué hacer</Badge>;
  if (first.verdict === "possible") return <Badge tone="warning">Posible repetida {here} · elige qué hacer</Badge>;
  return <Badge tone="info">Otra versión {here}</Badge>;
}

function ListenButton({ active, onClick, label, title }: { active: boolean; onClick: () => void; label: string; title?: string }) {
  return (
    <Button size="sm" variant={active ? "primary" : "secondary"} icon={active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} onClick={onClick} title={title}>
      {active ? "Detener" : label}
    </Button>
  );
}

/** The library song a new one may repeat, shown right above it so both can be compared one after the other. */
export function LibraryTwin({ match, playing, onListen }: { match: DuplicateMatch; playing: string | null; onListen: (match: DuplicateMatch) => void }) {
  const track = match.track;
  if (!track) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-raised/60 px-4 py-2.5">
      {track.cover_url ? (
        <img src={track.cover_url} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-surface text-faint">
          <Music className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.68rem] font-semibold tracking-[0.08em] text-muted uppercase">Ya está en la biblioteca</span>
        <span className="block truncate text-sm font-medium">
          {track.title}
          {track.artist && <span className="font-normal text-muted"> · {track.artist}</span>}
        </span>
        <span className="block truncate text-xs text-muted">{[track.album, track.year, track.duration ? formatDuration(track.duration) : null].filter(Boolean).join(" · ") || "Sin álbum ni año"}</span>
      </span>
      {track.audio_url && <ListenButton active={playing === listenKey(match)} onClick={() => onListen(match)} label="Escuchar" />}
    </div>
  );
}

const VERDICT: Record<DuplicateMatch["verdict"], { tone: string; library: string; batch: string; label: string }> = {
  same: {
    tone: "border-danger/30 bg-surface",
    library: "Veredicto: es la misma canción que ya tienes en la biblioteca.",
    batch: "Veredicto: es la misma canción que otra de esta subida.",
    label: "Misma canción",
  },
  possible: {
    tone: "border-warning/30 bg-surface",
    library: "Veredicto: podría ser la misma canción que una de la biblioteca. Escúchalas para comparar.",
    batch: "Veredicto: podría ser la misma canción que otra de esta subida. Escúchalas para comparar.",
    label: "Posible repetida",
  },
  version: {
    tone: "border-info/30 bg-surface",
    library: "Veredicto: es otra versión de una canción que ya tienes, no un duplicado. Se subirá.",
    batch: "Veredicto: es otra versión de una canción de esta subida, no un duplicado. Se subirán las dos.",
    label: "Otra versión",
  },
};

/** The choices for a song that may repeat another, as radio cards. */
export function DecisionOptions({ review, decision, disabled, suggested, numbered = false, onChoose }: { review: DuplicateReview; decision: DuplicateDecision | null; disabled: boolean; suggested?: DuplicateChoice | null; numbered?: boolean; onChoose: (decision: DuplicateDecision) => void }) {
  const options = decisionOptions(review);
  const choice = choiceOf(review, decision);
  return (
    <div className={cn("grid gap-2", !numbered && (options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"))} role="radiogroup" aria-label="Qué hacer con esta canción repetida">
      {options.map((option, index) => {
        const active = choice === option.choice;
        const recommended = suggested === option.choice && !active;
        return (
          <button
            key={option.choice}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChoose(decide(review, option.choice))}
            className={cn(
              "rounded-xl border px-3 py-2 text-left transition disabled:opacity-60",
              active ? "border-ink bg-primary text-on-primary" : recommended ? "border-onair/60 bg-onair-soft text-ink ring-1 ring-onair/30" : "border-line bg-surface text-ink hover:border-line-strong",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {numbered ? (
                <kbd className={cn("grid size-5 shrink-0 place-items-center rounded border text-[0.65rem]", active ? "border-on-primary/50" : "border-line-strong")}>{index + 1}</kbd>
              ) : (
                <span className={cn("grid size-3.5 shrink-0 place-items-center rounded-full border", active ? "border-on-primary" : "border-line-strong")}>{active && <span className="size-1.5 rounded-full bg-on-primary" />}</span>
              )}
              {option.title}
              {recommended && <span className="ml-auto rounded-full bg-onair px-2 py-0.5 text-[0.62rem] font-semibold tracking-wide text-white uppercase">Recomendado</span>}
              {active && numbered && <span className="ml-auto text-[0.62rem] font-semibold tracking-wide uppercase opacity-80">Tu decisión</span>}
            </span>
            <span className={cn("mt-0.5 block text-xs", active ? "opacity-80" : "text-muted")}>{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The verdict on a song that repeats another, the songs it repeats with their reasons, and the user's choice. */
export function DuplicatePanel({
  review,
  decision,
  disabled,
  nameOf,
  playing,
  onListen,
  onChoose,
  onCompare,
}: {
  review: DuplicateReview;
  decision: DuplicateDecision | null;
  disabled: boolean;
  /** How an earlier song of the same upload is called, by its key. */
  nameOf: (key: string) => string;
  /** What the player is playing now, to show which song is being heard. */
  playing: string | null;
  onListen: (match: DuplicateMatch) => void;
  onChoose: (decision: DuplicateDecision) => void;
  /** Opens both songs side by side. */
  onCompare: () => void;
}) {
  const matches = matchesOf(review);
  const [first] = matches;
  if (!first) return null;
  const verdict = VERDICT[first.verdict];
  const choice = choiceOf(review, decision);

  return (
    <div className={cn("rounded-xl border px-3 py-2.5 text-sm", verdict.tone)} role="status">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 font-medium">{first.batch ? verdict.batch : verdict.library}</p>
        {needsDecision(review) && (
          <Button size="sm" icon={<ArrowLeftRight className="size-3.5" />} onClick={onCompare} title="Abre las dos canciones juntas: sus datos campo por campo, sus ondas, escucha A/B en el mismo punto y la comparación de su sonido.">
            Comparar lado a lado
          </Button>
        )}
      </div>
      <ul className="mt-2 space-y-2">
        {matches.map((match, index) => {
          const key = listenKey(match);
          const canListen = match.track ? Boolean(match.track.audio_url) : Boolean(match.batch);
          return (
            <li key={key || index} className="flex items-start gap-2.5">
              {match.track?.cover_url && <img src={match.track.cover_url} alt="" className="mt-0.5 size-9 shrink-0 rounded-md object-cover" />}
              <span className="min-w-0 flex-1">
                <span className="font-medium">
                  {VERDICT[match.verdict].label}:{" "}
                  {match.track
                    ? `«${match.track.title}»${match.track.artist ? ` de ${match.track.artist}` : ""}${[match.track.album, match.track.year, match.track.duration ? formatDuration(match.track.duration) : null]
                        .filter(Boolean)
                        .map((part) => ` · ${part}`)
                        .join("")}`
                    : `${nameOf(match.batch ?? "")}, en esta subida`}
                </span>
                <span className="block text-xs text-muted">{match.reasons.join(" · ")}</span>
              </span>
              {canListen && (
                <ListenButton
                  active={playing === key}
                  onClick={() => onListen(match)}
                  label={match.track ? "Escuchar la de la biblioteca" : "Escuchar la otra"}
                  title={match.track ? "Escucha la que ya está en la biblioteca para compararla con la nueva." : "Escucha la otra canción de esta subida para compararlas."}
                />
              )}
            </li>
          );
        })}
      </ul>

      {needsDecision(review) && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{choice ? "Tu decisión" : "¿Qué hacemos con esta canción? Apenas elijas, la subida sigue con ella"}</p>
          <DecisionOptions review={review} decision={decision} disabled={disabled} onChoose={onChoose} />
        </div>
      )}
    </div>
  );
}
