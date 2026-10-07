import { router } from "@inertiajs/react";
import { useCallback, useState } from "react";
import { http, HttpError } from "@/lib/http";

export type ActionResult = { tone: "error" | "info"; text: string; errors?: Record<string, string> } | null;

/** Props of the schedule page that change after an edit of the timeline. */
const RELOAD = ["blocks", "dayEnds", "days", "autopilot"];

/**
 * Sends a schedule action and, when it is saved, reloads the day (partial reload) and shows the
 * server's message; on failure it keeps the validation messages per field.
 */
export function useScheduleAction() {
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, setPending] = useState(false);

  const run = useCallback(async (method: "post" | "put" | "delete", url: string, body?: unknown): Promise<boolean> => {
    setPending(true);
    setResult(null);
    try {
      const data = await http[method]<{ message?: string }>(url, body);
      setResult(data.message ? { tone: "info", text: data.message } : null);
      router.reload({ only: RELOAD });
      return true;
    } catch (error) {
      if (error instanceof HttpError) {
        const errors = Object.fromEntries(Object.entries(error.body.errors ?? {}).map(([key, messages]) => [key, messages[0]]));
        setResult({ tone: "error", text: error.firstError(), errors });
      } else {
        setResult({ tone: "error", text: "No hubo conexión con el servidor. Inténtalo de nuevo." });
      }
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  return { result, setResult, pending, run };
}
