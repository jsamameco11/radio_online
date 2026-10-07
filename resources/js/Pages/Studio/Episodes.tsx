import { router } from "@inertiajs/react";
import { Archive, CalendarClock, Clapperboard, Pencil, Plus, Search, Send, Trash2, Undo2 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { EpisodeForm } from "@/Components/studio/episodes/episode-form";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Input } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Tabs } from "@/Components/ui/tabs";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { dateTime, duration as formatDuration } from "@/lib/format";
import type { Paginated } from "@/types";
import type { EpisodeAudio, EpisodeItem, EpisodeLimits, EpisodeStatus, Option, ReadyRecording } from "@/types/media";

interface Props {
  episodes: Paginated<EpisodeItem>;
  filters: { status: EpisodeStatus | null; search: string };
  statuses: Option<EpisodeStatus>[];
  programs: string[];
  audios: EpisodeAudio[];
  recordings: ReadyRecording[];
  limits: EpisodeLimits;
}

const TONES = { draft: "neutral", scheduled: "info", published: "onair", archived: "warning" } as const;

export default function Episodes({ episodes, filters, statuses, programs, audios, recordings, limits }: Props) {
  const url = useStudioUrl();
  const [search, setSearch] = useState(filters.search);
  const [editing, setEditing] = useState<EpisodeItem | "new" | null>(null);

  const visit = (query: { estado?: string | null; buscar?: string }) =>
    router.get(url("/episodios"), Object.fromEntries(Object.entries(query).filter(([, value]) => value)), { preserveState: true, replace: true });

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    visit({ estado: filters.status, buscar: search.trim() });
  };

  const setStatus = (episode: EpisodeItem, status: EpisodeStatus) => router.patch(url(`/episodios/${episode.id}/estado`), { status }, { preserveScroll: true });

  const remove = (episode: EpisodeItem) => {
    if (!window.confirm(`¿Eliminar el episodio «${episode.title}»? Su audio sigue en la biblioteca.`)) return;
    router.delete(url(`/episodios/${episode.id}`), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Episodios">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Contenido"
          title="Episodios"
          description="Tus programas grabados para escuchar cuando quieran. Publícalos al instante o prográmalos para una fecha."
          actions={
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
              Nuevo episodio
            </Button>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={filters.status ?? "all"}
            onChange={(value) => visit({ estado: value === "all" ? null : value, buscar: filters.search })}
            items={[{ value: "all", label: "Todos" }, ...statuses]}
          />
          <form onSubmit={onSearch} className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por título o programa" className="w-72 pl-9" aria-label="Buscar episodios" />
          </form>
        </div>

        {episodes.data.length === 0 ? (
          <EmptyState
            icon={<Clapperboard className="size-6" />}
            title="No hay episodios aquí"
            description="Sube un audio, grábalo desde el navegador o usa una grabación de la consola."
            action={
              <Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
                Nuevo episodio
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {episodes.data.map((episode) => (
              <li key={episode.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
                <div className="flex gap-4">
                  <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-raised">
                    {episode.cover_url ? <img src={episode.cover_url} alt="" className="size-full object-cover" /> : <Clapperboard className="m-auto mt-7 size-6 text-faint" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{episode.title}</p>
                      <Badge tone={TONES[episode.status.value]}>{episode.status.label}</Badge>
                    </div>
                    <p className="text-xs text-muted">
                      {[
                        episode.program,
                        episode.season ? `T${episode.season}` : null,
                        episode.number ? `E${episode.number}` : null,
                        formatDuration(episode.duration),
                        episode.aired_on ? dateTime(`${episode.aired_on}T12:00:00`, { dateStyle: "medium" }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {episode.status.value === "scheduled" && episode.publish_at && (
                      <p className="flex items-center gap-1 text-xs text-info">
                        <CalendarClock className="size-3.5" /> Se publica el {dateTime(episode.publish_at)}
                      </p>
                    )}
                    {episode.hashtags.length > 0 && <p className="truncate text-xs text-signal">{episode.hashtags.map((tag) => `#${tag}`).join(" ")}</p>}
                  </div>
                </div>

                {episode.audio_url && <audio controls preload="none" src={episode.audio_url} className="h-10 w-full" />}

                <div className="mt-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(episode)}>
                    Editar
                  </Button>
                  {episode.status.value !== "published" && (
                    <Button size="sm" icon={<Send className="size-3.5" />} onClick={() => setStatus(episode, "published")}>
                      Publicar ahora
                    </Button>
                  )}
                  {episode.status.value === "published" && (
                    <Button size="sm" variant="ghost" icon={<Archive className="size-3.5" />} onClick={() => setStatus(episode, "archived")}>
                      Archivar
                    </Button>
                  )}
                  {episode.status.value !== "draft" && (
                    <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => setStatus(episode, "draft")}>
                      Pasar a borrador
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => remove(episode)}>
                    Eliminar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Pagination page={episodes} />
      </div>

      {editing && (
        <EpisodeForm
          episode={editing === "new" ? null : editing}
          statuses={statuses}
          programs={programs}
          audios={audios}
          recordings={recordings}
          limits={limits}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.reload();
          }}
        />
      )}
    </StudioLayout>
  );
}
