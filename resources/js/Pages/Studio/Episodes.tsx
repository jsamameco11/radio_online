import { router } from "@inertiajs/react";
import { Archive, CalendarClock, Clapperboard, EyeOff, Mic2, Pencil, Plus, Radio, Scissors, Search, Send, Trash2, Undo2 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { EpisodeCover } from "@/Components/studio/episodes/episode-cover";
import { EpisodeForm } from "@/Components/studio/episodes/episode-form";
import { RadioHeader } from "@/Components/studio/radio-header";
import { Badge } from "@/Components/ui/badge";
import { Button, ButtonLink } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Input } from "@/Components/ui/field";
import { Pagination } from "@/Components/ui/pagination";
import { Stat } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { dateTime, duration as formatDuration } from "@/lib/format";
import type { Paginated } from "@/types";
import type { EpisodeAudio, EpisodeItem, EpisodeLimits, EpisodeStats, EpisodeStatus, Option, ReadyRecording, TrackKind } from "@/types/media";

interface Props {
  episodes: Paginated<EpisodeItem>;
  filters: { status: EpisodeStatus | null; search: string };
  statuses: Option<EpisodeStatus>[];
  stats: EpisodeStats;
  programs: string[];
  audios: EpisodeAudio[];
  kinds: Option<TrackKind>[];
  prefill: string | null;
  recordings: ReadyRecording[];
  limits: EpisodeLimits;
}

const TONES = { draft: "neutral", scheduled: "info", published: "onair", archived: "warning" } as const;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export default function Episodes({ episodes, filters, statuses, stats, programs, audios, kinds, prefill, recordings, limits }: Props) {
  const url = useStudioUrl();
  const [search, setSearch] = useState(filters.search);
  const [editing, setEditing] = useState<EpisodeItem | "new" | null>(prefill ? "new" : null);
  const hidden = stats.draft + stats.scheduled + stats.archived;

  const visit = (query: { estado?: string | null; buscar?: string }) =>
    router.get(url("/episodios"), Object.fromEntries(Object.entries(query).filter(([, value]) => value)), { preserveState: true, replace: true });

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    visit({ estado: filters.status, buscar: search.trim() });
  };

  const close = () => {
    setEditing(null);
    if (prefill) visit({ estado: filters.status, buscar: filters.search });
  };

  const setStatus = (episode: EpisodeItem, status: EpisodeStatus) => router.patch(url(`/episodios/${episode.id}/estado`), { status }, { preserveScroll: true });

  const remove = (episode: EpisodeItem) => {
    if (!window.confirm(`¿Eliminar el episodio «${episode.title}»? Su audio sigue en la biblioteca.`)) return;
    router.delete(url(`/episodios/${episode.id}`), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Episodios">
      <div className="space-y-6">
        <RadioHeader
          title="Episodios"
          description="Los programas grabados que tus oyentes escuchan cuando quieran en la página de tu radio, con su portada, título y una descripción corta. Publícalos al instante o prográmalos para una fecha."
          actions={
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
              Nuevo episodio
            </Button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Publicados" value={stats.published} icon={<Radio className="size-4" />} hint="Se ven en la página de tu radio." />
          <Stat
            label="Ocultos"
            value={hidden}
            icon={<EyeOff className="size-4" />}
            hint={hidden ? [plural(stats.draft, "borrador", "borradores"), plural(stats.scheduled, "programado", "programados"), plural(stats.archived, "archivado", "archivados")].join(" · ") : "Guardados, pero no se ven en la página."}
          />
          <Stat label="Programas" value={programs.length} icon={<Mic2 className="size-4" />} hint={programs.slice(0, 3).join(" · ") || "Ponle el nombre del programa a cada episodio."} />
        </div>

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
            description="Sube un audio, grábalo desde el navegador, elige uno de la biblioteca o usa una grabación de la consola."
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
                  <EpisodeCover src={episode.cover_url} title={episode.title} className="size-20 rounded-xl text-lg" />
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
                    {episode.description ? <p className="line-clamp-2 text-sm leading-5 text-ink/80">{episode.description}</p> : <p className="text-xs text-faint italic">Sin descripción</p>}
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
                  <ButtonLink size="sm" variant="ghost" icon={<Scissors className="size-3.5" />} href={url(`/editor?audio=${episode.track.id}`)} title="Recortar y mejorar el sonido del audio">
                    Editar audio
                  </ButtonLink>
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
                  <Button size="sm" variant="ghost" className="text-danger" icon={<Trash2 className="size-3.5" />} onClick={() => remove(episode)}>
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
          kinds={kinds}
          initialTrack={editing === "new" ? prefill : null}
          recordings={recordings}
          limits={limits}
          onClose={close}
          onSaved={() => {
            if (prefill) close();
            else {
              setEditing(null);
              router.reload();
            }
          }}
        />
      )}
    </StudioLayout>
  );
}
