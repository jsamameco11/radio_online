import { Link } from "@inertiajs/react";
import { AlertTriangle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { duration } from "@/lib/format";
import { longDuration } from "@/lib/radio/format";
import type { Autopilot, BroadcastTrack } from "@/types/studio";
import { ActionNotice } from "./action-notice";
import { useScheduleAction } from "./use-schedule-action";

/** «Música continua»: the songs of the library that repeat on their own in the random automatic music. */
export function RotationPanel({ rotationUrl, tracks, autopilot, crossfade }: { rotationUrl: string; tracks: BroadcastTrack[]; autopilot: Autopilot; crossfade: number }) {
  const url = useStudioUrl();
  const can = useStudioCan();
  const songs = useMemo(() => tracks.filter((track) => track.kind === "song"), [tracks]);
  const [chosen, setChosen] = useState(() => new Set(songs.filter((track) => track.rotation).map((track) => track.id)));
  const [query, setQuery] = useState("");
  const { result, setResult, pending, run } = useScheduleAction();
  const needle = query.trim().toLowerCase();
  const shown = songs.filter((track) => `${track.title} ${track.artist ?? ""}`.toLowerCase().includes(needle));
  const picked = songs.filter((track) => chosen.has(track.id));
  const length = picked.reduce((sum, track) => sum + track.duration, 0);
  const changed = songs.some((track) => track.rotation !== chosen.has(track.id));

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Panel title="Música continua" description="Canciones que se repiten solas en la música automática.">
      <div className="space-y-3">
        <p className="text-xs leading-5 text-muted">
          Las canciones marcadas se suman a «Canciones aleatorias»: junto con tus listas llenan los espacios libres de la pista principal, en orden variado y empalmadas{" "}
          {crossfade > 0 ? `con ${crossfade} s de fundido` : "sin fundido"}.
          {autopilot.playlist ? " Ahora la música automática toca una lista: estas canciones suenan cuando vuelva a «Canciones aleatorias»." : ""}
          {autopilot.paused ? " Ahora está en pausa." : ""}
        </p>

        {songs.length ? (
          <>
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar canción…" aria-label="Buscar canción de la música continua" className="pl-9" />
              </div>
              <Button size="sm" variant="ghost" onClick={() => setChosen(new Set(songs.map((track) => track.id)))}>
                Todas
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setChosen(new Set())}>
                Ninguna
              </Button>
            </div>
            <ul className="max-h-60 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {shown.map((track) => (
                <li key={track.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-raised">
                    <input type="checkbox" className="size-4 shrink-0 accent-signal" checked={chosen.has(track.id)} onChange={() => toggle(track.id)} />
                    <span className="min-w-0 flex-1 truncate">
                      {track.title}
                      {track.artist ? <span className="text-muted"> · {track.artist}</span> : null}
                    </span>
                    {!track.playable ? <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-label="El archivo tiene un problema: no sonará" /> : null}
                    <span className="shrink-0 font-mono text-xs text-muted tabular">{duration(track.duration)}</span>
                  </label>
                </li>
              ))}
              {shown.length === 0 ? <li className="px-3 py-3 text-sm text-muted">Sin resultados.</li> : null}
            </ul>
            <p className="text-xs text-muted">
              {chosen.size} de {songs.length} canciones · {longDuration(length)} antes de repetir
            </p>
            {chosen.size === 1 ? <p className="text-xs font-medium text-warning">Con una sola canción, sonará una y otra vez sin parar.</p> : null}
            <ActionNotice result={result} onClose={() => setResult(null)} />
            <Button className="w-full" loading={pending} disabled={!changed} onClick={() => void run("put", rotationUrl, { tracks: [...chosen] }, ["tracks", "autopilot"])}>
              Guardar música continua
            </Button>
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
            Aún no hay canciones.{" "}
            {can("library.manage") ? (
              <Link href={url("/biblioteca")} className="font-semibold text-ink underline hover:text-signal">
                Súbelas a la biblioteca
              </Link>
            ) : (
              "Súbelas a la biblioteca"
            )}{" "}
            y elígelas aquí.
          </p>
        )}
      </div>
    </Panel>
  );
}
