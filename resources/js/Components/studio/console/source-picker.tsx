import { useEffect, useState } from "react";
import { Button } from "@/Components/ui/button";
import { Select } from "@/Components/ui/field";
import { cn } from "@/lib/cn";
import { http } from "@/lib/http";
import { clock } from "@/lib/radio/format";
import type { Autopilot, BroadcastPlaylist, SwitchPoint } from "@/types/studio";
import { fallbackMessages } from "./labels";
import type { SwitchTiming } from "./use-console";

/**
 * What the automatic music plays: one of the station's playlists (shuffled or in its order) or
 * random songs (`playlist` null).
 */
export function SourcePicker({
  playlists,
  playlist,
  shuffle,
  onChange,
  className,
}: {
  playlists: BroadcastPlaylist[];
  playlist: string | null;
  shuffle: boolean;
  onChange: (playlist: string | null, shuffle: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select value={playlist ?? ""} onChange={(event) => onChange(event.target.value || null, shuffle)} className="h-9 w-auto min-w-48" aria-label="Qué suena en automático">
        <option value="">Canciones aleatorias</option>
        {playlists.map((item) => (
          <option key={item.id} value={item.id} disabled={item.songs === 0 && item.id !== playlist}>
            {item.name} · {item.songs ? `${item.songs} ${item.songs === 1 ? "canción" : "canciones"}` : "sin canciones"}
          </option>
        ))}
      </Select>
      {playlist ? (
        <div role="radiogroup" aria-label="Orden de la lista" className="inline-flex rounded-lg border border-line bg-raised p-0.5">
          {(
            [
              [true, "Aleatorio"],
              [false, "En orden"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={shuffle === value}
              onClick={() => onChange(playlist, value)}
              className={cn("h-7 rounded-md px-2.5 text-xs font-medium transition", shuffle === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Song boundaries where a change of the automatic music can land, kept fresh (they move as songs end). */
function useSwitchPoints(musicUrl: string): SwitchPoint[] | null {
  const [points, setPoints] = useState<SwitchPoint[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      http
        .get<{ points: SwitchPoint[] }>(`${musicUrl}/puntos`)
        .then((data) => alive && setPoints(data.points))
        .catch(() => alive && setPoints([]));
    void load();
    const refresh = window.setInterval(() => void load(), 20000);
    return () => {
      alive = false;
      window.clearInterval(refresh);
    };
  }, [musicUrl]);
  return points;
}

function afterLabel(point: SwitchPoint): string {
  return point.after ? `al terminar «${point.after.title}»${point.after.artist ? ` · ${point.after.artist}` : ""}` : "al terminar lo que suena";
}

/**
 * Where a change of the automatic music lands: when the song on air ends, at a song boundary
 * chosen from the next ones, or right away. Nothing is cut: the song before fades into the new music.
 */
export function SwitchScheduler({
  musicUrl,
  target,
  now,
  timezone,
  busy,
  onConfirm,
  onClose,
}: {
  musicUrl: string;
  target: string;
  now: number;
  timezone: string;
  busy?: boolean;
  onConfirm: (timing: SwitchTiming) => void;
  onClose: () => void;
}) {
  const loaded = useSwitchPoints(musicUrl);
  const points = (loaded ?? []).filter((point) => point.at > now + 5000);
  const [when, setWhen] = useState<SwitchTiming["when"]>("song");
  const [chosen, setChosen] = useState<number | null>(null);
  const picked = points.find((point) => point.at === chosen) ?? points[1] ?? points[0] ?? null;
  const first = points[0] ?? null;
  const timing: SwitchTiming | null = when === "at" ? (picked ? { when: "at", at: picked.at } : null) : { when };

  const options: { value: SwitchTiming["when"]; label: string; hint: string; disabled?: boolean }[] = [
    { value: "song", label: "Al terminar la canción que suena", hint: loaded === null ? "Calculando…" : first ? `Entra a las ${clock(first.at, timezone, true)}, ${afterLabel(first)}.` : "Ahora no suena música automática: quedará elegida para cuando vuelva." },
    { value: "at", label: "En el punto que elijo", hint: points.length ? `Entre las próximas ${points.length} canciones.` : "No hay canciones automáticas por delante.", disabled: !points.length },
    { value: "now", label: "Ahora mismo", hint: "La canción que suena se funde con la nueva música en segundos." },
  ];

  return (
    <div className="space-y-3 rounded-xl border border-info/30 bg-info-soft p-3 text-sm" role="group" aria-label="Cuándo hacer el cambio">
      <p className="font-semibold">
        Cambiar a: <span className="text-info">{target}</span>
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        {options.map((option) => (
          <label key={option.value} className={cn("flex items-start gap-2 rounded-lg border border-line bg-surface p-2.5", option.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer has-[:checked]:border-info")}>
            <input type="radio" name="switch-when" className="mt-0.5 accent-info" checked={when === option.value} disabled={option.disabled} onChange={() => setWhen(option.value)} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{option.label}</span>
              {option.value === "at" && when === "at" && picked ? (
                <Select value={picked.at} onChange={(event) => setChosen(Number(event.target.value))} className="mt-1 h-8 text-xs" aria-label="Punto del cambio">
                  {points.map((point) => (
                    <option key={point.at} value={point.at}>
                      {clock(point.at, timezone, true)} · {afterLabel(point)}
                    </option>
                  ))}
                </Select>
              ) : (
                <span className="block text-xs text-muted">{option.hint}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button size="sm" disabled={!timing || (when !== "now" && loaded === null)} loading={busy} onClick={() => timing && onConfirm(timing)}>
          {when === "now" ? "Cambiar ahora" : when === "song" ? "Programar al terminar la canción" : picked ? `Programar a las ${clock(picked.at, timezone, true)}` : "Programar cambio"}
        </Button>
      </div>
    </div>
  );
}

/** A scheduled change of the automatic music: when it lands, what plays until then, and a way to call it off. */
export function PendingSwitch({ autopilot, now, timezone, busy, onCancel }: { autopilot: Autopilot; now: number; timezone: string; busy?: boolean; onCancel: () => void }) {
  if (!autopilot.pending || autopilot.since <= now) return null;
  const left = Math.max(0, Math.round((autopilot.since - now) / 1000));
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-info/30 bg-info-soft px-3 py-2 text-sm">
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Cambio programado:</span> {autopilot.label} a las {clock(autopilot.since, timezone, true)}{" "}
        <span className="tabular">
          (en {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")})
        </span>
        , entre canción y canción. Hasta entonces sigue {autopilot.pending.label}.
      </p>
      <Button size="sm" variant="secondary" loading={busy} onClick={onCancel}>
        Cancelar cambio
      </Button>
    </div>
  );
}

/** Warns when the automatic music sounds from a fallback, stopped at the end of its cycle or files left the air. */
export function FallbackNotice({ autopilot }: { autopilot: Autopilot }) {
  const messages = fallbackMessages(autopilot);
  if (!messages.length) return null;
  return (
    <div role="status" className="space-y-1 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );
}
