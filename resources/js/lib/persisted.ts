import { useCallback, useState } from "react";

/** A yes/no preference kept in this browser (localStorage), such as a panel left open or closed. */
export function usePersistedFlag(key: string, initial: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    const stored = window.localStorage.getItem(key);
    return stored === null ? initial : stored === "1";
  });
  const update = useCallback(
    (next: boolean) => {
      window.localStorage.setItem(key, next ? "1" : "0");
      setValue(next);
    },
    [key],
  );
  return [value, update];
}

function storedList(key: string, max: number): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, max) : [];
  } catch {
    return [];
  }
}

/** A short list kept in this browser (localStorage), most recent first, such as the stickers used lately. */
export function usePersistedList(key: string, max: number): [string[], (value: string) => void] {
  const [list, setList] = useState(() => storedList(key, max));
  const remember = useCallback(
    (value: string) => {
      setList((current) => {
        const next = [value, ...current.filter((item) => item !== value)].slice(0, max);
        window.localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    },
    [key, max],
  );
  return [list, remember];
}
