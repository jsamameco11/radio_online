import { Link } from "@inertiajs/react";
import { Send, Volume1 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Checkbox, Input } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { clock } from "@/lib/radio/format";
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
    <Panel dense title="Al aire ahora" description="Corta la pista principal y corre la programación. Para sonar encima usa fondos, reproductores o la botonera.">
      <div className="space-y-2.5">
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label className="inline-flex items-center gap-2 text-xs">
                <Input type="number" min={1} max={360} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="w-20" aria-label="Minutos" />
                minutos
              </label>
              <Checkbox label="Con música de fondo" checked={bed} onChange={(event) => setBed(event.target.checked)} />
            </div>
          </div>
        )}
        <Button size="sm" variant="danger" icon={<Send className="size-3.5" />} disabled={type === "tracks" ? !track : title.trim().length < 2} loading={busy} onClick={() => void go()}>
          Lanzar al aire
        </Button>
      </div>
    </Panel>
  );
}

/** Today's program on every layer, with the block on air highlighted and the coming ones warned (a click opens the warning). */
export function TodayList({ day, now, timezone, autofill, upcoming, scheduleUrl, onAlert }: { day: ScheduleBlock[]; now: number; timezone: string; autofill: boolean; upcoming: UpcomingBlock[]; scheduleUrl: string | null; onAlert: (id: string) => void }) {
  return (
    <Panel
      dense
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
        <ul className="desk-scroll max-h-80 divide-y divide-line overflow-y-auto">
          {day.map((block) => {
            const alert = upcoming.find((item) => item.id === block.id);
            const isNow = !alert?.held && block.start <= now && now < block.end;
            const body = (
              <>
                <span className="shrink-0 pt-px font-mono text-[11px] text-muted tabular">
                  {clock(block.start, timezone)}–{clock(block.end, timezone)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-ink" title={block.title}>
                    {block.title}
                  </span>
                  <span className="flex min-w-0 items-center gap-1 text-[10px] text-faint">
                    <span className={cn("size-1.5 shrink-0 rounded-full", block.layer ? "bg-gold" : "bg-onair")} aria-hidden />
                    <span className="truncate">
                      {block.layer ? `Capa ${block.layer}` : "Principal"} · {kindLabel(block.kind)}
                    </span>
                    {block.layer && block.duck ? <Volume1 className="size-3 shrink-0" aria-label="Baja la música mientras suena" /> : null}
                  </span>
                </span>
                {isNow ? <Badge tone="onair">Ahora</Badge> : null}
                {alert ? <span className="shrink-0 font-mono text-[11px] text-danger tabular">{alert.held ? "tras el vivo" : `en ${duration(Math.max(0, alert.start - now) / 1000)}`}</span> : null}
              </>
            );
            return (
              <li key={block.id} className={cn(alert ? "bg-danger-soft" : isNow ? "bg-onair-soft" : block.end < now && "opacity-50")}>
                {alert ? (
                  <button type="button" onClick={() => onAlert(block.id)} className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-danger/10" title="Ver el aviso y reprogramarlo">
                    {body}
                  </button>
                ) : (
                  <div className="flex items-start gap-2 px-3 py-1.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-3 py-3 text-xs text-muted">No hay bloques para hoy. {autofill ? "Suena la música automática." : "Música automática detenida: la radio está en silencio."}</p>
      )}
    </Panel>
  );
}
