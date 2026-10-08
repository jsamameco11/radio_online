import { Link } from "@inertiajs/react";
import { Play, Repeat, Square } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Field, Select } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import { duration } from "@/lib/format";
import { clock, currentItem, shortTitle } from "@/lib/radio/format";
import type { BroadcastPlaylist, BroadcastTrack } from "@/types/studio";
import { SourcePicker } from "./source-picker";
import { TrackPicker } from "./track-picker";
import type { ConsoleApi } from "./use-console";

/**
 * «Iniciar música automática»: what it plays (a list or random songs) and the song it starts with
 * (with a list, one of its songs in its order). Every listener hears it within seconds; the song on
 * air fades out under it. «Al terminar» says whether the source starts over or ends in silence.
 */
export function AutopilotPanel({ api, playlists, playlistSongs, library, timezone }: { api: ConsoleApi; playlists: BroadcastPlaylist[]; playlistSongs: Record<string, string[]>; library: BroadcastTrack[]; timezone: string }) {
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
  const chosen = playlists.find((item) => item.id === playlist) ?? null;
  const songs = useMemo(() => {
    if (!playlist) return [];
    const byId = new Map(library.map((track) => [track.id, track]));
    return (playlistSongs[playlist] ?? []).map((id) => byId.get(id)).filter((track): track is BroadcastTrack => track !== undefined && track.playable);
  }, [library, playlist, playlistSongs]);
  const firstTrack = library.find((track) => track.id === first) ?? null;
  const empty = chosen !== null && songs.length === 0;

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
            `«${autopilot.label}» ya sonó completa. Silencio hasta que la inicies o elijas «Al terminar: repetir».`
          ) : (
            "Elige qué suena y la canción de partida."
          )}
          {running && autopilot.until ? <span className="block text-warning">Sin repetir · termina a las {clock(autopilot.until, timezone)}, luego silencio.</span> : null}
        </p>

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={autopilot.repeat ? "secondary" : "ghost"}
            icon={<Repeat className="size-3.5" />}
            aria-pressed={autopilot.repeat}
            disabled={busy}
            onClick={() => void act(() => api.setRepeat(!autopilot.repeat))}
            title={autopilot.repeat ? "Al terminar la lista vuelve a empezar. Clic para que suene una sola vez." : "Suena una sola vez y luego silencio. Clic para que vuelva a empezar."}
          >
            Al terminar: {autopilot.repeat ? "repetir" : "silencio"}
          </Button>
          {config.autofill ? (
            <Button size="sm" variant="ghost" className="text-danger" icon={<Square className="size-3.5" />} disabled={busy} onClick={() => void act(api.toggleAutofill)} title="Detiene la música automática: solo suena lo programado">
              Detener
            </Button>
          ) : null}
        </div>

        <SourcePicker
          playlists={playlists}
          playlist={playlist}
          shuffle={shuffle}
          onChange={(nextPlaylist, nextShuffle) => {
            setPlaylist(nextPlaylist);
            setShuffle(nextShuffle);
            setFirst("");
          }}
        />
        {empty ? (
          <p className="rounded-lg bg-warning-soft px-2.5 py-1.5 text-xs break-words text-warning">
            La lista «{chosen.name}» no tiene canciones disponibles: sonaría silencio.{" "}
            <Link href={api.url("/listas")} className="font-semibold underline">
              Agrégale canciones en Listas
            </Link>
          </p>
        ) : null}
        <Field label="Canción de partida" hint={chosen && songs.length ? `${songs.length} canciones de «${chosen.name}», en su orden.` : undefined}>
          {(id) =>
            chosen ? (
              <Select id={id} value={first} onChange={(event) => setFirst(event.target.value)} disabled={empty} className="h-9 text-xs">
                <option value="">{shuffle ? "Cualquiera (al azar)" : "Desde la primera de la lista"}</option>
                {songs.map((track, index) => (
                  <option key={track.id} value={track.id}>
                    {index + 1}. {shortTitle(track.title, 44)} · {duration(track.duration)}
                  </option>
                ))}
              </Select>
            ) : (
              <TrackPicker id={id} library={library} value={first} onChange={setFirst} kinds={["song"]} placeholder="Cualquiera (al azar)" />
            )
          }
        </Field>
        <Button size="sm" className="w-full" variant="signal" icon={<Play className="size-3.5" />} loading={busy} disabled={empty} onClick={() => void start()} title={firstTrack ? `Empieza con «${firstTrack.title}» para todos los oyentes en unos segundos` : "Suena para todos los oyentes en unos segundos"}>
          <span className="truncate">{firstTrack ? `Empezar con «${shortTitle(firstTrack.title, 28)}»` : running ? "Empezar ahora" : "Iniciar música automática"}</span>
        </Button>
      </div>
    </Panel>
  );
}
