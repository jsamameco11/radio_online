import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ActionResult } from "./use-schedule-action";

export function ActionNotice({ result, onClose }: { result: ActionResult; onClose: () => void }) {
  if (!result) return null;
  return (
    <div role="status" className={cn("flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-sm", result.tone === "error" ? "bg-danger-soft text-danger" : "bg-onair-soft text-onair")}>
      <p>{result.text}</p>
      <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
        <X className="size-4" />
      </button>
    </div>
  );
}
