import { Radio, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Panel } from "@/Components/ui/panel";
import { cn } from "@/lib/cn";
import { clock } from "@/lib/radio/format";
import type { BroadcastPlaylist, LiveMode, ScheduleBlock } from "@/types/studio";
import { sourceLabel } from "./labels";
import { FallbackNotice, PendingSwitch, SourcePicker, SwitchScheduler } from "./source-picker";
import type { ConsoleApi } from "./use-console";

const MODES: { value: LiveMode; label: string; hint: string }[] = [
  { value: "auto", label: "Automático", hint: "En los bloques en vivo la música se corta sola al conectarte y vuelve sola al terminar" },
  { value: "manual", label: "Manual", hint: "La música solo se corta y vuelve cuando lo indicas" },
];

/**
 * The live switch and the automatic music: automatic or manual mode, cut the music for the live
 * signal or return to it, and what the automatic music plays next (a change lands when the song
 * on air ends, at a song boundary the operator picks, or right away).
 */
export function SwitchPanel({ api, day, playlists, timezone }: { api: ConsoleApi; day: ScheduleBlock[]; playlists: BroadcastPlaylist[]; timezone: string }) {
  const { snapshot, now } = api;
  const { radio, config, autopilot } = snapshot;
  const external = config.live_source === "external";
  const auto = config.live_mode !== "manual";
  const cut = radio.live.cut;
  const span = radio.live.window;
  const block = day.find((item) => item.kind === "live" && item.layer === 0 && item.start <= now && now < item.end) ?? null;
  const [playlist, setPlaylist] = useState(autopilot.playlist);
  const [shuffle, setShuffle] = useState(autopilot.shuffle);
  const [busy, setBusy] = useState(false);
  const changed = playlist !== autopilot.playlist || shuffle !== autopilot.shuffle;
  const chosen = sourceLabel(playlists, playlist, shuffle);

  useEffect(() => {
    setPlaylist(autopilot.playlist);
    setShuffle(autopilot.shuffle);
  }, [autopilot.playlist, autopilot.shuffle]);

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    await action();
    setBusy(false);
  }

  const status = cut
    ? `Al aire en vivo${span?.title ? ` · ${span.title}` : ""} desde las ${span ? clock(span.start, timezone) : "--"}. ${span?.end ? `La música vuelve sola a las ${clock(span.end, timezone)}.` : "La música vuelve cuando lo indiques."}`
    : block && auto
      ? `«${block.title}» está programado hasta las ${clock(block.end, timezone)}: ${external ? "cuando la señal externa responda" : "al abrir la transmisión"} se corta la música sola.`
      : `Suena la música automática: ${autopilot.label}.`;

  return (
    <Panel
      title="Vivo y música automática"
      description={status}
      actions={
        <div role="radiogroup" aria-label="Modo del vivo" className="inline-flex rounded-lg border border-line bg-raised p-0.5">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              role="radio"
              aria-checked={config.live_mode === mode.value}
              title={mode.hint}
              disabled={busy}
              onClick={() => void act(() => api.setLiveMode(mode.value))}
              className={cn("h-7 rounded-md px-2.5 text-xs font-medium transition", config.live_mode === mode.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
            >
              {mode.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={cut ? "danger" : block && auto ? "warning" : "neutral"}>{cut ? "En vivo" : block && auto ? `Vivo programado hasta ${clock(block.end, timezone)}` : "Música automática"}</Badge>
          <span className="text-xs text-muted">Fuente del vivo: {external ? "señal externa (OBS, Icecast)" : "esta consola"}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">{cut ? "Al volver suena" : "Sigue en automático"}</span>
            <SourcePicker
              playlists={playlists}
              playlist={playlist}
              shuffle={shuffle}
              onChange={(nextPlaylist, nextShuffle) => {
                setPlaylist(nextPlaylist);
                setShuffle(nextShuffle);
              }}
            />
            {cut ? (
              <Button variant="signal" icon={<Undo2 className="size-4" />} loading={busy} onClick={() => void act(() => api.resumeMusic(changed ? { playlist, shuffle } : undefined))}>
                Volver a la música
              </Button>
            ) : (
              <Button
                variant="danger"
                icon={<Radio className="size-4" />}
                disabled={!external && !snapshot.live.session}
                loading={busy}
                title={!external && !snapshot.live.session ? "Abre la transmisión en vivo primero" : "Corta la música automática para todos los oyentes"}
                onClick={() => void act(api.cutMusic)}
              >
                Cortar música · ir al vivo
              </Button>
            )}
          </div>
        </div>

        {!cut && changed ? (
          <SwitchScheduler
            musicUrl={`${api.base}/musica`}
            target={chosen}
            now={now}
            timezone={timezone}
            busy={busy}
            onConfirm={(timing) => void act(() => api.switchSource(playlist, shuffle, timing))}
            onClose={() => {
              setPlaylist(autopilot.playlist);
              setShuffle(autopilot.shuffle);
            }}
          />
        ) : null}
        <PendingSwitch autopilot={autopilot} now={now} timezone={timezone} busy={busy} onCancel={() => void act(api.cancelSwitch)} />
        <FallbackNotice autopilot={autopilot} />
      </div>
    </Panel>
  );
}
