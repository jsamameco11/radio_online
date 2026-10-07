import { useEffect, useState } from "react";
import { http } from "@/lib/http";
import type { ProgramItem } from "@/types/studio";

/**
 * What will sound between two moments, song by song (the automatic music already resolved). Loads
 * again when `version` changes (the timeline was edited) and every `refreshMs`. Null while loading.
 */
export function useDayProgram(lineUrl: string, from: number, to: number, version: string, refreshMs = 120_000): ProgramItem[] | null {
  const [items, setItems] = useState<ProgramItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      http
        .get<{ items: ProgramItem[] }>(`${lineUrl}?desde=${from}&hasta=${to}`)
        .then((data) => alive && setItems(data.items))
        .catch(() => alive && setItems([]));
    setItems(null);
    void load();
    const timer = window.setInterval(() => void load(), refreshMs);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [lineUrl, from, to, version, refreshMs]);

  return items;
}
