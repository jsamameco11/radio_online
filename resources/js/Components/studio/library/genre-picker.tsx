import { X } from "lucide-react";
import { Select } from "@/Components/ui/field";
import type { GenreBrief, Option } from "@/types/media";

interface Props {
  genres: GenreBrief[];
  families: Option[];
  value: string[];
  max: number;
  onChange: (ids: string[]) => void;
  id?: string;
}

/** Up to `max` genres of the shared catalog, in order: the first one is the main genre. */
export function GenrePicker({ genres, families, value, max, onChange, id }: Props) {
  const byId = new Map(genres.map((genre) => [genre.id, genre]));
  const chosen = value.map((genreId) => byId.get(genreId)).filter((genre): genre is GenreBrief => Boolean(genre));

  return (
    <div className="space-y-2">
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chosen.map((genre, index) => (
            <li key={genre.id} className="inline-flex items-center gap-1 rounded-full bg-signal-soft px-2.5 py-1 text-xs font-medium text-signal">
              {index === 0 && <span className="text-[0.65rem] tracking-wide uppercase opacity-70">Principal ·</span>}
              {genre.name}
              <button type="button" onClick={() => onChange(value.filter((other) => other !== genre.id))} aria-label={`Quitar ${genre.name}`} className="rounded-full p-0.5 hover:bg-signal/20">
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {chosen.length < max && (
        <Select
          id={id}
          value=""
          onChange={(event) => event.target.value && onChange([...value, event.target.value])}
        >
          <option value="">{chosen.length === 0 ? "Elige un género…" : "Agregar otro género…"}</option>
          {families.map((family) => (
            <optgroup key={family.value} label={family.label}>
              {genres
                .filter((genre) => genre.family === family.value && !value.includes(genre.id))
                .map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      )}
    </div>
  );
}
