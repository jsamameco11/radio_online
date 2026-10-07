import { Link } from "@inertiajs/react";
import { AlarmClock, Send } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Checkbox, Input } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { clock, localDate, longDuration } from "@/lib/radio/format";
import type { BroadcastTrack, ScheduleBlock, UpcomingBlock } from "@/types/studio";
import { kindLabel } from "./labels";
import { TrackPicker } from "./track-picker";
import type { ConsoleApi } from "./use-console";

/** «Al aire ahora»: replaces what plays on the main program right away (a library audio or a live block). */
export function LaunchNow({ api, library }: { api: ConsoleApi; library: BroadcastTrack[] }) {
  const [type, setType] = useState<"tracks" | "live">("tracks");
  const [track, setTrack] = useState("");
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [bed, setBed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    const data = await api.run("post", "/lanzar", type === "tracks" ? { type, tracks: [track] } : { type, title, minutes, bed });
    if (data) {
      setTrack("");
      setTitle("");
    }
    setBusy(false);
  }

  return (
    <Panel title="Al aire ahora" description="Corta la pista principal y corre la programación. Para sonar encima usa fondos, reproductores o la botonera.">
      <div className="space-y-3">
        <Tabs
          value={type}
          onChange={setType}
          items={[
            { value: "tracks", label: "Audio" },
            { value: "live", label: "Bloque en vivo" },
          ]}
        />
        {type === "tracks" ? (
          <TrackPicker library={library} value={track} onChange={setTrack} label="Audio para lanzar" />
        ) : (
          <div className="space-y-2">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="Nombre del bloque" aria-label="Nombre del bloque en vivo" />
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <Input type="number" min={1} max={360} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="w-20" aria-label="Minutos" />
                minutos
              </label>
              <Checkbox label="Con música de fondo" checked={bed} onChange={(event) => setBed(event.target.checked)} />
            </div>
          </div>
        )}
        <Button variant="danger" icon={<Send className="size-4" />} disabled={type === "tracks" ? !track : title.trim().length < 2} loading={busy} onClick={() => void go()}>
          Lanzar al aire
        </Button>
      </div>
    </Panel>
  );
}

/** Today's program on every layer, with the block on air highlighted and the coming ones warned. */
export function TodayList({ day, now, timezone, autofill, upcoming, scheduleUrl }: { day: ScheduleBlock[]; now: number; timezone: string; autofill: boolean; upcoming: UpcomingBlock[]; scheduleUrl: string | null }) {
  return (
    <Panel
      title="Programación de hoy"
      actions={
        scheduleUrl ? (
          <Link href={scheduleUrl} className="text-xs font-medium text-muted hover:text-ink">
            Editar →
          </Link>
        ) : null
      }
      padded={false}
    >
      {day.length ? (
        <ul className="max-h-80 divide-y divide-line overflow-y-auto">
          {day.map((block) => {
            const alert = upcoming.find((item) => item.id === block.id);
            const isNow = !alert?.held && block.start <= now && now < block.end;
            return (
              <li key={block.id} className={cn("flex items-center gap-2 px-4 py-2 text-sm", alert ? "bg-danger-soft" : isNow ? "bg-onair-soft" : block.end < now && "opacity-50")}>
                <span className="w-28 shrink-0 font-mono text-xs text-muted tabular">
                  {clock(block.start, timezone)} – {clock(block.end, timezone)}
                </span>
                <span className="w-20 shrink-0 text-xs text-faint">{block.layer ? `Capa ${block.layer}` : "Principal"}</span>
                <span className="min-w-0 flex-1 truncate">{block.title}</span>
                {isNow ? <Badge tone="onair">Ahora</Badge> : null}
                {alert ? <span className="shrink-0 font-mono text-xs text-danger tabular">{alert.held ? "tras el vivo" : `en ${duration(Math.max(0, alert.start - now) / 1000)}`}</span> : null}
                <Badge>{kindLabel(block.kind)}</Badge>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted">No hay bloques para hoy. {autofill ? "Suena la música automática." : "Música automática detenida: la radio está en silencio."}</p>
      )}
    </Panel>
  );
}

/**
 * What the main program has scheduled within the next minutes and what waits for the live
 * transmission to end, with the way to move it (some minutes later or to another time).
 */
export function UpcomingAlerts({ api, timezone }: { api: ConsoleApi; timezone: string }) {
  const { now } = api;
  const { upcoming } = api.snapshot;
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = upcoming.filter((block) => !hidden.includes(block.id));
  if (!visible.length) return null;
  const live = Boolean(api.snapshot.live.session || api.snapshot.radio.live.cut);

  return (
    <Panel title="Próximo en la programación" actions={<AlarmClock className="size-4 text-danger" />}>
      <ul className="space-y-3">
        {visible.map((block) => (
          <UpcomingItem key={block.id} api={api} block={block} now={now} live={live} timezone={timezone} onHide={() => setHidden((list) => [...list, block.id])} />
        ))}
      </ul>
    </Panel>
  );
}

function UpcomingItem({ api, block, now, live, timezone, onHide }: { api: ConsoleApi; block: UpcomingBlock; now: number; live: boolean; timezone: string; onHide: () => void }) {
  const [time, setTime] = useState(() => clock(Math.max(block.start, now) + 15 * 60000, timezone));
  const [busy, setBusy] = useState(false);
  const audio = block.kind !== "live" && block.kind !== "auto";
  const status = block.held
    ? "La transmisión en vivo está al aire: sonará apenas termines, y lo que sigue se corre."
    : block.kind === "live"
      ? "Bloque en vivo: en modo automático la música se corta sola cuando te conectes."
      : live && audio
        ? "Estás en vivo: si a esa hora sigues al aire, esperará a que termines."
        : `Sonará solo a las ${clock(block.start, timezone)}.`;

  async function move(change: Parameters<ConsoleApi["reschedule"]>[1]) {
    setBusy(true);
    await api.reschedule(block.id, change);
    setBusy(false);
  }

  return (
    <li className="space-y-2 rounded-xl border border-danger/30 bg-danger-soft p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="danger">{kindLabel(block.kind)}</Badge>
        <span className="font-mono text-xs text-muted tabular">{block.held ? "pendiente" : `${clock(block.start, timezone)} – ${clock(block.end, timezone)}`}</span>
        <span className="text-xs text-faint">{longDuration(block.duration)}</span>
      </div>
      <p className="text-sm font-semibold">{block.title}</p>
      {block.note ? <p className="rounded-md bg-surface px-2 py-1 text-xs text-muted">{block.note}</p> : null}
      <p className="text-xs text-danger">
        {!block.held && block.start > now ? <strong>Empieza en {duration((block.start - now) / 1000)}. </strong> : null}
        {status}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {[5, 15, 30].map((minutes) => (
          <Button key={minutes} size="sm" variant="secondary" disabled={busy} onClick={() => void move({ minutes })}>
            +{minutes} min
          </Button>
        ))}
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            void move({ time, date: localDate(Math.max(block.start, now), timezone) });
          }}
        >
          <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-8 w-28" aria-label="Nueva hora" required />
          <Button size="sm" type="submit" disabled={busy || !time}>
            Mover
          </Button>
        </form>
        <Button size="sm" variant="ghost" onClick={onHide} className="ml-auto" title="Oculta este aviso; la programación no cambia">
          Ocultar
        </Button>
      </div>
    </li>
  );
}
