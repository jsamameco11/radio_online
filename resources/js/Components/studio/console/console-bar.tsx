import { Headphones, Mic, Power, Repeat, Users } from "lucide-react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { clock, currentItem, shortTitle } from "@/lib/radio/format";
import type { ConsoleApi } from "./use-console";
import { kindLabel } from "./labels";

const STAT = "inline-flex h-8 items-center gap-1.5 rounded-lg bg-raised px-2.5 text-xs text-muted";

/** The console's status line: what is on air now and next, the audience and the master switches. */
export function ConsoleBar({ api, timezone }: { api: ConsoleApi; timezone: string }) {
  const { snapshot, now } = api;
  const { radio, live, config } = snapshot;
  const current = currentItem(radio.queue, now);
  const next = radio.queue.find((item) => item.start > now && item.id !== current?.id) ?? null;
  const onAirLive = Boolean(live.session || radio.live.cut);

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-canvas p-1.5">
      <Badge tone={!config.on_air ? "neutral" : onAirLive ? "danger" : "onair"}>
        <span className={`size-2 rounded-full bg-current ${onAirLive ? "animate-pulse" : ""}`} />
        {!config.on_air ? "Fuera del aire" : radio.live.cut ? "En vivo" : live.session ? "Transmisión abierta" : "Piloto automático"}
      </Badge>
      {live.session && live.started_at ? <span className={cn(STAT, "font-mono text-ink tabular")}>{duration((now - live.started_at) / 1000)}</span> : null}
      <span className={cn(STAT, "font-mono tabular")} title={`Hora de la radio (${timezone})`}>
        {clock(now, timezone, true)}
      </span>

      <span className={cn(STAT, "min-w-0 flex-1 basis-48")} title={current?.title}>
        <span className="shrink-0 text-[10px] font-semibold tracking-wider text-faint uppercase">Ahora</span>
        <span className="min-w-0 truncate text-ink">{current ? shortTitle(current.title, 60) : "—"}</span>
        {current ? <span className="shrink-0 font-mono text-onair tabular">-{duration((current.end - now) / 1000)}</span> : null}
      </span>
      <span className={cn(STAT, "hidden max-w-80 min-w-0 xl:inline-flex")} title={next?.title}>
        <span className="shrink-0 text-[10px] font-semibold tracking-wider text-faint uppercase">Sigue</span>
        <span className="min-w-0 truncate">{next ? `${kindLabel(next.kind)} · ${next.title}` : "—"}</span>
        {next ? <span className="shrink-0 font-mono text-faint tabular">en {duration((next.start - now) / 1000)}</span> : null}
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
      <span className={STAT} title="Oyentes ahora">
        <Users className="size-3.5" /> {radio.listeners}
      </span>
      {live.session ? (
        <span className={STAT} title="Oyentes con la voz en vivo conectada">
          <Mic className="size-3.5" /> {snapshot.voice}
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
