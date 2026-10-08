import { Eject, FolderOpen, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/Components/ui/button";
import type { DjEngine } from "@/lib/dj/engine";
import { DJ_KINDS, fileSource, trackSource } from "@/lib/dj/sources";
import type { DeckId, DeckState } from "@/lib/dj/types";
import type { BroadcastTrack } from "@/types/studio";
import { TrackPicker } from "../../console/track-picker";

/** Loads a deck from the library or from a file of this computer, and ejects it. */
export function DeckLoader({ engine, id, deck, library }: { engine: DjEngine; id: DeckId; deck: DeckState; library: BroadcastTrack[] }) {
  const [trackId, setTrackId] = useState("");
  const file = useRef<HTMLInputElement>(null);

  function loadPicked() {
    const source = trackSource(library.find((item) => item.id === trackId));
    if (source) void engine.load(id, source);
  }

  function loadFile(chosen: File | undefined) {
    if (chosen) void engine.load(id, fileSource(chosen));
    if (file.current) file.current.value = "";
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        <TrackPicker library={library} value={trackId} onChange={setTrackId} kinds={DJ_KINDS} placeholder="Elige una pista…" className="h-9 min-w-0 flex-1 rounded-lg text-xs" label={`Pista para el deck ${id + 1}`} />
        <Button size="sm" variant="secondary" icon={<Upload className="size-3.5" />} disabled={!trackId || deck.loading} onClick={loadPicked} className="h-9">
          Cargar
        </Button>
        <Button size="icon" variant="ghost" onClick={() => file.current?.click()} title="Cargar un archivo de tu equipo" aria-label={`Cargar un archivo en el deck ${id + 1}`} className="size-9 rounded-lg">
          <FolderOpen className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" disabled={!deck.track || deck.playing} onClick={() => engine.eject(id)} title="Expulsar" aria-label={`Expulsar el deck ${id + 1}`} className="size-9 rounded-lg">
          <Eject className="size-4" />
        </Button>
        <input ref={file} type="file" accept="audio/*" className="hidden" onChange={(event) => loadFile(event.target.files?.[0])} />
      </div>
      {deck.error ? <p className="text-xs text-danger">{deck.error}</p> : null}
    </div>
  );
}
