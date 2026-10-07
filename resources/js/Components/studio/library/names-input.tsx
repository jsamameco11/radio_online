import { X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useState } from "react";
import { Input } from "@/Components/ui/field";

interface Props {
  value: string[];
  onChange: (names: string[]) => void;
  max: number;
  placeholder?: string;
  prefix?: string;
  maxLength?: number;
  id?: string;
}

/** A short list of names (guest artists, hashtags): Enter or comma adds, × removes. */
export function NamesInput({ value, onChange, max, placeholder, prefix = "", maxLength = 120, id }: Props) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const name = draft.trim().replace(/^#/, "");
    if (name && value.length < max && !value.some((other) => other.toLowerCase() === name.toLowerCase())) onChange([...value, name]);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((name) => (
            <li key={name} className="inline-flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-line">
              {prefix}
              {name}
              <button type="button" onClick={() => onChange(value.filter((other) => other !== name))} aria-label={`Quitar ${name}`} className="rounded-full p-0.5 text-muted hover:text-ink">
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length < max && (
        <Input id={id} value={draft} maxLength={maxLength} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} onBlur={add} />
      )}
    </div>
  );
}
