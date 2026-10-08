import { Link } from "@inertiajs/react";
import { ArrowLeftRight, CheckCircle2, Music, Pause, Upload as UploadIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ProgressBar } from "@/Components/studio/upload/progress-bar";
import { Badge, type Tone } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Input, Select } from "@/Components/ui/field";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import { printOf } from "@/lib/media/fingerprint";
import type { DuplicateMatch, GenreBrief, LibraryLimits, Option, TrackKind } from "@/types/media";
import { CompareDialog, type ComparePair, type CompareSide } from "./compare-dialog";
import { concerns, isPending, LibraryTwin, listenKey, type DuplicateDecision } from "./duplicates";
import { GenrePicker } from "./genre-picker";
import { cleanYear } from "./song-tools";
import { UploadCard } from "./upload-card";
import { groupRepeats, isRepeat, missingField, uploadQueue, useUploadQueue, WORKING, type Phase, type Upload } from "./upload-queue";

interface Props {
  kinds: Option<TrackKind>[];
  /** Kind the new files take unless changed: the one of the tab being looked at. */
  defaultKind: TrackKind;
  genres: GenreBrief[];
  families: Option[];
  limits: LibraryLimits;
  canEpisodes: boolean;
  /** Reloads the library list after audios went up. */
  onSynced: () => void;
}

interface Bulk {
  artist: string;
  album: string;
  year: string;
  genreIds: string[];
}

const EMPTY_BULK: Bulk = { artist: "", album: "", year: "", genreIds: [] };

const plural = (count: number, one: string, many: string) => (count === 1 ? `1 ${one}` : `${count} ${many}`);

/** A drag that carries files from the desktop. */
function fileDrag(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).some((type) => type === "Files" || type === "application/x-moz-file");
}

/** Files of a drop. `files` is empty in some browsers until each item is read. */
function droppedFiles(event: DragEvent): File[] {
  const transfer = event.dataTransfer;
  if (!transfer) return [];
  if (transfer.files?.length) return Array.from(transfer.files);
  return Array.from(transfer.items ?? []).flatMap((item) => {
    if (item.kind !== "file") return [];
    const file = item.getAsFile();
    return file ? [file] : [];
  });
}

/**
 * Upload area of the library: drop or pick files, each song is recognized from its tags or its name and searched on the internet.
 * It shows the upload kept in `uploadQueue`, which goes on while the user is in other sections of the studio or other browser tabs.
 */
