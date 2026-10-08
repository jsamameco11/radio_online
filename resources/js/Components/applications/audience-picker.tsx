import { Check, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/Components/ui/field";
import { Tabs } from "@/Components/ui/tabs";
import { cn } from "@/lib/cn";
import type { AudienceTagGroup } from "@/types/applications";
import type { Option } from "@/types/site";

interface AudiencePickerProps {
  groups: AudienceTagGroup[];
  value: string[];
  onChange: (value: string[]) => void;
  max: number;
  invalid?: boolean;
}

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Audience tags by family, with a search across all of them; the selection keeps the catalog order. */
export function AudiencePicker({ groups, value, onChange, max, invalid = false }: AudiencePickerProps) {
  const [group, setGroup] = useState(groups[0]?.value ?? "");
  const [query, setQuery] = useState("");
  const all = useMemo(() => groups.flatMap((item) => item.options), [groups]);
  const full = value.length >= max;

  const wanted = fold(query.trim());
  const shown: Option[] = wanted === "" ? (groups.find((item) => item.value === group)?.options ?? []) : all.filter((option) => fold(option.label).includes(wanted));
  const chosen = all.filter((option) => value.includes(option.value));

  const toggle = (tag: string) => {
    if (value.includes(tag)) onChange(value.filter((item) => item !== tag));
    else if (!full) onChange(all.map((option) => option.value).filter((item) => item === tag || value.includes(item)));
  };

  return (
    <div className={cn("space-y-4 rounded-2xl border p-4", invalid ? "border-danger" : "border-line")}>
      {chosen.length > 0 && (
        <ul aria-label="Público elegido" className="flex flex-wrap gap-1.5">
          {chosen.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => toggle(option.value)}
                aria-label={`Quitar ${option.label}`}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-primary pr-2 pl-3 text-xs font-medium text-on-primary transition hover:opacity-85"
              >
                {option.label}
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar: estudiantes, cumbia, migrantes…" className="pl-9" aria-label="Buscar tipo de público" />
      </div>

      {wanted === "" && (
        <Tabs
          value={group}
          onChange={setGroup}
          items={groups.map((item) => ({ value: item.value, label: item.label, count: item.options.filter((option) => value.includes(option.value)).length || undefined }))}
        />
      )}

      {shown.length === 0 ? (
        <p className="py-2 text-sm text-muted">No hay etiquetas que coincidan con «{query.trim()}».</p>
      ) : (
        <div role="group" aria-label="Tipos de público" className="flex flex-wrap gap-2">
          {shown.map((option) => {
            const selected = value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                disabled={!selected && full}
                onClick={() => toggle(option.value)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm ring-1 transition disabled:cursor-not-allowed disabled:opacity-40",
                  selected ? "bg-primary text-on-primary ring-primary" : "bg-surface text-ink ring-line-strong hover:bg-raised",
                )}
              >
                {selected && <Check className="size-3.5" aria-hidden />}
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      <p className={cn("text-xs", full ? "text-warning" : "text-muted")}>
        <span className="tabular">
          {value.length}/{max}
        </span>{" "}
        elegidos. {full ? "Quita uno para elegir otro." : "Combina perfiles, lugares, gustos e intereses."}
      </p>
    </div>
  );
}
