import { router, usePage } from "@inertiajs/react";
import { CircleDashed, Clapperboard, Eye, ImageIcon, Play, Trash2, Type } from "lucide-react";
import { useMemo, useState } from "react";
import { StoryComposer } from "@/Components/stories/story-composer";
import { StoryStage } from "@/Components/stories/story-stage";
import { timeLeft } from "@/Components/stories/story-style";
import { StoryViewer } from "@/Components/stories/story-viewer";
import { RadioHeader } from "@/Components/studio/radio-header";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Modal } from "@/Components/ui/modal";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { count } from "@/lib/format";
import type { SharedProps } from "@/types";
import type { StoryKind, StoryLimits, StudioStory } from "@/types/stories";

interface Props {
  stories: StudioStory[];
  limits: StoryLimits;
}

const kindIcons: Record<StoryKind, typeof ImageIcon> = { image: ImageIcon, video: Clapperboard, text: Type };
const kindLabels: Record<StoryKind, string> = { image: "Foto", video: "Video", text: "Texto" };

export default function Stories({ stories, limits }: Props) {
  const { studio } = usePage<SharedProps>().props;
  const url = useStudioUrl();
  const [watching, setWatching] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<StudioStory | null>(null);
  const [removing, setRemoving] = useState(false);
  const chronological = useMemo(() => [...stories].reverse(), [stories]);
  const views = stories.reduce((total, story) => total + story.views_count, 0);

  if (!studio) return null;
  const station = studio.station;

  const remove = () => {
    if (!deleting) return;
    router.delete(url(`/estados/${deleting.id}`), {
      preserveScroll: true,
      onStart: () => setRemoving(true),
      onFinish: () => {
        setRemoving(false);
        setDeleting(null);
      },
    });
  };

  return (
    <StudioLayout title="Estados">
      <div className="space-y-6">
        <RadioHeader
          title="Estados"
          description={`Fotos, videos cortos y textos que tus oyentes ven arriba en la página de inicio y en el logo de tu radio. Cada estado desaparece a las ${limits.lifetime_hours} horas.`}
        />

        <StoryComposer limits={limits} full={stories.length >= limits.max_active} />

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Activos ahora</h2>
              <p className="text-sm text-muted tabular">
                {stories.length} de {limits.max_active} estados · {count(views)} {views === 1 ? "vista" : "vistas"} en total
              </p>
            </div>
            {stories.length > 0 && (
              <Button variant="secondary" icon={<Play className="size-4 fill-current" />} onClick={() => setWatching(chronological[0].id)}>
                Ver como oyente
              </Button>
            )}
          </div>

          {stories.length === 0 ? (
            <EmptyState
              icon={<CircleDashed className="size-6" />}
              title="Tu radio no tiene estados activos"
              description="Anuncia tu próximo programa, comparte lo que pasa en cabina o saluda a tu audiencia. Los oyentes ven tu logo con un aro de color mientras haya estados nuevos."
            />
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {stories.map((story) => {
                const Icon = kindIcons[story.kind];
                return (
                  <li key={story.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                    <button type="button" onClick={() => setWatching(story.id)} className="group relative block w-full" aria-label={`Ver ${kindLabels[story.kind].toLowerCase()} publicado`}>
                      <StoryStage story={story} still className="transition group-hover:opacity-90" />
                      {story.kind === "video" && !story.poster_url && <Clapperboard className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-white/60" aria-hidden />}
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.7rem] font-medium text-white backdrop-blur">
                        <Icon className="size-3" aria-hidden /> {kindLabels[story.kind]}
                      </span>
                      <span className="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[0.7rem] font-medium text-white backdrop-blur tabular">{timeLeft(story.expires_at)}</span>
                    </button>
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted tabular" title={story.posted_by ? `Publicado por ${story.posted_by}` : undefined}>
                        <Eye className="size-3.5 shrink-0" aria-hidden />
                        {count(story.views_count)} {story.views_count === 1 ? "vista" : "vistas"}
                      </span>
                      <button type="button" onClick={() => setDeleting(story)} className="rounded-lg p-1.5 text-muted transition hover:bg-danger-soft hover:text-danger" aria-label="Eliminar estado">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {watching && (
        <StoryViewer
          stations={[station]}
          initial={{ [station.frequency.slug]: chronological }}
          startStory={watching}
          preview
          onClose={() => setWatching(null)}
        />
      )}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="¿Eliminar este estado?"
        description="Tus oyentes dejarán de verlo al instante. Esta acción no se puede deshacer."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} loading={removing} onClick={remove}>
              Eliminar
            </Button>
          </>
        }
      >
        {deleting && (
          <p className="text-sm text-muted">
            {kindLabels[deleting.kind]} con {count(deleting.views_count)} {deleting.views_count === 1 ? "vista" : "vistas"} · {timeLeft(deleting.expires_at).toLowerCase()}.
          </p>
        )}
      </Modal>
    </StudioLayout>
  );
}
