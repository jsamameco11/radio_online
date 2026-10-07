import { router } from "@inertiajs/react";
import { Library as LibraryIcon, Search, ShieldCheck, Upload } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { TrackEditModal } from "@/Components/studio/library/track-edit-modal";
import { TrackRow } from "@/Components/studio/library/track-row";
import { UploadQueue } from "@/Components/studio/library/upload-queue";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Checkbox, Input } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Tabs } from "@/Components/ui/tabs";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import type { Paginated } from "@/types";
import type { GenreBrief, LibraryLimits, LibraryTrack, Option, TrackKind } from "@/types/media";

interface Props {
  tracks: Paginated<LibraryTrack>;
  filters: { kind: TrackKind; search: string; problems: boolean; rotation: boolean };
  kinds: (Option<TrackKind> & { count: number })[];
  problems: number;
  genres: GenreBrief[];
  families: Option[];
  limits: LibraryLimits;
}

type Tab = TrackKind | "revision";

export default function Library({ tracks, filters, kinds, problems, genres, families, limits }: Props) {
  const url = useStudioUrl();
  const [search, setSearch] = useState(filters.search);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<LibraryTrack | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => player.current?.pause(), []);

  const visit = (query: Record<string, string | number | boolean | undefined>) =>
    router.get(url("/biblioteca"), Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== "" && value !== false)), {
      preserveState: true,
      replace: true,
    });

  const current = { tipo: filters.kind, buscar: filters.search, revision: filters.problems || undefined, rotacion: filters.rotation || undefined };

  const onTab = (tab: Tab) => (tab === "revision" ? visit({ revision: 1, buscar: filters.search }) : visit({ tipo: tab, buscar: filters.search }));

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

  const remove = (track: LibraryTrack) => {
    if (!window.confirm(`¿Eliminar «${track.title}» de la biblioteca? También sale de las listas y de la programación futura.`)) return;
    router.delete(url(`/biblioteca/${track.id}`), { preserveScroll: true });
  };

  const reload = () => router.reload({ only: ["tracks", "kinds", "problems"] });

  const tabs: { value: Tab; label: string; count?: number }[] = [
    ...kinds.map((kind) => ({ value: kind.value as Tab, label: kind.label, count: kind.count })),
    ...(problems > 0 || filters.problems ? [{ value: "revision" as Tab, label: "Por revisar", count: problems }] : []),
  ];
  const active: Tab = filters.problems ? "revision" : filters.kind;
  const kindOptions = kinds.map(({ value, label }) => ({ value, label }));

  return (
    <StudioLayout title="Biblioteca">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Contenido"
          title="Biblioteca"
          description="Las canciones, cortinas, efectos, comerciales y programas de tu radio. De aquí salen las listas, la programación y el piloto automático."
          actions={
            <>
              <Button variant="secondary" icon={<ShieldCheck className="size-4" />} onClick={() => router.post(url("/biblioteca/revision"), {}, { preserveScroll: true })}>
                Revisar archivos
              </Button>
              <Button icon={<Upload className="size-4" />} onClick={() => setUploading(true)}>
                Subir audios
              </Button>
            </>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={active} onChange={onTab} items={tabs} />
          <div className="flex flex-wrap items-center gap-3">
            {filters.kind === "song" && !filters.problems && (
              <Checkbox label="Solo música automática" checked={filters.rotation} onChange={(event) => visit({ ...current, rotacion: event.target.checked || undefined })} />
            )}
            <form onSubmit={onSearch} className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, artista o álbum" className="w-72 pl-9" aria-label="Buscar en la biblioteca" />
            </form>
          </div>
        </div>

        {tracks.data.length === 0 ? (
          <EmptyState
            icon={<LibraryIcon className="size-6" />}
            title={filters.search ? "No encontramos audios con esa búsqueda" : filters.problems ? "Todos los archivos están bien" : "Todavía no hay audios aquí"}
            description={filters.problems ? "Ningún audio tiene problemas con su archivo." : "Sube tus archivos: los leemos, identificamos las canciones y te avisamos si alguna ya estaba."}
            action={
              !filters.problems && (
                <Button icon={<Upload className="size-4" />} onClick={() => setUploading(true)}>
                  Subir audios
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {tracks.data.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                playing={playing === track.id}
                onPlay={() => play(track)}
                onEdit={() => setEditing(track)}
                onRotation={() => router.patch(url(`/biblioteca/${track.id}/rotacion`), {}, { preserveScroll: true })}
                onDelete={() => remove(track)}
              />
            ))}
          </ul>
        )}

        <Pagination page={tracks} />
      </div>

      <UploadQueue
        open={uploading}
        initialKind={filters.kind}
        kinds={kindOptions}
        genres={genres}
        families={families}
        limits={limits}
        onClose={() => setUploading(false)}
        onUploaded={reload}
      />

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
