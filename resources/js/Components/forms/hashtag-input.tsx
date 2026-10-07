import { Hash, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useState } from "react";
import { cn } from "@/lib/cn";

interface HashtagInputProps {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  max: number;
  maxLength: number;
  suggestions?: string[];
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

function clean(raw: string): string {
  return raw.trim().replace(/^#+/, "").replace(/\s+/g, "");
}

/** Chips of hashtags: type and press Enter, comma or space; Backspace removes the last one. */
export function HashtagInput({ id, value, onChange, max, maxLength, suggestions = [], invalid, disabled, placeholder = "Escribe y presiona Enter" }: HashtagInputProps) {
  const [draft, setDraft] = useState("");
  const full = value.length >= max;
  const has = (tag: string) => value.some((item) => item.toLowerCase() === tag.toLowerCase());

  const add = (raw: string) => {
    const tag = clean(raw).slice(0, maxLength);
    setDraft("");
    if (!tag || full || has(tag)) return;
    onChange([...value, tag]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", " "].includes(event.key)) {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const available = suggestions.filter((tag) => !has(tag));

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-2 py-1.5 transition focus-within:border-ink",
          invalid && "border-danger",
          disabled && "opacity-60",
        )}
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-raised px-2.5 py-0.5 text-xs font-medium text-ink ring-1 ring-line">
            #{tag}
            {!disabled && (
              <button type="button" onClick={() => onChange(value.filter((item) => item !== tag))} className="text-muted hover:text-danger" aria-label={`Quitar #${tag}`}>
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {!full && !disabled && (
          <span className="flex min-w-32 flex-1 items-center gap-1 text-faint">
            <Hash className="size-3.5" aria-hidden />
            <input
              id={id}
              value={draft}
              maxLength={maxLength + 1}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => draft && add(draft)}
              placeholder={value.length === 0 ? placeholder : ""}
              aria-invalid={invalid || undefined}
              className="h-7 w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
            />
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        {available.length > 0 && !full && !disabled ? (
          <span className="flex flex-wrap items-center gap-1.5">
            Sugeridos:
            {available.slice(0, 8).map((tag) => (
              <button key={tag} type="button" onClick={() => add(tag)} className="rounded-full px-2 py-0.5 ring-1 ring-line hover:bg-raised hover:text-ink">
                #{tag}
              </button>
            ))}
          </span>
        ) : (
          <span />
        )}
        <span className="tabular">
          {value.length}/{max}
        </span>
      </div>
    </div>
  );
}
