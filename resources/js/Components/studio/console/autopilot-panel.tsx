import { Play, Repeat } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Field } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import { clock, currentItem, shortTitle } from "@/lib/radio/format";
import type { BroadcastPlaylist, BroadcastTrack } from "@/types/studio";
import { SourcePicker } from "./source-picker";
import { TrackPicker } from "./track-picker";
import type { ConsoleApi } from "./use-console";

/**
 * «Iniciar música automática»: what it plays (a list or random songs) and the song it starts with.
 * Every listener hears it within seconds; the song on air fades out under it. «Repetir» starts the
 * source over at its end (off: one time, then silence).
 */
export function AutopilotPanel({ api, playlists, library, timezone }: { api: ConsoleApi; playlists: BroadcastPlaylist[]; library: BroadcastTrack[]; timezone: string }) {
  const { snapshot, now } = api;
  const { autopilot, config, radio } = snapshot;
  const [playlist, setPlaylist] = useState(autopilot.playlist ?? playlists.find((item) => item.songs > 0)?.id ?? null);
  const [shuffle, setShuffle] = useState(autopilot.playlist ? autopilot.shuffle : true);
  const [first, setFirst] = useState("");
  const [busy, setBusy] = useState(false);
  const cut = radio.live.cut;
  const silent = autopilot.level === "none";
  const running = config.on_air && config.autofill && !cut && !autopilot.finished && !silent;
  const current = currentItem(radio.queue, now);
  const automatic = current && current.kind === "song" && !current.slot && !current.block ? current : null;
  const status = running ? "Sonando" : cut ? "En vivo" : !config.on_air ? "Fuera del aire" : !config.autofill ? "Detenida" : autopilot.finished ? "Terminó" : "Sin canciones";

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    await action();
    setBusy(false);
  }

  async function start() {
    if (cut && !window.confirm("Estás al aire en vivo. ¿Volver a la música automática ahora?")) return;
    await act(() => api.startAutopilot(playlist, shuffle, first || null, autopilot.repeat));
    setFirst("");
  }

  return (
    <Panel dense title="Música automática" actions={<Badge tone={running ? "onair" : autopilot.finished || silent ? "warning" : "neutral"}>{status}</Badge>}>
      <div className="space-y-2.5">
        <p className="text-xs break-words text-muted" title={automatic?.title}>
          {running && automatic ? (
            <>
              Ahora: <span className="text-ink">{shortTitle(automatic.title, 48)}</span> · {autopilot.label}
            </>
          ) : running ? (
            `Sigue: ${autopilot.label}`
          ) : !config.autofill ? (
            "Solo suena lo programado; lo demás es silencio."
          ) : autopilot.finished ? (
            `«${autopilot.label}» ya sonó completa. Silencio hasta que la inicies o actives «Repetir».`
          ) : (
            "Elige qué suena y la canción de partida."
          )}
          {running && autopilot.until ? <span className="block text-warning">Sin repetir · termina a las {clock(autopilot.until, timezone)}, luego silencio.</span> : null}
        </p>

        <Button
          size="sm"
          variant={autopilot.repeat ? "secondary" : "ghost"}
          icon={<Repeat className="size-3.5" />}
          aria-pressed={autopilot.repeat}
          disabled={busy}
          onClick={() => void act(() => api.setRepeat(!autopilot.repeat))}
          title={autopilot.repeat ? "Al terminar, vuelve a empezar. Clic para que suene una sola vez." : "Suena una sola vez y luego silencio. Clic para que se repita."}
        >
          Repetir: {autopilot.repeat ? "sí" : "no"}
        </Button>

        <SourcePicker
          playlists={playlists}
          playlist={playlist}
          shuffle={shuffle}
          onChange={(nextPlaylist, nextShuffle) => {
            setPlaylist(nextPlaylist);
            setShuffle(nextShuffle);
          }}
        />
        <Field label="Canción de partida" hint={playlist ? "Debe estar en la lista elegida." : undefined}>
          {(id) => <TrackPicker id={id} library={library} value={first} onChange={setFirst} kinds={["song"]} placeholder={playlist && !shuffle ? "Desde la primera de la lista" : "Cualquiera (al azar)"} />}
        </Field>
        <Button size="sm" className="w-full" variant="signal" icon={<Play className="size-3.5" />} loading={busy} onClick={() => void start()} title="Suena para todos los oyentes en unos segundos">
          {running ? "Empezar ahora" : "Iniciar música automática"}
        </Button>
      </div>
    </Panel>
  );
}
