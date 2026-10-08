import { Headphones, Mic, Power, Repeat, Users } from "lucide-react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { duration } from "@/lib/format";
import { clock, currentItem, shortTitle } from "@/lib/radio/format";
import type { ConsoleApi } from "./use-console";
import { kindLabel } from "./labels";

/** The console's status line: what is on air now and next, the audience and the master switches. */
export function ConsoleBar({ api, timezone }: { api: ConsoleApi; timezone: string }) {
  const { snapshot, now } = api;
  const { radio, live, config } = snapshot;
  const current = currentItem(radio.queue, now);
  const next = radio.queue.find((item) => item.start > now && item.id !== current?.id) ?? null;
  const onAirLive = Boolean(live.session || radio.live.cut);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
      <Badge tone={!config.on_air ? "neutral" : onAirLive ? "danger" : "onair"}>
        <span className={`size-2 rounded-full bg-current ${onAirLive ? "animate-pulse" : ""}`} />
        {!config.on_air ? "Fuera del aire" : radio.live.cut ? "En vivo" : live.session ? "Transmisión abierta" : "Piloto automático"}
      </Badge>
      {live.session && live.started_at ? <span className="font-mono text-sm text-ink tabular">{duration((now - live.started_at) / 1000)}</span> : null}
      <span className="font-mono text-sm text-muted tabular" title={`Hora de la radio (${timezone})`}>
        {clock(now, timezone, true)}
      </span>

      <span className="flex min-w-0 flex-1 items-center gap-2 text-sm" title={current?.title}>
        <span className="text-xs font-medium tracking-wide text-faint uppercase">Ahora</span>
        <span className="truncate text-ink">{current ? shortTitle(current.title, 60) : "—"}</span>
        {current ? <span className="shrink-0 font-mono text-xs text-onair tabular">-{duration((current.end - now) / 1000)}</span> : null}
      </span>
      <span className="hidden min-w-0 items-center gap-2 text-sm lg:flex" title={next?.title}>
        <span className="text-xs font-medium tracking-wide text-faint uppercase">Sigue</span>
        <span className="max-w-56 truncate text-muted">{next ? `${kindLabel(next.kind)} · ${next.title}` : "—"}</span>
        {next ? <span className="shrink-0 font-mono text-xs text-faint tabular">en {duration((next.start - now) / 1000)}</span> : null}
      </span>

      <Button
        size="sm"
        variant={snapshot.autopilot.repeat ? "secondary" : "ghost"}
        icon={<Repeat className="size-3.5" />}
        aria-pressed={snapshot.autopilot.repeat}
        onClick={() => void api.setRepeat(!snapshot.autopilot.repeat)}
        title={snapshot.autopilot.repeat ? "Al terminar, la música automática vuelve a empezar." : "La música automática suena una sola vez y después queda en silencio."}
      >
        {snapshot.autopilot.repeat ? "Repetir" : "No repetir"}
      </Button>
      <span className="inline-flex items-center gap-1 text-sm text-muted" title="Oyentes ahora">
        <Users className="size-4" /> {radio.listeners}
      </span>
      {live.session ? (
        <span className="inline-flex items-center gap-1 text-sm text-muted" title="Oyentes con la voz en vivo conectada">
          <Mic className="size-4" /> {snapshot.voice}
          {api.connected !== snapshot.voice ? <span className="text-faint">({api.connected})</span> : null}
        </span>
      ) : null}

      <Button size="sm" variant={api.monitor ? "signal" : "secondary"} icon={<Headphones className="size-3.5" />} onClick={() => void api.toggleMonitor()} title="Escucha lo mismo que los oyentes">
        {api.monitor ? "Monitor" : "Escuchar"}
      </Button>
      <Button
        size="sm"
        variant={config.autofill ? "secondary" : "ghost"}
        icon={<Repeat className="size-3.5" />}
        onClick={() => void api.toggleAutofill()}
        title={config.autofill ? "La música automática llena los espacios sin programación. Clic para detenerla." : "Música automática detenida: lo que no está programado es silencio."}
      >
        {config.autofill ? "Automático" : "Automático detenido"}
      </Button>
      <Button size="sm" variant={config.on_air ? "secondary" : "danger"} icon={<Power className="size-3.5" />} onClick={() => void api.toggleAir()}>
        {config.on_air ? "Radio al aire" : "Salir al aire"}
      </Button>
    </div>
  );
}
