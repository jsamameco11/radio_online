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
