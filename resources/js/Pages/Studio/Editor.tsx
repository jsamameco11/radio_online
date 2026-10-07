import { router } from "@inertiajs/react";
import { Scissors, Search } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { EditorWorkspace } from "@/Components/studio/editor/workspace";
import { Badge } from "@/Components/ui/badge";
import { EmptyState } from "@/Components/ui/empty-state";
import { Input } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { cn } from "@/lib/cn";
import { duration as formatDuration } from "@/lib/format";
import type { EditorLimits, EditorListItem, EditorTrack } from "@/types/media";

interface Props {
  available: boolean;
  tracks: EditorListItem[];
  track: EditorTrack | null;
  search: string;
  limits: EditorLimits;
}

export default function Editor({ available, tracks, track, search, limits }: Props) {
  const url = useStudioUrl();
  const [query, setQuery] = useState(search);

  const visit = (params: { audio?: string; buscar?: string }) =>
    router.get(url("/editor"), Object.fromEntries(Object.entries(params).filter(([, value]) => value)), { preserveState: true, preserveScroll: true, replace: true });

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    visit({ audio: track?.id, buscar: query.trim() });
  };

  return (
    <StudioLayout title="Editor de audio">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Contenido"
          title="Editor de audio"
          description="Corta silencios y errores, suaviza entradas y salidas y mejora el sonido. Escuchas cada cambio al instante; el original se conserva por si quieres volver."
        />

        <div className="grid gap-6 xl:grid-cols-[20rem_1fr]">
          <aside className="space-y-3">
            <form onSubmit={onSearch} className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar audio" className="pl-9" aria-label="Buscar audio" />
            </form>
            {tracks.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">No hay audios para editar.</p>
            ) : (
              <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
                {tracks.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => visit({ audio: item.id, buscar: search })}
                      className={cn("w-full rounded-xl border px-3 py-2.5 text-left transition", item.id === track?.id ? "border-signal bg-signal-soft" : "border-transparent hover:bg-raised")}
                    >
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <span className="truncate">{[item.credit, item.kind, formatDuration(item.duration)].filter(Boolean).join(" · ")}</span>
                        {item.edit_status === "processing" && <Badge tone="info">Procesando</Badge>}
                        {item.edit_status === "failed" && <Badge tone="danger">Falló</Badge>}
                        {item.edited && !item.edit_status && <Badge tone="signal">Editado</Badge>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {track ? (
            <EditorWorkspace key={track.id} track={track} available={available} limits={limits} />
          ) : (
            <EmptyState icon={<Scissors className="size-6" />} title="Elige un audio" description="Selecciona un audio de la lista para empezar a editarlo." />
          )}
        </div>
      </div>
    </StudioLayout>
  );
}
