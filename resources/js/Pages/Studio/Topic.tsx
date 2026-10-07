import { History } from "lucide-react";
import { TopicEditor } from "@/Components/studio/topic-editor";
import { EmptyState } from "@/Components/ui/empty-state";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Panel } from "@/Components/ui/panel";
import StudioLayout from "@/Layouts/StudioLayout";
import { dateTime, duration } from "@/lib/format";
import type { Paginated } from "@/types";
import type { Topic } from "@/types/station-admin";

interface Props {
  history: Paginated<Topic>;
  current: Topic | null;
  suggestions: string[];
  limits: { hashtags: number; hashtag_length: number };
}

export default function TopicPage({ history, current, suggestions, limits }: Props) {
  return (
    <StudioLayout title="Tema y hashtags">
      <div className="max-w-4xl space-y-6">
        <PageHeader eyebrow="Al aire" title="Tema y hashtags" description="Cuéntales a tus oyentes de qué están hablando. El tema aparece en tu página, en el reproductor y en la búsqueda." />

        <TopicEditor maxHashtags={limits.hashtags} suggestions={suggestions} />
        {current?.author && <p className="text-xs text-muted">Publicado por {current.author}.</p>}

        <Panel title="Temas anteriores" padded={history.data.length === 0}>
          {history.data.length === 0 ? (
            <EmptyState icon={<History className="size-6" />} title="Todavía no hay temas terminados" />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {history.data.map((topic) => (
                <li key={topic.id} className="space-y-1 px-5 py-3">
                  <p className="font-medium text-ink">{topic.title}</p>
                  {topic.hashtags.length > 0 && <p className="text-xs text-signal">{topic.hashtags.map((tag) => `#${tag}`).join(" ")}</p>}
                  <p className="text-xs text-muted">
                    {dateTime(topic.started_at)}
                    {topic.ended_at && ` · duró ${duration((new Date(topic.ended_at).getTime() - new Date(topic.started_at).getTime()) / 1000)}`}
                    {topic.author && ` · ${topic.author}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Pagination page={history} />
      </div>
    </StudioLayout>
  );
}
