import { ArrowLeftRight, ImagePlus, Loader2, Pause, Play, RotateCcw, Search, X } from "lucide-react";
import { useRef } from "react";
import { ProgressBar } from "@/Components/studio/upload/progress-bar";
import { Badge, type Tone } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import { bytes, duration as formatDuration } from "@/lib/format";
import type { DuplicateMatch, GenreBrief, LibraryLimits, Option, TrackKind } from "@/types/media";
import { DuplicateBadge, DuplicatePanel, duplicateShade } from "./duplicates";
import { GenrePicker } from "./genre-picker";
import { NamesInput } from "./names-input";
import { cleanYear, LookupBadge } from "./song-tools";
import { duckFor, missing, type DetailsSource, type Phase, type Upload } from "./upload-queue";

const COVER_ACCEPT = "image/jpeg,image/png,image/webp";

const SOURCE: Record<DetailsSource, { text: string; tone: Tone; hint: string }> = {
  tags: { text: "Reconocida del archivo", tone: "onair", hint: "Los datos vienen de las etiquetas del archivo. Revísalos si quieres." },
  name: { text: "Tomada del nombre del archivo", tone: "warning", hint: "El archivo no traía etiquetas: el nombre y el autor salen del nombre del archivo. Revísalos." },
  none: { text: "Sin datos en el archivo", tone: "neutral", hint: "No encontramos el nombre ni el autor: complétalos." },
};

/** Where the card stands, when its other badges do not say it already. */
const PHASE_BADGE: Partial<Record<Phase, { text: string; tone: Tone }>> = {
  checking: { text: "Revisando si está repetida…", tone: "info" },
  blocked: { text: "No se pudo subir", tone: "danger" },
  incomplete: { text: "Faltan datos", tone: "warning" },
};

interface Props {
  item: Upload;
  phase: Phase;
  auto: boolean;
  /** Shown inside a group of songs that may repeat each other. */
  grouped: boolean;
  /** Just reached from the summary: it stands out for a moment. */
  flash: boolean;
  kinds: Option<TrackKind>[];
  genres: GenreBrief[];
  families: Option[];
  limits: LibraryLimits;
  canEpisodes: boolean;
  previewing: boolean;
  /** What the upload's player is playing, to mark the repeated song being heard. */
  playing: string | null;
  nameOf: (key: string) => string;
  onListen: (match: DuplicateMatch) => void;
  onPatch: (values: Partial<Upload>) => void;
  onRetry: () => void;
  onLookUp: () => void;
  onCover: (file: File | null) => void;
  onPreview: () => void;
  onRemove: () => void;
  onCompare: () => void;
}

