import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CategoryGroupOption } from "@/types/station-admin";

interface CategoryPickerProps {
  groups: CategoryGroupOption[];
  value: number[];
  onChange: (value: number[]) => void;
  max: number;
  disabled?: boolean;
}

/** Categories grouped by family; the order of selection is the order shown to listeners. */
export function CategoryPicker({ groups, value, onChange, max, disabled }: CategoryPickerProps) {
  const full = value.length >= max;

  const toggle = (id: number) => {
    if (value.includes(id)) onChange(value.filter((item) => item !== id));
    else if (!full) onChange([...value, id]);
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <fieldset key={group.value} className="space-y-2">
          <legend className="text-xs font-semibold tracking-wide text-muted uppercase">{group.label}</legend>
          <div className="flex flex-wrap gap-2">
            {group.categories.map((category) => {
              const position = value.indexOf(category.id);
              const selected = position !== -1;
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={disabled || (!selected && full)}
                  onClick={() => toggle(category.id)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm ring-1 transition disabled:cursor-not-allowed disabled:opacity-40",
                    selected ? "bg-primary text-on-primary ring-primary" : "bg-surface text-ink ring-line-strong hover:bg-raised",
                  )}
                >
                  {selected ? <span className="text-xs font-semibold tabular">{position + 1}</span> : null}
                  {category.name}
                  {selected && <Check className="size-3.5" aria-hidden />}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <p className="text-xs text-muted">
        {value.length}/{max} elegidas. {full ? "Quita una para elegir otra." : "La primera es la principal."}
      </p>
    </div>
  );
}
