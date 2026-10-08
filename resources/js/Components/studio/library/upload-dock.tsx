import { Link } from "@inertiajs/react";
import { ArrowRight, Minus, Upload as UploadIcon, X } from "lucide-react";
import { useState } from "react";
import { ProgressBar } from "@/Components/studio/upload/progress-bar";
import { Button } from "@/Components/ui/button";
import { cn } from "@/lib/cn";
import { uploadQueue, useUploadQueue } from "./upload-queue";

/**
 * The library's upload seen from any other section of the studio: how far it is, what is going up and whether
 * something waits for the user, with the way back to it; and its summary once it ends.
 */
export function UploadDock() {
  const { queue, auto, notice, viewing, base } = useUploadQueue();
  const [folded, setFolded] = useState(false);
  if (viewing || !base || (!queue.length && !notice?.final)) return null;

  const { done, total, sending, working, waiting } = uploadQueue.summary();
  const title = !queue.length ? "Subida terminada" : !auto ? "Subida en pausa" : working ? "Subiendo audios a la biblioteca" : "La subida espera por ti";
  const shell = "fixed bottom-4 left-4 z-40 lg:left-72";

  if (folded) {
    return (
      <button
        type="button"
        onClick={() => setFolded(false)}
        className={cn(shell, "flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-2xl transition hover:bg-raised")}
        aria-label="Mostrar la subida de audios"
      >
        <span className={cn("size-2 rounded-full", auto && working ? "animate-pulse bg-onair" : waiting ? "bg-warning" : "bg-faint")} aria-hidden />
        {queue.length ? `${done} de ${total} subidos` : "Subida terminada"}
      </button>
    );
  }

  return (
    <section className={cn(shell, "w-88 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface/95 p-4 text-ink shadow-2xl backdrop-blur")} role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-signal-soft text-signal">
            <UploadIcon className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            {queue.length > 0 && (
              <p className="mt-0.5 text-xs text-muted">
                {done} de {total} en la biblioteca · sigue aunque cambies de sección o de pestaña
              </p>
            )}
          </div>
        </div>
        <Button size="icon" variant="ghost" className="size-7" onClick={() => (queue.length ? setFolded(true) : uploadQueue.setNotice(null))} aria-label={queue.length ? "Minimizar" : "Cerrar"}>
          {queue.length ? <Minus className="size-4" /> : <X className="size-4" />}
        </Button>
      </div>

      {queue.length ? (
        <>
          <ProgressBar value={total ? done / total : 0} tone="onair" className="mt-3 h-2" />
          {sending && (
            <p className="mt-2 truncate text-xs text-muted">
              Subiendo «{sending.title.trim() || sending.file.name}» · {Math.round(sending.progress * 100)}%
            </p>
          )}
          {waiting > 0 && <p className="mt-2 rounded-lg bg-warning-soft px-2.5 py-1.5 text-xs font-medium text-warning">{waiting === 1 ? "1 audio espera" : `${waiting} audios esperan`} tus datos o tu veredicto; el resto sigue subiendo.</p>}
        </>
      ) : (
        <p className={cn("mt-2 rounded-lg px-2.5 py-1.5 text-sm", notice?.tone === "warn" ? "bg-warning-soft text-warning" : "bg-onair-soft text-onair")}>{notice?.text}</p>
      )}

      <Link href={`${base}/biblioteca`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-signal hover:underline">
        {queue.length ? "Ver la subida" : "Ver la biblioteca"} <ArrowRight className="size-3.5" />
      </Link>
    </section>
  );
}