export function UploadPanel({ kinds, defaultKind, genres, families, limits, canEpisodes, onSynced }: Props) {
  const base = useStudioUrl()();
  const { queue, auto, notice, base: owner } = useUploadQueue();
  const [uploadKind, setUploadKind] = useState<TrackKind>(defaultKind);
  const [dragging, setDragging] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [bulk, setBulk] = useState<Bulk>(EMPTY_BULK);
  const [flash, setFlash] = useState<string | null>(null);
  const [visited, setVisited] = useState<Record<string, number>>({});
  /** The repeated song open side by side with the ones it may repeat. */
  const [comparing, setComparing] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const flashTimer = useRef(0);
  const synced = useRef(onSynced);
  synced.current = onSynced;
  const mine = uploadQueue.belongsTo(base);

  useEffect(() => uploadQueue.configure(base, limits, canEpisodes), [base, limits, canEpisodes]);
  useEffect(() => (mine ? uploadQueue.view(() => synced.current()) : undefined), [mine]);
  useEffect(() => setUploadKind(defaultKind), [defaultKind]);
  useEffect(
    () => () => {
      stopPreview();
      window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const { phases } = uploadQueue.progress();
  const phase = (item: Upload) => phases.get(item.key) as Phase;
  const edit = (item: Upload, values: Partial<Upload>) => uploadQueue.edit(item.key, values);

  const active = queue.filter((item) => item.status !== "done");
  const done = queue.filter((item) => item.status === "done");
  const groups = groupRepeats(active);
  const grouped = new Set(groups.flat().map((item) => item.key));
  const rest = active.filter((item) => !grouped.has(item.key));
  const ordered = [...groups.flat(), ...rest];
  const inPhase = (...wanted: Phase[]) => ordered.filter((item) => wanted.includes(phase(item)));
  const incomplete = inPhase("incomplete");
  const verdicts = inPhase("verdict");
  const problems = inPhase("blocked", "unreadable");
  const repeats = active.filter(isRepeat);
  const toUpload = active.filter((item) => !["skip", "unreadable"].includes(phase(item))).length;
  const total = done.length + toUpload;
  const sending = active.find((item) => item.status === "uploading");
  const counts = Object.fromEntries((["reading", "searching", "checking", "queued", "skip"] as Phase[]).map((value) => [value, inPhase(value).length])) as Record<Phase, number>;
  const working = active.some((item) => WORKING.has(phase(item)));
  const songs = queue.filter((item) => item.kind === "song" && item.status !== "done");
  const position = (kind: string, items: Upload[]) => (visited[kind] !== undefined && items.length > 1 ? ` (${(visited[kind] % items.length) + 1} de ${items.length})` : "");
  const nameOf = (key: string) => {
    const item = queue.find((entry) => entry.key === key);
    return item ? `«${item.title.trim() || item.file.name}» (${item.file.name})` : "otra canción";
  };

  /** Repeated songs in the order they are shown, to go through them side by side. */
  const comparable = ordered.filter(isRepeat);
  const compared = comparable.find((item) => item.key === comparing) ?? null;
  const genreNames = (ids: string[]) => ids.map((id) => genres.find((genre) => genre.id === id)?.name).filter((name): name is string => Boolean(name));
  const sideOf = (item: Upload, place: string): CompareSide => ({
    key: item.key,
    place,
    title: item.title.trim() || item.file.name,
    credit: [item.artist.trim(), ...item.featured].filter(Boolean).join(", "),
    album: item.album.trim(),
    year: item.year,
    duration: item.duration,
    genres: genreNames(item.genreIds),
    cover: item.coverUrl,
    audio: item.file,
    bytes: item.file.size,
    fileName: item.file.name,
  });
  const pairsOf = (item: Upload): ComparePair[] =>
    concerns(item.duplicates).flatMap((match) => {
      if (match.track) {
        const track = match.track;
        return [
          {
            match,
            other: {
              key: `track:${track.id}`,
              place: "En la biblioteca",
              title: track.title,
              credit: track.artist ?? "",
              album: track.album ?? "",
              year: track.year ? String(track.year) : "",
              duration: track.duration,
              genres: track.genres,
              cover: track.cover_url,
              audio: track.audio_url,
              bytes: null,
              fileName: null,
            },
          },
        ];
      }
      const other = queue.find((entry) => entry.key === match.batch);
      return other ? [{ match, other: sideOf(other, "Otra de esta subida") }] : [];
    });
  const nextPending = (from: Upload) => {
    const at = comparable.indexOf(from);
    return [...comparable.slice(at + 1), ...comparable.slice(0, at)].find((item) => isPending(item.duplicates, item.decision));
  };
  const upcoming = compared ? nextPending(compared) : undefined;

  useEffect(() => {
    if (!upcoming) return;
    [upcoming.file, ...pairsOf(upcoming).map((pair) => pair.other.audio)].forEach((audio) => audio && printOf(audio).catch(() => null));
  }, [upcoming?.key]);

  function addFiles(list: FileList | File[] | null) {
    uploadQueue.configure(base, limits, canEpisodes);
    uploadQueue.addFiles(list, uploadKind);
  }

  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;

  // The dashed box is full of buttons. A file dropped on a button never reaches a React onDrop,
  // so the page itself accepts the drag and hands the music to the same queue.
  useEffect(() => {
    if (!mine) return;
    let active = false;
    const show = (on: boolean) => {
      if (active === on) return;
      active = on;
      setDragging(on);
    };
    const over = (event: DragEvent) => {
      const types = event.dataTransfer?.types;
      const files = fileDrag(event) || !types || types.length === 0;
      if (!files) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      if (fileDrag(event)) show(true);
    };
    const leave = (event: DragEvent) => {
      if (event.relatedTarget === null) show(false);
    };
    const drop = (event: DragEvent) => {
      const files = droppedFiles(event);
      if (!fileDrag(event) && files.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      show(false);
      if (!files.length) return;
      addFilesRef.current(files);
      document.getElementById("biblioteca-subida")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const end = () => show(false);
    window.addEventListener("dragenter", over, true);
    window.addEventListener("dragover", over, true);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop, true);
    window.addEventListener("dragend", end);
    return () => {
      window.removeEventListener("dragenter", over, true);
      window.removeEventListener("dragover", over, true);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop, true);
      window.removeEventListener("dragend", end);
    };
  }, [mine]);

  function stopPreview() {
    player.current?.pause();
    if (player.current?.src) uploadQueue.dropUrl(player.current.src);
    setPreviewing(null);
  }

  function play(id: string, src: string) {
    stopPreview();
    player.current ??= new Audio();
    player.current.src = src;
    player.current.onended = stopPreview;
    player.current.play().catch(() => setPreviewing(null));
    setPreviewing(id);
  }

  function togglePreview(item: Upload) {
    if (previewing === item.key) stopPreview();
    else play(item.key, uploadQueue.objectUrl(item.file));
  }

  /** Plays the song a card may repeat (the library one or the other one of this upload), to compare them by ear. */
  function listen(match: DuplicateMatch) {
    const key = listenKey(match);
    if (previewing === key) {
      stopPreview();
      return;
    }
    if (match.track?.audio_url) {
      play(key, match.track.audio_url);
      return;
    }
    const other = queue.find((item) => item.key === match.batch);
    if (other) togglePreview(other);
  }

  function compare(key: string) {
    stopPreview();
    setComparing(key);
  }

  function remove(item: Upload) {
    if (previewing === item.key) stopPreview();
    uploadQueue.remove(item.key);
  }

  function applyToAll() {
    const values: Partial<Upload> = {};
    if (bulk.artist.trim()) values.artist = bulk.artist.trim();
    if (bulk.album.trim()) values.album = bulk.album.trim();
    if (bulk.genreIds.length) values.genreIds = bulk.genreIds;
    if (bulk.year) values.year = bulk.year;
    uploadQueue.applyToAll(values);
  }

  /** Takes the user to the next audio of a kind (they cycle), with its card highlighted and, if data is missing, the empty field ready to type. */
  function goTo(kind: string, items: Upload[]) {
    if (!items.length) return;
    const at = ((visited[kind] ?? -1) + 1) % items.length;
    const item = items[at];
    setVisited({ ...visited, [kind]: at });
    const card = document.getElementById(`subida-${item.key}`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (kind === "incomplete") card?.querySelector<HTMLElement>(`[data-field="${missingField(item)}"]`)?.focus({ preventScroll: true });
    window.clearTimeout(flashTimer.current);
    setFlash(item.key);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1800);
  }

  /** Saves the choice and moves on to the next repeated song still waiting for one. */
  function chooseCompared(item: Upload, decision: DuplicateDecision) {
    edit(item, { decision });
    const next = nextPending(item);
    if (next) setComparing(next.key);
  }

  function stepCompare(from: Upload, direction: -1 | 1) {
    const at = comparable.findIndex((item) => item.key === from.key);
    setComparing(comparable[(at + direction + comparable.length) % comparable.length].key);
  }

  if (!mine && owner) {
    return (
      <section className="rounded-2xl border border-dashed border-line-strong bg-surface p-5">
        <h2 className="text-base font-semibold">Subir audios</h2>
        <p className="mt-1 text-sm text-muted">Hay una subida en curso en otra de tus emisoras. Termínala o límpiala antes de subir audios aquí.</p>
        <Link href={`${owner}/biblioteca`} className="mt-3 inline-block text-sm font-medium text-signal hover:underline">
          Ver esa subida →
        </Link>
      </section>
    );
  }

  const card = (item: Upload, inGroup = false) => (
    <UploadCard
      key={item.key}
      item={item}
      phase={phase(item)}
      auto={auto}
      grouped={inGroup}
      flash={flash === item.key}
      kinds={kinds}
      genres={genres}
      families={families}
      limits={limits}
      canEpisodes={canEpisodes}
      previewing={previewing === item.key}
      playing={previewing}
      nameOf={nameOf}
      onListen={listen}
      onPatch={(values) => edit(item, values)}
      onRetry={() => uploadQueue.patch(item.key, { blocked: false, error: undefined })}
      onLookUp={() => uploadQueue.lookUp(item.key, true)}
      onCover={(file) => uploadQueue.setCover(item.key, file)}
      onPreview={() => togglePreview(item)}
      onRemove={() => remove(item)}
      onCompare={() => compare(item.key)}
    />
  );

  /** Every row of the list as siblings, so a card keeps its place in the page (and the field being typed) when it moves into or out of a group. */
  const rows: ReactNode[] = [];
  if (groups.length) {
    rows.push(
      <div key="repeats" className={cn("rounded-2xl border p-4 text-sm", verdicts.length ? "border-warning/40 bg-warning-soft" : "border-onair/30 bg-onair-soft")} role="status">
        <p className="font-semibold">
          {repeats.length === 1 ? "1 canción podría estar repetida." : `${repeats.length} canciones podrían estar repetidas.`}{" "}
          {verdicts.length ? `Las pusimos aquí, una tras otra y junto a la que ya está en la biblioteca, para que las compares y des tu veredicto${verdicts.length === repeats.length ? "" : ` (faltan ${verdicts.length})`}.` : "Ya diste tu veredicto en todas."}
        </p>
        <p className="mt-1 text-muted">{auto ? "El resto se sigue subiendo mientras tanto: cada una de estas se sube (o no) apenas decidas." : "Al guardar, el resto se sube sin esperarlas: cada una de estas se sube (o no) apenas decidas."}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {comparable.length > 0 && (
            <Button size="sm" icon={<ArrowLeftRight className="size-3.5" />} onClick={() => compare((verdicts.find(isRepeat) ?? comparable[0]).key)} title="Abre cada repetida junto a la que ya tienes: datos campo por campo, ondas, escucha A/B y comparación del sonido.">
              Compararlas lado a lado, una por una
            </Button>
          )}
          {verdicts.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => goTo("verdict", verdicts)}>
              Ir a la siguiente sin decidir{position("verdict", verdicts)}
            </Button>
          )}
          {repeats.length > 1 && (
            <>
              <Button size="sm" variant="secondary" onClick={() => uploadQueue.decideAll("skip")}>
                No subir ninguna repetida
              </Button>
              <Button size="sm" variant="secondary" onClick={() => uploadQueue.decideAll("both")}>
                Guardar todas igual
              </Button>
            </>
          )}
        </div>
      </div>,
    );
    groups.forEach((group, index) => {
      const same = group.some((item) => concerns(item.duplicates).some((match) => match.verdict === "same"));
      const twins = new Set<string>();
      rows.push(
        <div key={`group-${group[0].key}`} className="flex flex-wrap items-center gap-2 pt-3 text-xs font-medium text-muted">
          <Badge tone="signal">
            Grupo {index + 1} de {groups.length}
          </Badge>
          <span className={same ? "text-danger" : "text-warning"}>{same ? "La misma canción" : "Posible repetida"}</span>
          <span>· {group.length > 1 ? `${group.length} canciones de esta subida` : "con una de la biblioteca"}</span>
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            icon={<ArrowLeftRight className="size-3.5" />}
            onClick={() => compare((group.find((item) => isRepeat(item) && isPending(item.duplicates, item.decision)) ?? group.find(isRepeat) ?? group[0]).key)}
          >
            Comparar lado a lado
          </Button>
        </div>,
      );
      group.forEach((item) => {
        concerns(item.duplicates).forEach((match) => {
          if (!match.track || twins.has(match.track.id)) return;
          twins.add(match.track.id);
          rows.push(<LibraryTwin key={`twin-${group[0].key}-${match.track.id}`} match={match} playing={previewing} onListen={listen} />);
        });
        rows.push(card(item, true));
      });
    });
    if (rest.length) {
      rows.push(
        <p key="rest" className="pt-4 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          Resto de la subida · {rest.length}
        </p>,
      );
    }
  }
  rest.forEach((item) => rows.push(card(item)));
  if (done.length) {
    rows.push(
      <details key="done" className="rounded-2xl border border-onair/30 bg-onair-soft/40 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-onair">Ya subidas a la biblioteca · {done.length}</summary>
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1 text-sm">
          {done.map((item) => (
            <li key={item.key} className="flex items-center gap-2.5 rounded-lg bg-surface px-2.5 py-1.5">
              {item.coverUrl ? (
                <img src={item.coverUrl} alt="" className="size-7 shrink-0 rounded object-cover" />
              ) : (
                <span className="grid size-7 shrink-0 place-items-center rounded bg-raised text-faint">
                  <Music className="size-3.5" />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">
                <b className="font-medium">{item.title}</b>
                {item.artist && <span className="text-muted"> · {item.artist}</span>}
              </span>
              <span className="shrink-0 text-xs font-medium text-onair">{item.replaced ? `Reemplazó «${item.replaced}»` : "Subida"}</span>
            </li>
          ))}
        </ul>
      </details>,
    );
  }

  const kindName = (kinds.find((kind) => kind.value === uploadKind)?.label ?? "Canción").toLowerCase();

  return (
    <>
    {dragging && (
      <div className="pointer-events-none fixed inset-0 z-[80] grid place-items-center bg-canvas/75 p-6 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border-2 border-dashed border-signal bg-surface px-8 py-10 text-center shadow-2xl">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-signal-soft text-signal">
            <Music className="size-8" />
          </span>
          <p className="mt-4 font-display text-2xl font-semibold">Suelta la música</p>
          <p className="mt-2 text-sm text-muted">Se agrega a la subida como {kindName}. La leemos, identificamos cada canción y te avisamos si ya estaba.</p>
        </div>
      </div>
    )}
    <section
      id="biblioteca-subida"
      className={cn("relative rounded-2xl border-2 border-dashed p-5 transition", dragging ? "border-signal bg-signal-soft/40" : "border-line-strong bg-surface")}
    >

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Subir audios</h2>
          <p className="mt-1 text-sm text-muted">
            Arrastra aquí tus archivos o elígelos. {limits.types.join(", ").toUpperCase()} · hasta {limits.max_mb} MB cada uno.
          </p>
          <p className="mt-1 text-xs font-medium text-onair">Nada empieza a sonar al subir: todo queda guardado para programarlo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={uploadKind} onChange={(event) => setUploadKind(event.target.value as TrackKind)} className="w-auto" aria-label="Tipo de los audios que agregas">
            {kinds.map((kind) => (
              <option key={kind.value} value={kind.value}>
                Subir como: {kind.label}
              </option>
            ))}
          </Select>
          <Button icon={<UploadIcon className="size-4" />} onClick={() => picker.current?.click()}>
            Elegir archivos
          </Button>
          <input
            ref={picker}
            type="file"
            accept={limits.types.map((type) => `.${type}`).join(",")}
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      {notice && (
        <p className={cn("mt-4 rounded-xl px-3.5 py-2.5 text-sm font-medium", notice.tone === "ok" ? "bg-onair-soft text-onair" : "bg-warning-soft text-warning")} role="status">
          {notice.text}
        </p>
      )}

      {queue.length === 0 ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => picker.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              picker.current?.click();
            }
          }}
          className="mt-5 grid w-full cursor-pointer place-items-center gap-2 rounded-2xl border border-line bg-raised/50 px-6 py-10 text-center transition hover:border-line-strong hover:bg-raised"
        >
          <span className="grid size-14 place-items-center rounded-full bg-signal-soft text-signal">
            <Music className="size-7" />
          </span>
          <span className="text-base font-semibold">Arrastra tus canciones aquí o haz clic para elegirlas</span>
          <span className="max-w-lg text-sm text-muted">
            Reconocemos solos el nombre, el autor y los invitados de cada canción, y la buscamos en internet para completar su álbum, año, géneros y portada. Si el archivo no trae datos, los tomamos de su nombre («Autor - Canción.mp3»). Antes de
            guardarla te avisamos si ya estaba en la biblioteca.
          </span>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {songs.length > 1 && (
            <div className="rounded-2xl border border-line bg-raised/60 p-3">
              <p className="text-xs font-semibold text-muted">Completar en todas las canciones (por ejemplo, si son del mismo álbum)</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem_auto]">
                <Input value={bulk.artist} onChange={(event) => setBulk({ ...bulk, artist: event.target.value })} placeholder="Autor" maxLength={120} aria-label="Autor para todas" className="h-9" />
                <Input value={bulk.album} onChange={(event) => setBulk({ ...bulk, album: event.target.value })} placeholder="Álbum" maxLength={160} aria-label="Álbum para todas" className="h-9" />
                <Input value={bulk.year} onChange={(event) => setBulk({ ...bulk, year: cleanYear(event.target.value) })} placeholder="Año" inputMode="numeric" aria-label="Año para todas" className="h-9" />
                <Button variant="secondary" size="sm" className="h-9" disabled={!(bulk.artist.trim() || bulk.album.trim() || bulk.genreIds.length || bulk.year)} onClick={applyToAll}>
                  Aplicar a todas
                </Button>
              </div>
              <div className="mt-2">
                <GenrePicker genres={genres} families={families} value={bulk.genreIds} max={limits.max_genres} onChange={(genreIds) => setBulk({ ...bulk, genreIds })} />
              </div>
            </div>
          )}

          {rows}

          <div className="sticky bottom-3 z-10 mt-5! rounded-2xl border border-line bg-surface/95 p-4 shadow-2xl backdrop-blur">
            {(auto || done.length > 0) && (
              <div className="mb-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">
                    {auto ? (working ? "Subida en curso" : "Subida en curso · esperando por ti") : "Subida en pausa"}
                    <span className="font-normal text-muted">
                      {" "}
                      · {done.length} de {total} en la biblioteca
                    </span>
                  </span>
                  {sending && (
                    <span className="max-w-full min-w-0 truncate text-muted">
                      Subiendo «{sending.title.trim() || sending.file.name}» · {Math.round(sending.progress * 100)}%
                    </span>
                  )}
                </div>
                <ProgressBar value={total ? done.length / total : 0} tone="onair" className="mt-1.5 h-2" />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              {auto ? (
                <Button variant="secondary" icon={<Pause className="size-4" />} onClick={() => uploadQueue.pause()}>
                  Pausar la subida
                </Button>
              ) : (
                <Button
                  icon={<UploadIcon className="size-4" />}
                  disabled={toUpload === 0}
                  onClick={() => {
                    stopPreview();
                    uploadQueue.start();
                  }}
                >
                  {done.length ? "Seguir subiendo" : "Guardar"} {plural(toUpload, "audio", "audios")} en la biblioteca
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={auto}
                onClick={() => {
                  stopPreview();
                  uploadQueue.clear();
                }}
              >
                Limpiar lista
              </Button>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {counts.reading > 0 && <Chip tone="neutral">Reconociendo {counts.reading}</Chip>}
                {counts.searching > 0 && <Chip tone="info">Buscando en internet {counts.searching}</Chip>}
                {counts.checking > 0 && <Chip tone="info">Revisando repetidas {counts.checking}</Chip>}
                {counts.queued > 0 && (
                  <Chip tone="onair">
                    {auto ? "En cola para subir" : "Listos para subir"} {counts.queued}
                  </Chip>
                )}
                {done.length > 0 && (
                  <Chip tone="onair">
                    <CheckCircle2 className="size-3" /> Subidos {done.length}
                  </Chip>
                )}
                {incomplete.length > 0 && (
                  <Chip tone="warning" onClick={() => goTo("incomplete", incomplete)}>
                    Completa los datos obligatorios en {plural(incomplete.length, "audio", "audios")}
                    {position("incomplete", incomplete)} · Ir →
                  </Chip>
                )}
                {verdicts.length > 0 && (
                  <Chip tone="danger" onClick={() => goTo("verdict", verdicts)}>
                    {plural(verdicts.length, "repetida espera", "repetidas esperan")} tu veredicto{position("verdict", verdicts)} · Ir →
                  </Chip>
                )}
                {problems.length > 0 && (
                  <Chip tone="danger" onClick={() => goTo("problem", problems)}>
                    {plural(problems.length, "audio con error", "audios con error")}
                    {position("problem", problems)} · Ir →
                  </Chip>
                )}
                {counts.skip > 0 && <Chip tone="neutral">No se subirán {counts.skip}</Chip>}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              {auto && !working && (incomplete.length || verdicts.length || problems.length)
                ? "Todo lo demás ya está en la biblioteca. Apenas completes los datos, des tu veredicto o corrijas lo que falló, se sube solo."
                : auto
                  ? "Cada audio se sube solo, uno por uno, apenas terminan su búsqueda en internet (álbum, año, géneros y portada) y la revisión de repetidas. Sigue en segundo plano aunque vayas a otra sección del estudio o cambies de pestaña; solo se detiene si cierras o recargas el estudio."
                  : "Al guardar, cada audio se sube solo apenas terminen su búsqueda en internet (álbum, año, géneros y portada) y la revisión de repetidas, también en segundo plano mientras usas otras secciones o pestañas; las que podrían estar repetidas esperan tu veredicto."}
            </p>
          </div>
        </div>
      )}

      {compared && (
        <CompareDialog
          song={sideOf(compared, "La nueva")}
          pairs={pairsOf(compared)}
          review={compared.duplicates}
          decision={compared.decision}
          disabled={compared.status !== "ready"}
          position={{ index: comparable.indexOf(compared), total: comparable.length, pending: comparable.filter((item) => isPending(item.duplicates, item.decision)).length }}
          onStep={(direction) => stepCompare(compared, direction)}
          onChoose={(decision) => chooseCompared(compared, decision)}
          onSwap={() => edit(compared, { title: compared.artist, artist: compared.title })}
          onClose={() => setComparing(null)}
        />
      )}
    </section>
    </>
  );
}

function Chip({ tone, onClick, children }: { tone: Tone; onClick?: () => void; children: ReactNode }) {
  return onClick ? (
    <button type="button" onClick={onClick} className="rounded-full transition hover:opacity-80">
      <Badge tone={tone}>{children}</Badge>
    </button>
  ) : (
    <Badge tone={tone}>{children}</Badge>
  );
}
