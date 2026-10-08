import { Link, router } from "@inertiajs/react";
import { Library, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/Components/ui/badge";
import { ButtonLink } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Input } from "@/Components/ui/field";
import { Tabs } from "@/Components/ui/tabs";
import { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { duration as clock } from "@/lib/format";
import type { EditorKindCount, EditorListItem, TrackKind } from "@/types/media";
import { Cover } from "./cover";

interface Props {
  tracks: EditorListItem[];
  kinds: EditorKindCount[];
  total: number;
  search: string;
  kind: TrackKind | null;
}

const SEARCH_DELAY_MS = 300;

/** Choosing the audio to edit: kinds with their counts, search by title or artist, and covers. */
export function Chooser({ tracks, kinds, total, search, kind }: Props) {
  const url = useStudioUrl();
  const can = useStudioCan();
  const [query, setQuery] = useState(search);

  const visit = (params: { buscar?: string; tipo?: string | null }) =>
    router.get(url("/editor"), Object.fromEntries(Object.entries(params).filter(([, value]) => value)), { preserveState: true, preserveScroll: true, replace: true, only: ["tracks", "search", "kind"] });

  useEffect(() => {
    if (query.trim() === search) return;
    const timer = window.setTimeout(() => visit({ buscar: query.trim(), tipo: kind }), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  });

  const library = can("library.manage");

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 md:p-6">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">¿Qué audio quieres editar?</h2>
        <p className="text-[13px] text-muted">
          {library ? "Elige una canción, un jingle, un efecto, un comercial o un programa grabado de la biblioteca." : "Elige el programa grabado que quieres editar."}
        </p>
      </div>

      {total === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Library className="size-6" />}
            title="Todavía no hay audios para editar"
            description={library ? "Sube canciones, jingles o programas a la biblioteca y vuelve aquí para editarlos." : "Cuando la radio tenga programas grabados, podrás editarlos aquí."}
            action={
              library ? (
                <ButtonLink href={url("/biblioteca")} variant="secondary" icon={<Library className="size-4" />}>
                  Ir a la biblioteca
                </ButtonLink>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs<string>
              value={kind ?? ""}
              onChange={(value) => visit({ buscar: query.trim(), tipo: value || null })}
              items={[{ value: "", label: "Todos", count: total }, ...kinds.map((item) => ({ value: item.value, label: item.label, count: item.count }))]}
            />
            <label className="relative block lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título o artista" className="pl-9" aria-label="Buscar audio" />
            </label>
          </div>

          {tracks.length === 0 ? (
            <p className="mt-8 rounded-xl bg-raised px-5 py-10 text-center text-sm text-muted">Ningún audio coincide con la búsqueda.</p>
          ) : (
            <ul className="mt-5 grid gap-2 md:grid-cols-2">
              {tracks.map((track) => (
                <li key={track.id}>
                  <Link
                    href={url(`/editor?audio=${track.id}`)}
                    className="group flex items-center gap-3 rounded-xl border border-line bg-raised p-3 transition hover:border-line-strong hover:bg-surface"
                  >
                    <Cover src={track.cover_url} className="size-12" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{track.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <Badge className="px-2 text-[10.5px]">{track.kind_label}</Badge>
                        {track.credit && <span className="truncate">{track.credit}</span>}
                        <span className="tabular">· {clock(track.duration)}</span>
                      </span>
                    </span>
                    {track.edit_status === "processing" ? (
                      <Badge tone="warning">Procesando…</Badge>
                    ) : track.edit_status === "failed" ? (
                      <Badge tone="danger">Falló</Badge>
                    ) : track.edited ? (
                      <Badge tone="signal">Editado</Badge>
                    ) : null}
                    <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-line transition group-hover:bg-primary group-hover:text-on-primary">Editar</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
