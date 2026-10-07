import { usePage } from "@inertiajs/react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { SharedProps } from "@/types";

/** Shows the session flash ("success" / "error" / "status") as a toast for a few seconds. */
export function Flash() {
  const { flash } = usePage<SharedProps>().props;
  const message = flash.error ?? flash.success ?? flash.status;
  const isError = Boolean(flash.error);
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message) return;
    const timer = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!visible || !message) return null;

  return (
    <div role="status" className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-xl">
      {isError ? <AlertCircle className="mt-0.5 size-5 text-danger" /> : <CheckCircle2 className="mt-0.5 size-5 text-onair" />}
      <p className="flex-1">{message}</p>
      <button type="button" onClick={() => setVisible(false)} className="text-muted hover:text-ink" aria-label="Cerrar">
        <X className="size-4" />
      </button>
    </div>
  );
}
