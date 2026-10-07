import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Music, Trash2, Upload } from "lucide-react";
import type { DragEvent } from "react";
import { useRef, useState } from "react";
import { ProgressBar } from "@/Components/studio/upload/progress-bar";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Select } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import { bytes, duration as formatDuration } from "@/lib/format";
import { http, HttpError } from "@/lib/http";
import { readTags } from "@/lib/media/audio-tags";
import { probeDuration } from "@/lib/media/duration";
import { fieldErrors } from "@/lib/media/errors";
import { appendField, sendAudio } from "@/lib/media/upload";
import type { DuplicateResult, GenreBrief, Identification, LibraryLimits, Option, TrackKind } from "@/types/media";
import { applyIdentification, draftForm, emptyDraft, type TrackDraft } from "./track-draft";
import { TrackFields } from "./track-fields";

type Status = "preparing" | "ready" | "uploading" | "done" | "failed";

interface Item {
  key: string;
  file: File;
  oversized: boolean;
  duration: number | null;
  draft: TrackDraft;
  status: Status;
  progress: number;
  error: string | null;
  errors: Record<string, string>;
  duplicates: DuplicateResult | null;
  allowDuplicate: boolean;
}

interface Props {
  open: boolean;
  initialKind: TrackKind;
  kinds: Option<TrackKind>[];
  genres: GenreBrief[];
  families: Option[];
  limits: LibraryLimits;
  onClose: () => void;
  onUploaded: () => void;
}

const VERDICTS = { same: "Ya está en la biblioteca", version: "Otra versión en la biblioteca", possible: "Posible repetido" } as const;

/**
 * Upload of many audios at once: each file is read in the browser (tags, cover, duration),
 * songs are identified on the music catalogs, repeated audios are flagged, and everything can be
 * reviewed before the files go up one by one.
 */
