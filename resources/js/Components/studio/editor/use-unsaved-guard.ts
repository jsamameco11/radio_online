import { router } from "@inertiajs/react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Asks before leaving with unsaved changes: the browser's own prompt when closing or reloading the tab,
 * and a dialog of ours for visits inside the studio. `allow()` lets the editor's own reloads through.
 */
export function useUnsavedGuard(active: boolean) {
  const leaving = useRef(false);
  const [resume, setResume] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!active) return;
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", unload);
    const off = router.on("before", (event) => {
      if (leaving.current) return;
      event.preventDefault();
      const visit = event.detail.visit;
      setResume(() => () =>
        router.visit(visit.url, { method: visit.method, data: visit.data, replace: visit.replace, preserveScroll: visit.preserveScroll, preserveState: visit.preserveState }),
      );
    });
    return () => {
      window.removeEventListener("beforeunload", unload);
      off();
    };
  }, [active]);

  const allow = useCallback((value = true) => {
    leaving.current = value;
  }, []);

  const proceed = useCallback(() => {
    if (!resume) return;
    leaving.current = true;
    setResume(null);
    resume();
  }, [resume]);

  const stay = useCallback(() => setResume(null), []);

  return { blocked: resume !== null, stay, proceed, allow };
}
