import { Button } from "@/Components/ui/button";
import { preciseTime } from "@/lib/media/editor/recipe";

/** A few seconds of the final result rendered by the server, with what only the server applies. */
export function SamplePanel({ url, at, seconds, serverOnly, onClose }: { url: string; at: number; seconds: number; serverOnly: string[]; onClose: () => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-info/30 bg-info-soft p-4 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-info">Muestra del resultado final</p>
        <p className="text-xs text-muted">
          {seconds} segundos desde el {preciseTime(at)} del audio editado, procesados en el servidor exactamente como quedarán
          {serverOnly.length ? ` (incluye ${serverOnly.join(" y ")})` : ""}.
        </p>
      </div>
      <audio src={url} controls autoPlay className="w-full md:w-96" />
      <Button size="sm" variant="ghost" onClick={onClose}>
        Cerrar
      </Button>
    </section>
  );
}
