import { router } from "@inertiajs/react";
import { Pencil, Plus, Search, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { plain } from "@/Components/studio/library/song-tools";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Input, Select } from "@/Components/ui/field";
import { useStudioUrl } from "@/Layouts/StudioLayout";
import { count } from "@/lib/format";
import type { CatalogGenre, Option } from "@/types/media";
import { GenreModal } from "./genre-modal";

interface Props {
  genres: CatalogGenre[];
  families: Option[];
}

/** The styles of the shared catalog by family: the station adds new ones and changes or removes those it added. */
export function GenreList({ genres, families }: Props) {
  const url = useStudioUrl();
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("");
  const [editing, setEditing] = useState<CatalogGenre | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needle = plain(search.trim());
  const groups = families
    .filter((option) => !family || option.value === family)
    .map((option) => ({
      ...option,
      genres: genres.filter((genre) => genre.family === option.value && (!needle || plain([genre.name, ...genre.aliases].join(" ")).includes(needle))),
    }))
    .filter((group) => group.genres.length);

  const remove = (genre: CatalogGenre) => {
    const usage = [genre.songs && `${count(genre.songs)} ${genre.songs === 1 ? "canción" : "canciones"} de tu radio`, genre.artists && `${count(genre.artists)} ${genre.artists === 1 ? "artista" : "artistas"} del catálogo`].filter(Boolean);
    const warning = usage.length ? `\n\nLo usan ${usage.join(" y ")}: se quedarán sin este estilo.` : "";
    if (!window.confirm(`¿Eliminar el estilo «${genre.name}»?${warning}`)) return;
    setError(null);
    router.delete(url(`/catalogo/estilos/${genre.id}`), { preserveScroll: true, onError: (errors) => setError(errors.genre ?? Object.values(errors)[0] ?? null) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar estilo o sus otros nombres" className="pl-9" aria-label="Buscar estilo" />
        </div>
        <Select value={family} onChange={(event) => setFamily(event.target.value)} className="w-auto" aria-label="Filtrar por familia">
          <option value="">Todas las familias</option>
          {families.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          Nuevo estilo
        </Button>
      </div>

      {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

      {groups.length === 0 ? (
        <EmptyState icon={<Tags className="size-6" />} title="No encontramos estilos" description="Prueba con otro nombre, o agrégalo con «Nuevo estilo»." />
      ) : (
        groups.map((group) => (
          <section key={group.value} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <h3 className="border-b border-line px-4 py-2.5 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
              {group.label} <span className="font-normal text-faint">· {count(group.genres.length)}</span>
            </h3>
            <ul className="divide-y divide-line">
              {group.genres.map((genre) => (
                <li key={genre.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {genre.name}
                      {genre.custom && <Badge tone={genre.editable ? "signal" : "neutral"}>{genre.editable ? "Agregado por tu radio" : "Agregado"}</Badge>}
                    </p>
                    {genre.aliases.length > 0 && <p className="mt-0.5 truncate text-xs text-faint">También: {genre.aliases.join(", ")}</p>}
                  </div>
                  <p className="text-xs text-muted">
                    {count(genre.songs)} {genre.songs === 1 ? "canción" : "canciones"} · {count(genre.artists)} {genre.artists === 1 ? "artista" : "artistas"}
                  </p>
                  {genre.editable && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(genre)} aria-label={`Editar ${genre.name}`} title="Editar">
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(genre)} aria-label={`Eliminar ${genre.name}`} title="Eliminar">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {editing && <GenreModal genre={editing === "new" ? undefined : editing} families={families} onClose={() => setEditing(null)} />}
    </div>
  );
}
