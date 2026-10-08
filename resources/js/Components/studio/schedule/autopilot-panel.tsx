import { Repeat } from "lucide-react";
import { useEffect, useState } from "react";
import { sourceLabel } from "@/Components/studio/console/labels";
import { FallbackNotice, PendingSwitch, SourcePicker, SwitchScheduler } from "@/Components/studio/console/source-picker";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Panel } from "@/Components/ui/panel";
import { clock } from "@/lib/radio/format";
import type { Autopilot, BroadcastPlaylist } from "@/types/studio";
import { ActionNotice } from "./action-notice";
import { useScheduleAction } from "./use-schedule-action";

/** The station's automatic music: what fills every space without a block, on or off, repeating or once. */
export function AutopilotPanel({ musicUrl, autopilot, playlists, now, timezone }: { musicUrl: string; autopilot: Autopilot; playlists: BroadcastPlaylist[]; now: number; timezone: string }) {
  const [playlist, setPlaylist] = useState(autopilot.playlist);
  const [shuffle, setShuffle] = useState(autopilot.shuffle);
  const { result, setResult, pending, run } = useScheduleAction();
  const changed = playlist !== autopilot.playlist || shuffle !== autopilot.shuffle;
  const scheduled = autopilot.pending !== null && autopilot.since > now;
  const on = !autopilot.paused;
  const status = !on ? "Detenida" : autopilot.finished ? "Terminó" : autopilot.level === "none" ? "Sin canciones" : "Activa";

  useEffect(() => {
    setPlaylist(autopilot.playlist);
    setShuffle(autopilot.shuffle);
  }, [autopilot.playlist, autopilot.shuffle]);

  function toggleOn() {
    if (on && !window.confirm("¿Detener la música automática? Lo que no esté programado quedará en silencio.")) return;
    void run("put", `${musicUrl}/continua`, { on: !on });
  }

  return (
    <Panel title="Música automática" actions={<Badge tone={status === "Activa" ? "onair" : status === "Detenida" ? "neutral" : "warning"}>{status}</Badge>}>
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">
            {on ? "Suena" : "Elegida"}: {scheduled ? autopilot.pending?.label : sourceLabel(playlists, autopilot.playlist, autopilot.shuffle)}
          </p>
          <p className="text-sm text-muted">
            {!on
              ? "Detenida: solo suena lo programado y lo demás es silencio."
              : autopilot.finished
                ? "Ya sonó completa y «Repetir» está apagado: la radio está en silencio."
                : autopilot.repeat
                  ? "Se repite: al terminar vuelve a empezar."
                  : `Una sola vez${autopilot.until ? `: termina a las ${clock(autopilot.until, timezone)}` : ""} y luego silencio.`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant={on ? "secondary" : "signal"} disabled={pending} onClick={toggleOn}>
            {on ? "Detener" : "Activar"}
          </Button>
          <Button
            variant={autopilot.repeat ? "secondary" : "ghost"}
            icon={<Repeat className="size-4" />}
            aria-pressed={autopilot.repeat}
            disabled={pending}
            onClick={() => void run("put", `${musicUrl}/repetir`, { on: !autopilot.repeat })}
            title={autopilot.repeat ? "Al terminar, vuelve a empezar. Clic para que suene una sola vez." : "Suena una sola vez y luego silencio. Clic para que se repita."}
          >
            Repetir: {autopilot.repeat ? "sí" : "no"}
          </Button>
        </div>

        <p className="text-xs text-muted">Llena los espacios libres y los bloques en vivo sin nadie conectado. Los periodos de «Música automática» usan su propia lista. Si la lista elegida se queda sin canciones, la radio queda en silencio: solo suena lo que configures.</p>
        <PendingSwitch autopilot={autopilot} now={now} timezone={timezone} busy={pending} onCancel={() => void run("delete", `${musicUrl}/cambio`)} />
        <FallbackNotice autopilot={autopilot} />
        <SourcePicker
          playlists={playlists}
          playlist={playlist}
          shuffle={shuffle}
          onChange={(nextPlaylist, nextShuffle) => {
            setPlaylist(nextPlaylist);
            setShuffle(nextShuffle);
          }}
        />
        <ActionNotice result={result} onClose={() => setResult(null)} />
        {changed ? (
          <SwitchScheduler
            musicUrl={musicUrl}
            target={sourceLabel(playlists, playlist, shuffle)}
            now={now}
            timezone={timezone}
            busy={pending}
            onConfirm={(timing) => void run("put", `${musicUrl}/fuente`, { playlist, shuffle, ...timing })}
            onClose={() => {
              setPlaylist(autopilot.playlist);
              setShuffle(autopilot.shuffle);
            }}
          />
        ) : (
          <p className="text-xs text-muted">Elige otra lista o canciones aleatorias para programar el cambio: entra al terminar la canción que suena o en el punto que elijas, sin cortes.</p>
        )}
      </div>
    </Panel>
  );
}
