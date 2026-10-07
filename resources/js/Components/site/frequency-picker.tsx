import { Search, Shuffle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/Components/ui/button";
import { cn } from "@/lib/cn";
import type { DialBand } from "@/types/site";

export interface FreeFrequency {
  id: number;
  label: string;
  slug: string;
}

interface FrequencyPickerProps {
  frequencies: FreeFrequency[];
  band: DialBand;
  value: number | null;
  onChange: (id: number) => void;
  invalid?: boolean;
}

/** "89,3", "89-30" or "89.3 fm" all become "89.3" to compare with labels. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/fm/g, "").replace(/[,-]/g, ".").replace(/\s+/g, "");
}

/** Free frequencies of the dial grouped by MHz, with search, a band overview and a random pick. */
export function FrequencyPicker({ frequencies, band, value, onChange, invalid = false }: FrequencyPickerProps) {
  const [query, setQuery] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const selected = frequencies.find((frequency) => frequency.id === value) ?? null;

  const groups = useMemo(() => {
    const wanted = normalize(query);
    const matches = wanted === "" ? frequencies : frequencies.filter((frequency) => frequency.label.startsWith(wanted));
    const byMhz = new Map<number, FreeFrequency[]>();
    for (const frequency of matches) {
      const mhz = Math.floor(Number(frequency.label));
      byMhz.set(mhz, [...(byMhz.get(mhz) ?? []), frequency]);
    }
    return [...byMhz.entries()];
  }, [frequencies, query]);

  useEffect(() => {
    if (selected) list.current?.querySelector(`[data-frequency="${selected.slug}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const random = () => {
    const pick = frequencies[Math.floor(Math.random() * frequencies.length)];
    if (pick) {
      setQuery("");
      onChange(pick.id);
    }
  };

  const span = band.max - band.min;

  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-surface", invalid ? "border-danger" : "border-line-strong")}>
      <div className="flex items-center gap-4 border-b border-line bg-raised px-4 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Tu frecuencia</p>
          <p className="font-display text-3xl font-semibold tabular">
            {selected ? (
              <>
                {selected.label} <span className="text-base text-muted">{band.name}</span>
              </>
            ) : (
              <span className="text-faint">--.--</span>
            )}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={random} icon={<Shuffle className="size-3.5" />}>
          Sorpréndeme
        </Button>
      </div>
      <div className="relative h-8 border-b border-line" aria-hidden>
        {frequencies.map((frequency) => (
          <span
            key={frequency.id}
            className={cn("absolute top-2 h-4 w-px", frequency.id === value ? "z-10 h-6 w-0.5 bg-signal" : "bg-line-strong")}
            style={{ left: `${((Number(frequency.label) - band.min) / span) * 100}%` }}
          />
        ))}
      </div>
      <div className="relative border-b border-line">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Busca un número, por ejemplo 99.5"
          aria-label="Buscar frecuencia libre"
          inputMode="decimal"
          className="h-11 w-full bg-transparent pr-4 pl-11 text-sm focus:outline-none"
        />
      </div>
      <div ref={list} className="max-h-72 space-y-3 overflow-y-auto p-4" role="radiogroup" aria-label="Frecuencias libres">
        {groups.length === 0 && <p className="py-6 text-center text-sm text-muted">No hay frecuencias libres con ese número.</p>}
        {groups.map(([mhz, items]) => (
          <div key={mhz} className="flex gap-3">
            <span className="w-10 shrink-0 pt-1.5 text-right font-display text-sm font-semibold text-faint tabular">{mhz}</span>
            <div className="flex flex-wrap gap-1.5">
              {items.map((frequency) => (
                <button
                  key={frequency.id}
                  type="button"
                  role="radio"
                  aria-checked={frequency.id === value}
                  data-frequency={frequency.slug}
                  onClick={() => onChange(frequency.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-sm font-medium tabular transition",
                    frequency.id === value ? "bg-signal text-white" : "bg-raised text-ink ring-1 ring-line hover:ring-ink",
                  )}
                >
                  {frequency.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
