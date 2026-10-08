import { Plus, Star, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import type { GenreBrief, Option } from "@/types/media";
import { plain } from "./song-tools";

interface Props {
  genres: GenreBrief[];
  families: Option[];
  value: string[];
  max: number;
  onChange: (ids: string[]) => void;
  id?: string;
  disabled?: boolean;
}

/** Up to `max` genres of the shared catalog, in order: the first one is the main genre; the star makes another one the main. */
export function GenrePicker({ genres, families, value, max, onChange, id, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const byId = new Map(genres.map((genre) => [genre.id, genre]));
  const chosen = value.map((genreId) => byId.get(genreId)).filter((genre): genre is GenreBrief => Boolean(genre));
  const familyLabel = new Map(families.map((family) => [family.value, family.label]));
  const needle = plain(query.trim());
  const groups = families
    .map((family) => ({
      ...family,
      genres: genres.filter((genre) => genre.family === family.value && !value.includes(genre.id) && (!needle || plain(`${genre.name} ${family.label}`).includes(needle))),
    }))
    .filter((group) => group.genres.length);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => box.current && !box.current.contains(event.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const add = (genre: GenreBrief) => {
    onChange([...value, genre.id].slice(0, max));
    setQuery("");
    if (value.length + 1 >= max) setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {chosen.map((genre, index) => (
          <span
            key={genre.id}
            title={index === 0 ? "Género principal: decide en qué bloques de música suena" : familyLabel.get(genre.family)}
            className={cn("inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-2.5 text-xs font-medium", index === 0 ? "bg-signal-soft text-signal" : "bg-raised text-ink ring-1 ring-line")}
          >
            {index === 0 && <span className="text-[0.62rem] tracking-wide uppercase opacity-70">Principal ·</span>}
            {genre.name}
            {index > 0 && !disabled && (
              <button type="button" onClick={() => onChange([genre.id, ...value.filter((other) => other !== genre.id)])} className="rounded-full p-0.5 text-muted hover:text-gold" aria-label={`Hacer de ${genre.name} el género principal`} title="Hacerlo el género principal">
                <Star className="size-3" />
              </button>
            )}
            {!disabled && (
              <button type="button" onClick={() => onChange(value.filter((other) => other !== genre.id))} aria-label={`Quitar ${genre.name}`} className="rounded-full p-0.5 opacity-70 hover:opacity-100">
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {chosen.length < max && !disabled && (
          <button
            id={id}
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={listId}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-3 py-1 text-xs font-medium text-muted transition hover:text-ink"
          >
            <Plus className="size-3" /> {chosen.length ? "Otro género" : "Elegir género"}
          </button>
        )}
        {chosen.length === 0 && disabled && <span className="text-xs text-muted">Sin género</span>}
      </div>
      {open && (
        <div id={listId} className="absolute left-0 z-30 mt-1.5 w-[min(24rem,85vw)] rounded-2xl border border-line bg-surface p-2 shadow-2xl">
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (event.key === "Enter") {
                event.preventDefault();
                const first = groups[0]?.genres[0];
                if (first) add(first);
              }
            }}
            placeholder="Buscar género: pop, rock, salsa…"
            aria-label="Buscar género"
            className="h-9"
          />
          <div className="mt-2 max-h-72 overflow-y-auto pr-1">
            {groups.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted">No hay géneros con ese nombre. Créalo en el Catálogo musical.</p>}
            {groups.map((group) => (
              <div key={group.value} className="mb-2">
                <p className="sticky top-0 bg-surface px-1 py-1 text-[0.65rem] font-semibold tracking-[0.08em] text-muted uppercase">{group.label}</p>
                <div className="flex flex-wrap gap-1">
                  {group.genres.map((genre) => (
                    <button key={genre.id} type="button" onClick={() => add(genre)} className="rounded-full bg-raised px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-primary hover:text-on-primary">
                      {genre.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
