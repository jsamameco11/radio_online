import { Flag, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/Components/ui/button";
import { Textarea } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import { http, HttpError } from "@/lib/http";
import type { StationStories } from "@/types/stories";

interface StoryReportProps {
  url: string;
  reasons: StationStories["report_reasons"];
  onClose: () => void;
}

/** Sheet over a story to flag it for the moderation team. */
export function StoryReport({ url, reasons, onClose }: StoryReportProps) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const response = await http.post<{ message: string }>(url, { reason, details });
      setThanks(response.message);
    } catch (failure) {
      setError(failure instanceof HttpError ? failure.firstError() : "No pudimos enviar el reporte. Inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 max-h-[80%] overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 text-ink shadow-2xl" role="region" aria-label="Reportar estado">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Flag className="size-4 text-danger" aria-hidden /> Reportar este estado
          </h2>
          <p className="mt-1 text-xs text-muted">Tu reporte es confidencial. El equipo de moderación lo revisará.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-raised hover:text-ink" aria-label="Cerrar">
          <X className="size-5" />
        </button>
      </div>
      {thanks ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-onair-soft px-4 py-3 text-sm text-onair">{thanks}</p>
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Volver al estado
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Motivo">
            {reasons.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={reason === option.value}
                onClick={() => setReason(option.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  reason === option.value ? "border-danger bg-danger-soft text-danger" : "border-line-strong text-muted hover:text-ink",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {reason === "other" && <Textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} placeholder="Cuéntanos qué ocurre" aria-label="Detalle" />}
          {error && (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="danger" className="w-full" loading={sending} disabled={reason === ""}>
            Enviar reporte
          </Button>
        </form>
      )}
    </div>
  );
}
