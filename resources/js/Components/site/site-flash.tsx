import { usePage } from "@inertiajs/react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { statusMessage } from "@/lib/status-messages";
import type { SharedProps } from "@/types";

/** Inline confirmation for auth screens that receive Fortify's status as a prop. */
export function StatusNotice({ status }: { status: string | null }) {
  const message = statusMessage(status);
  if (!message) return null;

  return (
    <p role="status" className="mb-6 flex items-start gap-2.5 rounded-xl bg-onair-soft px-4 py-3 text-sm text-ink">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-onair" />
      {message}
    </p>
  );
}

/** Session flash as a toast for a few seconds, with Fortify statuses translated. */
export function SiteFlash({ withStatus = true }: { withStatus?: boolean }) {
  const { flash } = usePage<SharedProps>().props;
  const message = flash.error ?? flash.success ?? (withStatus ? statusMessage(flash.status) : null);
  const isError = Boolean(flash.error);
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message) return;
    const timer = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!visible || !message) return null;

  return (
    <div role="status" className="flex max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-xl">
      {isError ? <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-onair" />}
      <p className="flex-1">{message}</p>
      <button type="button" onClick={() => setVisible(false)} className="text-muted hover:text-ink" aria-label="Cerrar">
        <X className="size-4" />
      </button>
    </div>
  );
}