export function UploadQueue({ open, initialKind, kinds, genres, families, limits, onClose, onUploaded }: Props) {
  const url = useStudioUrl();
  const [kind, setKind] = useState<TrackKind>(initialKind);
  const [items, setItems] = useState<Item[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const sequence = useRef(0);

  const patch = (key: string, change: Partial<Item> | ((item: Item) => Partial<Item>)) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...(typeof change === "function" ? change(item) : change) } : item)));

  const checkDuplicates = async (list: Item[]) => {
    if (list.length === 0) return;
    const response = await http
      .post<{ results: Record<string, DuplicateResult> }>(url("/biblioteca/duplicados"), {
        items: list.map((item) => ({ key: item.key, kind: item.draft.kind, title: item.draft.title || item.file.name, artist: item.draft.artist || null, duration: item.duration })),
      })
      .catch(() => null);
    if (!response) return;
    setItems((current) => current.map((item) => (response.results[item.key] ? { ...item, duplicates: response.results[item.key] } : item)));
  };

  const prepare = async (item: Item, genreHint: string | undefined) => {
    let draft = item.draft;
    if (draft.kind === "song" && draft.title) {
      const found = await http
        .post<Identification>(url("/biblioteca/identificar"), { title: draft.title, artist: draft.artist || null, duration: item.duration, genre: genreHint ?? null })
        .catch(() => null);
      if (found) draft = applyIdentification(draft, found, limits.max_genres);
    }
    const ready = { ...item, draft, status: "ready" as const };
    patch(item.key, { draft, status: "ready" });
    return ready;
  };

  const add = async (files: File[]) => {
    const accepted = files.filter((file) => limits.types.includes(file.name.split(".").pop()?.toLowerCase() ?? ""));
    const rejected = files.length - accepted.length;
    setNotice(rejected > 0 ? `${rejected === 1 ? "Un archivo no es" : `${rejected} archivos no son`} de un formato compatible (${limits.types.join(", ")}).` : null);
    const fresh: Item[] = accepted.map((file) => {
      const oversized = file.size > limits.max_mb * 1024 * 1024;
      return {
        key: `f${++sequence.current}`,
        file,
        oversized,
        duration: null,
        draft: emptyDraft(kind),
        status: "preparing",
        progress: 0,
        error: oversized ? `El archivo pesa más de ${limits.max_mb} MB.` : null,
        errors: {},
        duplicates: null,
        allowDuplicate: false,
      };
    });
    setItems((current) => [...current, ...fresh]);

    const prepared: Item[] = [];
    for (const item of fresh) {
      const [tags, seconds] = await Promise.all([readTags(item.file).catch(() => ({}) as Awaited<ReturnType<typeof readTags>>), probeDuration(item.file)]);
      const draft: TrackDraft = {
        ...item.draft,
        title: tags.title ?? "",
        artist: tags.artist ?? "",
        album: tags.album ?? "",
        year: tags.year ? String(tags.year) : "",
        cover: tags.picture ?? null,
      };
      const withTags = { ...item, draft, duration: seconds, error: item.error ?? (seconds === null ? "No pudimos leer la duración: el archivo puede estar dañado." : null) };
      patch(item.key, { draft, duration: seconds, error: withTags.error });
      prepared.push(await prepare(withTags, tags.genre));
    }
    await checkDuplicates(prepared);
  };

  const upload = async () => {
    const pending = items.filter((item) => (item.status === "ready" || item.status === "failed") && !blocked(item));
    if (pending.length === 0) return;
    setRunning(true);
    abort.current = new AbortController();
    let uploaded = 0;
    for (const item of pending) {
      if (abort.current.signal.aborted) break;
      patch(item.key, { status: "uploading", progress: 0, error: null, errors: {} });
      const fields = draftForm(item.draft, item.duration);
      appendField(fields, "duplicate_ok", item.allowDuplicate);
      try {
        await sendAudio({
          url: url("/biblioteca"),
          uploadsUrl: url("/biblioteca/subidas"),
          fields,
          file: item.file,
          kind: item.draft.kind,
          direct: limits.direct,
          signal: abort.current.signal,
          onProgress: (progress) => patch(item.key, { progress }),
        });
        uploaded++;
        patch(item.key, { status: "done", progress: 1 });
      } catch (error) {
        const { fields: invalid, message } = fieldErrors(error);
        const duplicate = error instanceof HttpError && error.status === 409;
        patch(item.key, {
          status: "failed",
          error: message,
          errors: invalid,
          duplicates: duplicate ? { matches: (error.body.duplicates as DuplicateResult["matches"]) ?? [], batch: null } : item.duplicates,
        });
        if (Object.keys(invalid).length) setExpanded(item.key);
      }
    }
    setRunning(false);
    if (uploaded > 0) onUploaded();
  };

  const close = () => {
    if (running) {
      if (!window.confirm("Hay audios subiéndose. ¿Cancelar la subida?")) return;
      abort.current?.abort();
    }
    setItems([]);
    setExpanded(null);
    onClose();
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!running) void add(Array.from(event.dataTransfer.files));
  };

  const waiting = items.filter((item) => (item.status === "ready" || item.status === "failed") && !blocked(item)).length;
  const preparing = items.some((item) => item.status === "preparing");

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title="Subir audios"
      description={`Formatos ${limits.types.join(", ").toUpperCase()} · hasta ${limits.max_mb} MB y ${Math.round(limits.max_duration / 3600)} h por archivo.`}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {items.length && items.every((item) => item.status === "done") ? "Listo" : "Cancelar"}
          </Button>
          <Button icon={<Upload className="size-4" />} loading={running} disabled={waiting === 0 || preparing} onClick={upload}>
            {waiting === 1 ? "Subir 1 audio" : `Subir ${waiting} audios`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn("flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition", dragging ? "border-signal bg-signal-soft" : "border-line-strong")}
        >
          <Music className="size-8 text-faint" />
          <p className="text-sm text-muted">Arrastra aquí tus archivos o elígelos desde tu equipo.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Select value={kind} onChange={(event) => setKind(event.target.value as TrackKind)} className="w-auto" aria-label="Tipo de los audios nuevos" disabled={running}>
              {kinds.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <label className={cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90", running && "pointer-events-none opacity-50")}>
              <Upload className="size-4" /> Elegir archivos
              <input
                type="file"
                multiple
                accept={limits.types.map((type) => `.${type}`).join(",")}
                className="sr-only"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  void add(files);
                }}
              />
            </label>
          </div>
        </div>

        {notice && <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">{notice}</p>}

        {items.length > 0 && (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {items.map((item) => (
              <li key={item.key} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <StatusIcon item={item} />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setExpanded(expanded === item.key ? null : item.key)} disabled={item.status === "done" || item.status === "uploading"}>
                    <p className="truncate text-sm font-medium">{item.draft.title || item.file.name}</p>
                    <p className="truncate text-xs text-muted">
                      {[item.draft.artist, kinds.find((option) => option.value === item.draft.kind)?.label, item.duration ? formatDuration(item.duration) : null, bytes(item.file.size)].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                  {item.draft.identity && <Badge tone={item.draft.identity.confidence === "high" ? "onair" : "info"}>Identificada</Badge>}
                  {duplicateVerdict(item) && <Badge tone={duplicateVerdict(item) === "same" ? "danger" : "warning"}>{VERDICTS[duplicateVerdict(item)!]}</Badge>}
                  {item.status !== "done" && item.status !== "uploading" && (
                    <>
                      <Button size="icon" variant="ghost" aria-label="Editar datos" onClick={() => setExpanded(expanded === item.key ? null : item.key)}>
                        <ChevronDown className={cn("size-4 transition", expanded === item.key && "rotate-180")} />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Quitar de la lista" disabled={running} onClick={() => setItems((current) => current.filter((other) => other.key !== item.key))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>

                {item.status === "uploading" && <ProgressBar value={item.progress} className="mt-2" />}
                {item.error && <p className="mt-2 text-xs text-danger">{item.error}</p>}

                {duplicateVerdict(item) && item.status !== "done" && (
                  <div className="mt-2 rounded-xl bg-raised px-3 py-2 text-xs text-muted">
                    {item.duplicates?.matches.slice(0, 3).map((match) => (
                      <p key={match.id}>
                        «{match.title}»{match.artist ? ` · ${match.artist}` : ""} · {formatDuration(match.duration)}
                      </p>
                    ))}
                    {item.duplicates?.batch && <p>Este archivo se repite en la lista que estás subiendo.</p>}
                    <label className="mt-1.5 inline-flex items-center gap-2 text-ink">
                      <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={item.allowDuplicate} onChange={(event) => patch(item.key, { allowDuplicate: event.target.checked })} />
                      Subirlo de todos modos
                    </label>
                  </div>
                )}

                {expanded === item.key && item.status !== "done" && (
                  <div className="mt-4 border-t border-line pt-4">
                    <TrackFields
                      draft={item.draft}
                      onChange={(draft) => patch(item.key, { draft })}
                      kinds={kinds}
                      genres={genres}
                      families={families}
                      limits={limits}
                      errors={item.errors}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function duplicateVerdict(item: Item) {
  if (!item.duplicates) return null;
  return item.duplicates.matches[0]?.verdict ?? item.duplicates.batch?.verdict ?? null;
}

/** Same audio already in the library (or twice in the batch) waits for an explicit confirmation. */
function blocked(item: Item) {
  return (duplicateVerdict(item) === "same" && !item.allowDuplicate) || item.duration === null || item.oversized;
}

function StatusIcon({ item }: { item: Item }) {
  if (item.status === "preparing" || item.status === "uploading") return <Loader2 className="size-4 shrink-0 animate-spin text-signal" />;
  if (item.status === "done") return <CheckCircle2 className="size-4 shrink-0 text-onair" />;
  if (item.status === "failed" || blocked(item)) return <AlertTriangle className="size-4 shrink-0 text-warning" />;
  return <Music className="size-4 shrink-0 text-muted" />;
}