/** One audio of the upload: what was recognized, its details to review and where it is on its way to the library. */
export function UploadCard({ item, phase, auto, grouped, flash, kinds, genres, families, limits, canEpisodes, previewing, playing, nameOf, onListen, onPatch, onRetry, onLookUp, onCover, onPreview, onRemove, onCompare }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const song = item.kind === "song";
  const locked = item.status === "reading" || item.status === "uploading" || item.status === "done";
  const searching = item.lookup?.status === "searching";
  const problem = item.status === "ready" ? missing(item) : null;
  const source = song && item.source && item.status !== "reading" ? SOURCE[item.source] : null;
  const titleMissing = item.status === "ready" && !item.title.trim();
  const artistMissing = item.status === "ready" && song && !item.artist.trim();
  const yearWrong = item.status === "ready" && Boolean(item.year) && item.year.length !== 4;
  const shade = song && item.status === "ready" ? duplicateShade(item.duplicates, item.decision) : null;
  const badge = phase === "queued" ? { text: auto ? "En cola para subir" : "Lista para subir", tone: "onair" as Tone } : PHASE_BADGE[phase];
  const required = <span className="text-danger">*</span>;

  return (
    <article
      id={`subida-${item.key}`}
      className={cn(
        "scroll-mt-24 rounded-2xl border p-4 transition",
        grouped && "md:ml-4",
        flash && "ring-4 ring-signal/40",
        item.error ? "border-danger/40 bg-surface" : (shade ?? (problem ? "border-warning/50 bg-warning-soft/20" : "border-line bg-surface")),
      )}
    >
      <div className="flex gap-4">
        {song && (
          <div className="flex shrink-0 flex-col items-center gap-1">
            <button
              type="button"
              disabled={locked}
              onClick={() => picker.current?.click()}
              title={item.coverUrl ? "Cambiar portada" : "Agregar portada (JPG, PNG o WEBP)"}
              className="group relative grid size-20 place-items-center overflow-hidden rounded-xl border border-line bg-raised text-faint transition hover:border-line-strong"
            >
              {item.coverUrl ? <img src={item.coverUrl} alt="" className="size-full object-cover" /> : <ImagePlus className="size-6" />}
              <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[0.65rem] font-medium text-white opacity-0 transition group-hover:opacity-100">{item.coverUrl ? "Cambiar" : "Portada"}</span>
            </button>
            {item.coverUrl && !locked && (
              <button type="button" onClick={() => onCover(null)} className="text-[0.68rem] font-medium text-muted hover:text-danger">
                Quitar
              </button>
            )}
            <input
              ref={picker}
              type="file"
              accept={COVER_ACCEPT}
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onCover(file);
                event.target.value = "";
              }}
            />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="max-w-full min-w-0 truncate font-medium text-ink/80" title={item.file.name}>
              {item.file.name}
            </span>
            <span className="tabular">· {bytes(item.file.size)}</span>
            <span className="tabular">· {item.duration ? formatDuration(item.duration) : "--:--"}</span>
            {item.status === "reading" && (
              <Badge>
                <Loader2 className="size-3 animate-spin" /> {song ? "Reconociendo la canción…" : "Leyendo el audio…"}
              </Badge>
            )}
            {source && (
              <span title={source.hint}>
                <Badge tone={source.tone}>{source.text}</Badge>
              </span>
            )}
            {song && <LookupBadge state={item.lookup} />}
            {song && item.status === "ready" && <DuplicateBadge review={item.duplicates} decision={item.decision} />}
            {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
            <span className="ml-auto flex flex-wrap items-center gap-1">
              {song && !locked && !searching && item.title.trim().length >= 2 && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Search className="size-3.5" />}
                  onClick={onLookUp}
                  title="Vuelve a buscar la canción en internet con el nombre y el autor de ahora, y reemplaza el álbum, el año, los géneros y la portada encontrados."
                >
                  Buscar en internet
                </Button>
              )}
              {song && !locked && (item.title.trim() || item.artist.trim()) && (
                <Button size="sm" variant="secondary" icon={<ArrowLeftRight className="size-3.5" />} onClick={() => onPatch({ title: item.artist, artist: item.title })} title="Si el nombre de la canción y el autor salieron al revés, cámbialos de lugar.">
                  Intercambiar nombre y autor
                </Button>
              )}
              {item.duration !== null && (
                <Button size="sm" variant={previewing ? "primary" : "secondary"} icon={previewing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} onClick={onPreview}>
                  {previewing ? "Detener" : "Escuchar"}
                </Button>
              )}
              {item.status !== "uploading" && item.status !== "done" && (
                <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Quitar de la lista" className="size-8">
                  <X className="size-4" />
                </Button>
              )}
            </span>
          </div>

          <fieldset disabled={locked} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={<>{song ? "Nombre de la canción" : "Nombre"} {required}</>}>
                {(id) => <Input id={id} data-field="title" invalid={titleMissing} value={item.title} onChange={(event) => onPatch({ title: event.target.value })} maxLength={160} placeholder={song ? "Ej.: Pedro Navaja" : "Ej.: Cuña de la feria"} />}
              </Field>
              <Field label={song ? <>Autor {required}</> : item.kind === "program" ? "Programa o locutor (opcional)" : "Autor (opcional)"}>
                {(id) => <Input id={id} data-field="artist" invalid={artistMissing} value={item.artist} onChange={(event) => onPatch({ artist: event.target.value })} maxLength={120} placeholder={song ? "Ej.: Rubén Blades" : ""} />}
              </Field>
            </div>

            {song && (
              <>
                <Field label={`Artistas invitados (${item.featured.length}/${limits.max_featured})`} hint="Escribe un nombre y pulsa Enter.">
                  {(id) => <NamesInput id={id} value={item.featured} max={limits.max_featured} placeholder="feat." onChange={(featured) => onPatch({ featured })} />}
                </Field>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                  <Field label="Álbum (opcional)">{(id) => <Input id={id} value={item.album} onChange={(event) => onPatch({ album: event.target.value })} maxLength={160} />}</Field>
                  <Field label="Año">
                    {(id) => <Input id={id} data-field="year" invalid={yearWrong} value={item.year} onChange={(event) => onPatch({ year: cleanYear(event.target.value) })} placeholder="2024" inputMode="numeric" />}
                  </Field>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-ink">
                    Géneros <span className="font-normal text-muted">(hasta {limits.max_genres}; el primero es el principal)</span>
                  </p>
                  <GenrePicker genres={genres} families={families} value={item.genreIds} max={limits.max_genres} disabled={locked} onChange={(genreIds) => onPatch({ genreIds })} />
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-muted">
                Tipo
                <Select value={item.kind} onChange={(event) => onPatch({ kind: event.target.value as TrackKind, duck: duckFor(event.target.value as TrackKind) })} className="h-8 w-auto text-sm">
                  {kinds.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </Select>
              </label>
              <span title="Cuando suene encima de la música, la música baja para que se escuche mejor.">
                <Checkbox label="Baja la música cuando suena encima" checked={item.duck} onChange={(event) => onPatch({ duck: event.target.checked })} />
              </span>
            </div>

            {canEpisodes && (
              <div>
                <Checkbox label="Publicar también como episodio en la página de la radio" checked={item.episode} onChange={(event) => onPatch({ episode: event.target.checked })} />
                {item.episode && (
                  <div className="mt-2 grid gap-3 rounded-xl bg-raised p-3 md:grid-cols-[minmax(0,1fr)_16rem]">
                    <Field label="Descripción corta del episodio" hint={`${item.description.length}/${limits.max_description}`}>
                      {(id) => <Textarea id={id} value={item.description} onChange={(event) => onPatch({ description: event.target.value })} maxLength={limits.max_description} rows={2} className="min-h-16 resize-none" placeholder="De qué trata, en una o dos frases." />}
                    </Field>
                    <Field label="Portada del episodio (opcional)" hint={`JPG, PNG o WEBP cuadrada · hasta ${limits.max_cover_mb} MB`}>
                      {(id) => (
                        <input
                          id={id}
                          type="file"
                          accept={COVER_ACCEPT}
                          onChange={(event) => onPatch({ episodeCover: event.target.files?.[0] ?? null })}
                          className="block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface file:px-3 file:py-1 file:text-xs file:font-medium file:text-ink"
                        />
                      )}
                    </Field>
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {(item.status === "uploading" || item.status === "done") && (
            <div className="flex items-center gap-3">
              <ProgressBar value={item.progress} tone={item.status === "done" ? "onair" : "signal"} className="flex-1" />
              <span className="w-28 text-right text-xs font-medium text-muted tabular">{item.status === "done" ? "Subido" : `Subiendo ${Math.round(item.progress * 100)}%`}</span>
            </div>
          )}
          {song && item.status === "ready" && (
            <DuplicatePanel review={item.duplicates} decision={item.decision} disabled={locked} nameOf={nameOf} playing={playing} onListen={onListen} onChoose={(decision) => onPatch({ decision })} onCompare={onCompare} />
          )}
          {item.error && (
            <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-danger" role="alert">
              {item.error}
              {item.blocked && !problem && (
                <Button size="sm" variant="secondary" icon={<RotateCcw className="size-3.5" />} onClick={onRetry}>
                  Reintentar
                </Button>
              )}
            </p>
          )}
          {problem && <p className="text-xs font-medium text-warning">{problem}</p>}
        </div>
      </div>
    </article>
  );
}
