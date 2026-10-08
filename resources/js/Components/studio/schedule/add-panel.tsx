import { Link } from "@inertiajs/react";
import { Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { KIND_LABEL } from "@/Components/studio/console/labels";
import { SourcePicker } from "@/Components/studio/console/source-picker";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Checkbox, Field, Input, Select } from "@/Components/ui/field";
import { Panel } from "@/Components/ui/panel";
import { Tabs } from "@/Components/ui/tabs";
import { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { duration } from "@/lib/format";
import { clock } from "@/lib/radio/format";
import type { BroadcastPlaylist, BroadcastTrack, Option, TrackKind } from "@/types/studio";
import { ActionNotice } from "./action-notice";
import { DuckIcon } from "./duck-icon";
import { useScheduleAction } from "./use-schedule-action";

type Type = "tracks" | "auto" | "live";

type Mode = "end" | "at" | "now";

const FILTERS: TrackKind[] = ["song", "jingle", "effect", "commercial", "program"];

/**
 * Places library audios, a live block or a period of automatic music on a layer of the day:
 * after the last block, at an exact time or right now.
 */
export function AddPanel({
  storeUrl,
  date,
  isToday,
  dayEnds,
  tracks,
  playlists,
  layers,
  maxTracks,
  timezone,
}: {
  storeUrl: string;
  date: string;
  isToday: boolean;
  dayEnds: (number | null)[];
  tracks: BroadcastTrack[];
  playlists: BroadcastPlaylist[];
  layers: Option<number>[];
  maxTracks: number;
  timezone: string;
}) {
  const url = useStudioUrl();
  const can = useStudioCan();
  const [type, setType] = useState<Type>("tracks");
  const [layer, setLayer] = useState(0);
  const [mode, setMode] = useState<Mode>("end");
  const [time, setTime] = useState("06:00:00");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<TrackKind | "">("");
  const [picked, setPicked] = useState<BroadcastTrack[]>([]);
  const [volume, setVolume] = useState(100);
  const [duck, setDuck] = useState<"" | "1" | "0">("");
  const [playlist, setPlaylist] = useState<string | null>(playlists.find((item) => item.songs > 0)?.id ?? null);
  const [shuffle, setShuffle] = useState(true);
  const [until, setUntil] = useState("12:00");
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [bed, setBed] = useState(true);
  const [note, setNote] = useState("");
  const { result, setResult, pending, run } = useScheduleAction();
  const overlay = type === "tracks" && layer > 0;
  const dayEnd = dayEnds[type === "tracks" ? layer : 0] ?? null;
  const search = query.trim().toLowerCase();
  const shown = tracks.filter((track) => track.playable && (!kind || track.kind === kind) && `${track.title} ${track.artist ?? ""}`.toLowerCase().includes(search)).slice(0, 60);
  const length = picked.reduce((sum, track) => sum + track.duration, 0);
  const errors = result?.errors ?? {};
  const needsTime = mode === "at" || (mode === "end" && !dayEnd);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = {
      date,
      mode,
      type,
      layer: type === "tracks" ? layer : 0,
      time: needsTime ? time : null,
      note: note || null,
      ...(type === "tracks" ? { tracks: picked.map((track) => track.id), ...(overlay ? { volume, duck: duck === "" ? null : duck === "1" } : {}) } : {}),
      ...(type === "auto" ? { playlist, shuffle, until } : {}),
      ...(type === "live" ? { title, minutes, bed } : {}),
    };
    if (await run("post", storeUrl, body)) {
      setPicked([]);
      setNote("");
      setTitle("");
    }
  }

  return (
    <Panel title="Agregar a la programación">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <Tabs
          value={type}
          onChange={setType}
          items={[
            { value: "tracks", label: "Biblioteca" },
            { value: "auto", label: "Música automática" },
            { value: "live", label: "En vivo" },
          ]}
        />

        {type === "tracks" ? (
          <div className="space-y-3">
            <Field label="Pista" hint={overlay ? "Suena encima de la pista principal, sin cortarla: ideal para anuncios, cortinas y efectos." : "La pista principal lleva el programa: canciones, programas y bloques en vivo, uno tras otro."}>
              {(id) => (
                <Select id={id} value={layer} onChange={(event) => setLayer(Number(event.target.value))}>
                  {layers.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.value === 0 ? "Pista principal" : `${item.label.charAt(0).toUpperCase()}${item.label.slice(1)} (encima)`}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {tracks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
                La biblioteca está vacía.{" "}
                {can("library.manage") ? (
                  <Link href={url("/biblioteca")} className="font-semibold text-ink underline hover:text-signal">
                    Sube tus audios
                  </Link>
                ) : (
                  "Sube tus audios"
                )}{" "}
                primero.
              </p>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar…" aria-label="Buscar en la biblioteca" />
                  <Select value={kind} onChange={(event) => setKind(event.target.value as TrackKind | "")} className="w-auto" aria-label="Tipo de audio">
                    <option value="">Todo</option>
                    {FILTERS.map((value) => (
                      <option key={value} value={value}>
                        {KIND_LABEL[value]}
                      </option>
                    ))}
                  </Select>
                </div>
                <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                  {shown.map((track) => (
                    <li key={track.id}>
                      <button type="button" disabled={picked.length >= maxTracks} onClick={() => setPicked((list) => [...list, track])} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-raised">
                        <Plus className="size-4 shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate">
                          {track.title}
                          {track.artist ? <span className="text-muted"> · {track.artist}</span> : null}
                        </span>
                        {track.duck ? (
                          <span title="Baja la música de la pista principal mientras suena" className="shrink-0 text-warning">
                            <DuckIcon className="size-3.5" />
                          </span>
                        ) : null}
                        <span className="shrink-0 font-mono text-xs text-muted">{duration(track.duration)}</span>
                      </button>
                    </li>
                  ))}
                  {shown.length === 0 ? <li className="px-3 py-3 text-sm text-muted">Sin resultados.</li> : null}
                </ul>
                <p className="text-xs font-medium text-muted">
                  En este orden ({picked.length}){picked.length ? ` · ${duration(length)}` : ""}
                </p>
                {picked.length ? (
                  <ol className="space-y-1">
                    {picked.map((track, index) => (
                      <li key={`${track.id}-${index}`} className="flex items-center gap-2 rounded-lg bg-raised px-2.5 py-1.5 text-sm">
                        <span className="w-5 shrink-0 text-right font-mono text-xs text-muted">{index + 1}</span>
                        <Badge>{KIND_LABEL[track.kind]}</Badge>
                        <span className="min-w-0 flex-1 truncate">{track.title}</span>
                        <button type="button" onClick={() => setPicked((list) => list.filter((_, at) => at !== index))} className="text-muted hover:text-danger" aria-label={`Quitar «${track.title}»`}>
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-muted">Toca los audios de arriba para ponerlos en fila.</p>
                )}
              </>
            )}

            {overlay ? (
              <div className="space-y-3 rounded-xl border border-line p-3">
                <label className="block text-xs font-medium text-muted">
                  Volumen de la capa: {volume}%
                  <input type="range" min={0} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="mt-2 w-full accent-signal" />
                </label>
                <Field label="Mientras suena, la música de la pista principal…">
                  {(id) => (
                    <Select id={id} value={duck} onChange={(event) => setDuck(event.target.value as "" | "1" | "0")}>
                      <option value="">Según cada audio (lo marcado en la biblioteca)</option>
                      <option value="1">Baja para que se escuche mejor</option>
                      <option value="0">Sigue igual</option>
                    </Select>
                  )}
                </Field>
              </div>
            ) : null}
          </div>
        ) : type === "auto" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">De una hora a otra suena la música que elijas: cada vuelta toca todas sus canciones sin repetir. Si alguien sale en vivo, la música le da paso y luego vuelve sola.</p>
            <SourcePicker
              playlists={playlists}
              playlist={playlist}
              shuffle={shuffle}
              onChange={(nextPlaylist, nextShuffle) => {
                setPlaylist(nextPlaylist);
                setShuffle(nextShuffle);
              }}
            />
            <Field label="Hasta las" error={errors.until} hint="Si es más temprano que el inicio, termina al día siguiente (hasta 24 horas).">
              {(id, invalid) => <Input id={id} invalid={invalid} type="time" value={until} onChange={(event) => setUntil(event.target.value)} required className="w-40" />}
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Nombre del bloque" error={errors.title}>
              {(id, invalid) => <Input id={id} invalid={invalid} value={title} maxLength={160} placeholder="Por ejemplo «Mañanas al día»" onChange={(event) => setTitle(event.target.value)} />}
            </Field>
            <Field label="Duración (minutos)" error={errors.minutes}>
              {(id, invalid) => <Input id={id} invalid={invalid} type="number" min={1} max={360} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="w-32" />}
            </Field>
            <Checkbox label="Música de fondo mientras estás al aire" checked={bed} onChange={(event) => setBed(event.target.checked)} />
          </div>
        )}

        <Field label="Nota interna (opcional)" error={errors.note}>
          {(id, invalid) => <Input id={id} invalid={invalid} value={note} maxLength={240} placeholder="Solo la ve el equipo" onChange={(event) => setNote(event.target.value)} />}
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">¿Cuándo suena?</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" className="accent-signal" checked={mode === "end"} onChange={() => setMode("end")} />
            {dayEnd ? `Después del último bloque de la ${overlay ? (layers.find((item) => item.value === layer)?.label ?? `capa ${layer}`) : "pista principal"} (${clock(dayEnd, timezone, true)})` : "Al inicio del día, a esta hora:"}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" className="accent-signal" checked={mode === "at"} onChange={() => setMode("at")} /> A una hora exacta
          </label>
          {needsTime ? <Input type="time" step={1} value={time} onChange={(event) => setTime(event.target.value)} required className="ml-6 w-40" aria-label="Hora de inicio" aria-invalid={Boolean(errors.time) || undefined} /> : null}
          {isToday ? (
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" className="mt-1 accent-signal" checked={mode === "now"} onChange={() => setMode("now")} />
              <span>
                {overlay ? "Ahora mismo, encima" : "Al aire ahora"}
                <span className="block text-xs text-muted">{overlay ? "Suena en segundos sobre lo que está al aire, sin cortarlo." : "Corta lo que suena y corre lo que sigue para darle espacio."}</span>
              </span>
            </label>
          ) : null}
        </fieldset>

        <ActionNotice result={result} onClose={() => setResult(null)} />
        <Button type="submit" className="w-full" loading={pending} disabled={type === "tracks" && picked.length === 0}>
          {mode === "now" ? "Lanzar al aire" : "Programar"}
        </Button>
      </form>
    </Panel>
  );
}
