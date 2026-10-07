import { usePage } from "@inertiajs/react";
import { AlertCircle } from "lucide-react";

/**
 * Validation errors of quick actions sent with router.post/put/delete (no
 * form on screen to show them next to a field), as one banner.
 */
export function PageErrors({ only }: { only?: string[] }) {
  const errors = usePage().props.errors as Record<string, string> | undefined;
  const messages = Object.entries(errors ?? {})
    .filter(([key]) => !only || only.includes(key.split(".")[0]))
    .map(([, message]) => message);

  if (messages.length === 0) return null;

  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <ul className="space-y-0.5">
        {[...new Set(messages)].map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
