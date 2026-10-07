import { Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { KIND_LABEL } from "@/Components/studio/console/labels";
import { SourcePicker } from "@/Components/studio/console/source-picker";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Checkbox, Field, Input, Select } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { clock } from "@/lib/radio/format";
import type { BroadcastPlaylist, Option, ProgramItem, ScheduleBlock } from "@/types/studio";
import { ActionNotice } from "./action-notice";
import { UpcomingSongs } from "./upcoming-songs";
import { useScheduleAction } from "./use-schedule-action";

/** One block of the day: details, preview, edit (time, layer, volume, music lowering, playlist) and remove. */
export function BlockRow({
  blockUrl,
  block,
  date,
  now,
  timezone,
  layers,
  playlists,
  songs,
  editing,
  previewing,
  onEdit,
  onPreview,
}: {
  blockUrl: string;
  block: ScheduleBlock;
  date: string;
  now: number;
  timezone: string;
  layers: Option<number>[];
  playlists: BroadcastPlaylist[];
  /** Songs of the automatic music inside the block (an automatic period, or a live block nobody took). */
  songs: ProgramItem[];
  editing: boolean;
  previewing: boolean;
  onEdit: () => void;
  onPreview: () => void;
}) {
  const { result, setResult, pending, run } = useScheduleAction();
  const [time, setTime] = useState(clock(block.start, timezone, true));
  const [until, setUntil] = useState(clock(block.end, timezone, true));
  const [title, setTitle] = useState(block.title);
  const [note, setNote] = useState(block.note ?? "");
  const [minutes, setMinutes] = useState(Math.round(block.duration / 60));
  const [bed, setBed] = useState(block.bed);
  const [layer, setLayer] = useState(block.layer);
  const [volume, setVolume] = useState(block.volume);
  const [duck, setDuck] = useState(block.duck);
  const [playlist, setPlaylist] = useState<string | null>(block.playlist_id);
  const [shuffle, setShuffle] = useState(block.shuffle);
  const onAir = block.start <= now && now < block.end;
  const past = block.end <= now;
  const overlay = block.layer > 0;
  const auto = block.kind === "auto";
  const live = block.kind === "live";
  const errors = result?.errors ?? {};

  async function save(event: FormEvent) {
    event.preventDefault();
    const body = {
      date,
      time,
      note: note || null,
      ...(auto ? { until, playlist, shuffle } : { title }),
      ...(live ? { minutes, bed } : {}),
      ...(!auto && !live ? { layer, ...(layer > 0 ? { volume, duck } : {}) } : {}),
    };
    if (await run("put", blockUrl, body)) onEdit();
  }

  function remove() {
    if (window.confirm(`¿Quitar «${block.title}» de la programación?`)) void run("delete", blockUrl);
  }

  return (
    <li id={`bloque-${block.id}`} className={cn("scroll-mt-24 rounded-2xl border p-3.5 transition", onAir ? "border-onair/40 bg-onair-soft" : "border-line bg-surface", past && "opacity-60", overlay && "ml-6")}>
      <div className="flex flex-wrap items-start gap-3">
        <p className={cn("w-16 shrink-0 font-mono text-sm font-semibold tabular", past ? "text-muted" : "text-ink")}>
          {clock(block.start, timezone, true)}
          <span className="block text-xs font-normal text-muted">{clock(block.end, timezone, true)}</span>
        </p>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {overlay ? <Badge tone="info">{layers.find((item) => item.value === block.layer)?.label ?? `capa ${block.layer}`} · encima</Badge> : null}
            <Badge>{KIND_LABEL[block.kind]}</Badge>
            {onAir ? <Badge tone="onair">Al aire</Badge> : null}
            {live && block.bed ? <span className="text-xs text-muted">con música de fondo</span> : null}
            {live ? <span className="text-xs text-muted">si nadie se conecta, sigue la música automática</span> : null}
            {overlay && block.duck ? <span className="text-xs font-medium text-warning">baja la música</span> : null}
            {overlay && block.volume !== 100 ? <span className="text-xs text-muted">volumen {block.volume}%</span> : null}
            {block.inactive ? <Badge tone="warning">Audio no disponible: no sonará</Badge> : null}
          </div>
          <p className="mt-1.5 truncate font-semibold">{block.title}</p>
          <p className="truncate text-sm text-muted">
            {duration(block.duration)}
            {block.artist ? ` · ${block.artist}` : ""}
            {auto && block.playlist ? ` · ${block.playlist}` : ""}
            {block.note ? ` · ${block.note}` : ""}
          </p>
          <UpcomingSongs songs={songs} now={now} timezone={timezone} />
        </div>
        <div className="flex items-center gap-1">
          {block.src ? (
            <Button size="sm" variant="ghost" icon={previewing ? <Pause className="size-4" /> : <Play className="size-4" />} onClick={onPreview}>
              {previewing ? "Parar" : "Oír"}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={onEdit}>
            {editing ? "Cerrar" : "Editar"}
          </Button>
          <Button size="sm" variant="ghost" className="text-danger" icon={<Trash2 className="size-4" />} disabled={pending} onClick={remove}>
            Quitar
          </Button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={(event) => void save(event)} className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          <Field label="Hora de inicio" error={errors.time}>
            {(id, invalid) => <Input id={id} invalid={invalid} type="time" step={1} value={time} onChange={(event) => setTime(event.target.value)} />}
          </Field>
          {auto ? (
            <Field label="Hasta las" error={errors.until}>
              {(id, invalid) => <Input id={id} invalid={invalid} type="time" step={1} value={until} onChange={(event) => setUntil(event.target.value)} />}
            </Field>
          ) : (
            <Field label="Título" error={errors.title}>
              {(id, invalid) => <Input id={id} invalid={invalid} value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} />}
            </Field>
          )}
          {auto ? (
            <SourcePicker
              className="sm:col-span-2"
              playlists={playlists}
              playlist={playlist}
              shuffle={shuffle}
              onChange={(nextPlaylist, nextShuffle) => {
                setPlaylist(nextPlaylist);
                setShuffle(nextShuffle);
              }}
            />
          ) : live ? (
            <>
              <Field label="Duración (minutos)" error={errors.minutes}>
                {(id, invalid) => <Input id={id} invalid={invalid} type="number" min={1} max={360} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />}
              </Field>
              <Checkbox className="pt-7" label="Música de fondo" checked={bed} onChange={(event) => setBed(event.target.checked)} />
            </>
          ) : (
            <>
              <Field label="Pista" error={errors.layer}>
                {(id, invalid) => (
                  <Select id={id} invalid={invalid} value={layer} onChange={(event) => setLayer(Number(event.target.value))}>
                    {layers.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.value === 0 ? "Pista principal" : `${item.label} (encima)`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {layer > 0 ? (
                <>
                  <label className="block text-sm font-medium">
                    Volumen: {volume}%
                    <input type="range" min={0} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="mt-3 w-full accent-signal" />
                  </label>
                  <Checkbox className="sm:col-span-2" label="Bajar la música de la pista principal mientras suena" checked={duck} onChange={(event) => setDuck(event.target.checked)} />
                </>
              ) : null}
            </>
          )}
          <Field className="sm:col-span-2" label="Nota interna (opcional)" error={errors.note}>
            {(id, invalid) => <Input id={id} invalid={invalid} value={note} maxLength={240} onChange={(event) => setNote(event.target.value)} />}
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <ActionNotice result={result} onClose={() => setResult(null)} />
            <Button type="submit" loading={pending}>
              Guardar cambios
            </Button>
          </div>
        </form>
      ) : result?.tone === "error" ? (
        <div className="mt-3">
          <ActionNotice result={result} onClose={() => setResult(null)} />
        </div>
      ) : null}
    </li>
  );
}
