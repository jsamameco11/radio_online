import { router } from "@inertiajs/react";
import { Clapperboard, Library as LibraryIcon, Megaphone, Music, Repeat, Search, ShieldCheck } from "lucide-react";
import type { DragEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { artistShelves, type LibraryView, longDuration, ShelfBrowser, ShelfHeader, styleShelves } from "@/Components/studio/library/shelves";
import { plain } from "@/Components/studio/library/song-tools";
import { uploadQueue } from "@/Components/studio/library/upload-queue";
import { TrackEditModal } from "@/Components/studio/library/track-edit-modal";
import { TrackRow } from "@/Components/studio/library/track-row";
import { UploadPanel } from "@/Components/studio/library/upload-panel";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Checkbox, Input, Select } from "@/Components/ui/field";
import { RadioHeader } from "@/Components/studio/radio-header";
import { Pagination } from "@/Components/ui/pagination";
import { Stat } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import StudioLayout, { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import { count } from "@/lib/format";
import type { Paginated } from "@/types";
import type { GenreBrief, LibraryLimits, LibraryStats, LibraryTrack, Option, TrackKind } from "@/types/media";

interface Props {
  tracks: Paginated<LibraryTrack>;
  filters: { kind: TrackKind | null; search: string; style: string | null; problems: boolean; rotation: boolean };
  kinds: (Option<TrackKind> & { count: number })[];
  stats: LibraryStats;
  problems: number;
  /** The genres the songs use, for the style filter. */
  styles: GenreBrief[];
  /** Every song with its details, only loaded for the author and genre shelves. */
  songs?: LibraryTrack[];
  genres: GenreBrief[];
  families: Option[];
  limits: LibraryLimits;
}

type Tab = TrackKind | "all" | "revision";

const VIEWS: { value: LibraryView; label: string }[] = [
  { value: "audios", label: "Todos los audios" },
  { value: "authors", label: "Por autor" },
  { value: "styles", label: "Por estilo" },
];

export default function Library({ tracks, filters, kinds, stats, problems, styles, songs, genres, families, limits }: Props) {
  const url = useStudioUrl();
  const can = useStudioCan();
  const canEpisodes = can("episodes.manage");
  const [search, setSearch] = useState(filters.search);
  const [view, setView] = useState<LibraryView>("audios");
  const [shelfQuery, setShelfQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [inShelf, setInShelf] = useState("");
  const [editing, setEditing] = useState<LibraryTrack | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [fileOver, setFileOver] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
  const dropDepth = useRef(0);
  const dropKind: TrackKind = filters.kind ?? "song";

  useEffect(() => () => player.current?.pause(), []);

  const shelves = useMemo(() => (view === "audios" || !songs ? [] : view === "authors" ? artistShelves(songs) : styleShelves(songs)), [view, songs]);
  const shelf = open ? (shelves.find((item) => item.key === open) ?? null) : null;

  const visit = (query: Record<string, string | number | boolean | null | undefined>) =>
    router.get(url("/biblioteca"), Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== false)), {
      preserveState: true,
      replace: true,
    });

  const current = { tipo: filters.kind, buscar: filters.search, estilo: filters.style, revision: filters.problems || undefined, rotacion: filters.rotation || undefined };

  const onTab = (tab: Tab) => {
    if (tab === "revision") visit({ revision: 1, buscar: filters.search });
    else visit({ tipo: tab === "all" ? undefined : tab, buscar: filters.search, estilo: tab === "all" || tab === "song" ? filters.style : undefined });
  };

  const onView = (next: LibraryView) => {
    setView(next);
    setOpen(null);
    setShelfQuery("");
    if (next !== "audios" && !songs) router.reload({ only: ["songs"] });
  };

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    visit({ ...current, buscar: search.trim() });
  };

  const play = (track: LibraryTrack) => {
    if (!track.audio_url) return;
    if (playing === track.id) {
      player.current?.pause();
      setPlaying(null);
      return;
    }
    player.current?.pause();
    const audio = new Audio(track.audio_url);
    audio.onended = () => setPlaying(null);
    void audio.play().catch(() => setPlaying(null));
    player.current = audio;
    setPlaying(track.id);
  };

  const reload = () => router.reload({ only: ["tracks", "kinds", "stats", "problems", "styles", ...(songs ? ["songs"] : [])] });

  /** Files dropped on the list join the same upload as the box above, as music unless a type tab is open. */
  function onFileDrag(event: DragEvent, entering: boolean | null) {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    if (entering === true) dropDepth.current += 1;
    if (entering === false) dropDepth.current = Math.max(0, dropDepth.current - 1);
    setFileOver(dropDepth.current > 0);
  }

  function onFileDrop(event: DragEvent) {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    dropDepth.current = 0;
    setFileOver(false);
    uploadQueue.configure(url(), limits, canEpisodes);
    uploadQueue.addFiles(event.dataTransfer.files, dropKind);
    document.getElementById("biblioteca-subida")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const fileDrop = {
    onDragEnter: (event: DragEvent) => onFileDrag(event, true),
    onDragOver: (event: DragEvent) => onFileDrag(event, null),
    onDragLeave: (event: DragEvent) => onFileDrag(event, false),
    onDrop: onFileDrop,
  };

  const remove = (track: LibraryTrack) => {
    const warnings = [
      track.upcoming > 0 && `Suena en ${track.upcoming} ${track.upcoming === 1 ? "bloque programado" : "bloques programados"}: esos bloques quedan sin este audio.`,
      track.episodes_count > 0 && `Tiene ${track.episodes_count === 1 ? "un episodio publicado" : `${track.episodes_count} episodios publicados`} que dejan de escucharse.`,
    ].filter(Boolean);
    const message = [`¿Eliminar «${track.title}» de la biblioteca? También sale de las listas y de la programación futura.`, ...warnings].join("\n\n");
    if (!window.confirm(message)) return;
    router.delete(url(`/biblioteca/${track.id}`), { preserveScroll: true, onSuccess: () => songs && router.reload({ only: ["songs"] }) });
  };

  const row = (track: LibraryTrack, showKind: boolean) => (
    <TrackRow
      key={track.id}
      track={track}
      playing={playing === track.id}
      showKind={showKind}
      canEpisodes={canEpisodes}
      onPlay={() => play(track)}
      onEdit={() => setEditing(track)}
      onRotation={() => router.patch(url(`/biblioteca/${track.id}/rotacion`), {}, { preserveScroll: true, onSuccess: () => songs && router.reload({ only: ["songs"] }) })}
      onDelete={() => remove(track)}
    />
  );

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: "all", label: "Todo", count: stats.total },
    ...kinds.map((kind) => ({ value: kind.value as Tab, label: kind.label, count: kind.count })),
    ...(problems > 0 || filters.problems ? [{ value: "revision" as Tab, label: "Por revisar", count: problems }] : []),
  ];
  const activeTab: Tab = filters.problems ? "revision" : (filters.kind ?? "all");
  const kindOptions = kinds.map(({ value, label }) => ({ value, label }));
  const filtered = Boolean(filters.search || filters.style || filters.rotation);
  const shelfNeedle = plain(inShelf.trim());
  const shelfSongs = shelf ? shelf.songs.filter((song) => !shelfNeedle || plain(`${song.title} ${song.credit ?? ""} ${song.album ?? ""}`).includes(shelfNeedle)) : [];

  return (
    <StudioLayout title="Biblioteca">
      <div className="space-y-6">
        <RadioHeader
          title="Biblioteca"
          description="Las canciones, cortinas, efectos, comerciales y programas de tu radio. De aquí salen las listas, la programación y la música automática."
          actions={
            <Button variant="secondary" icon={<ShieldCheck className="size-4" />} onClick={() => router.post(url("/biblioteca/revision"), {}, { preserveScroll: true })}>
              Revisar archivos
            </Button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Audios" value={count(stats.total)} hint={`${count(stats.songs)} ${stats.songs === 1 ? "canción" : "canciones"} de ${count(stats.authors)} ${stats.authors === 1 ? "autor" : "autores"}`} icon={<LibraryIcon className="size-4" />} />
          <Stat
            label="En la música automática"
            value={count(stats.rotation)}
            hint={stats.rotation ? `Tarda ${longDuration(stats.rotation_seconds)} en repetir una canción` : "Activa canciones para que suenen en los espacios libres"}
            icon={<Repeat className="size-4" />}
          />
          <Stat label="Anuncios y efectos" value={count(stats.spots)} hint="Comerciales, cortinas y efectos" icon={<Megaphone className="size-4" />} />
          <Stat label="Programas grabados" value={count(stats.programs)} hint="Listos para programar o publicar" icon={<Clapperboard className="size-4" />} />
        </div>

        <UploadPanel kinds={kindOptions} defaultKind={filters.kind ?? "song"} genres={genres} families={families} limits={limits} canEpisodes={canEpisodes} onSynced={reload} />

        <Tabs value={view} onChange={onView} items={VIEWS} />

        {view === "audios" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Tabs value={activeTab} onChange={onTab} items={tabs} />
              <div className="flex flex-wrap items-center gap-3">
                {filters.kind === "song" && (
                  <Checkbox label="Solo música automática" checked={filters.rotation} onChange={(event) => visit({ ...current, rotacion: event.target.checked || undefined })} />
                )}
                {!filters.problems && (filters.kind === null || filters.kind === "song") && styles.length > 0 && (
                  <Select value={filters.style ?? ""} onChange={(event) => visit({ ...current, estilo: event.target.value })} className="w-auto" aria-label="Filtrar por estilo">
                    <option value="">Todos los estilos</option>
                    {styles.map((style) => (
                      <option key={style.id} value={style.id}>
                        {style.name}
                      </option>
                    ))}
                  </Select>
                )}
                <form onSubmit={onSearch} className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, autor, álbum o estilo" className="w-72 pl-9" aria-label="Buscar en la biblioteca" />
                </form>
              </div>
            </div>

            {tracks.data.length === 0 ? (
              <div {...fileDrop} className={cn("relative rounded-2xl", fileOver && "ring-2 ring-signal")}>
                {fileOver ? (
                  <div className="grid place-items-center gap-2 rounded-2xl border-2 border-dashed border-signal bg-signal-soft/40 px-6 py-16 text-center">
                    <Music className="size-7 text-signal" />
                    <p className="text-base font-semibold text-signal">Suelta la música aquí</p>
                    <p className="max-w-md text-sm text-muted">Entran como canciones: las leemos, identificamos cada una y te avisamos si alguna ya estaba.</p>
                  </div>
                ) : (
                  <EmptyState
                    icon={<Music className="size-6" />}
                    title={filtered ? "No encontramos audios con esa búsqueda" : filters.problems ? "Todos los archivos están bien" : "Todavía no hay audios aquí"}
                    description={
                      filters.problems
                        ? "Ningún audio tiene problemas con su archivo."
                        : filtered
                          ? "Prueba con otras palabras o quita los filtros. También puedes soltar canciones en esta zona."
                          : "Arrastra tus canciones aquí. Las leemos, identificamos cada una y te avisamos si alguna ya estaba."
                    }
                  />
                )}
              </div>
            ) : (
              <ul {...fileDrop} className={cn("divide-y divide-line rounded-2xl border border-line bg-surface", fileOver && "ring-2 ring-signal")}>
                {tracks.data.map((track) => row(track, activeTab === "all" || activeTab === "revision"))}
              </ul>
            )}

            <Pagination page={tracks} />
          </>
        ) : !songs ? (
          <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">Ordenando las canciones…</p>
        ) : shelf ? (
          <div className="space-y-4">
            <ShelfHeader
              view={view}
              shelf={shelf}
              families={families}
              onBack={() => {
                setOpen(null);
                setInShelf("");
              }}
            />
            {shelf.songs.length > 6 && (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
                <Input value={inShelf} onChange={(event) => setInShelf(event.target.value)} placeholder={`Buscar entre las ${shelf.songs.length} canciones`} className="pl-9 sm:w-80" aria-label="Buscar canción" />
              </div>
            )}
            {shelfSongs.length ? (
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">{shelfSongs.map((track) => row(track, false))}</ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
                <Music className="mx-auto mb-2 size-5 text-faint" />
                {shelf.songs.length ? "Ninguna canción coincide con la búsqueda." : "Ya no quedan canciones aquí."}
              </p>
            )}
          </div>
        ) : (
          <ShelfBrowser view={view} shelves={shelves} families={families} query={shelfQuery} onQuery={setShelfQuery} onOpen={setOpen} />
        )}
      </div>

      {editing && (
        <TrackEditModal
          track={editing}
          kinds={kindOptions}
          genres={genres}
          families={families}
          limits={limits}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </StudioLayout>
  );
}
