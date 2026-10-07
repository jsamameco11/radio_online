import { Link, usePage } from "@inertiajs/react";
import { Headphones, Loader2, Search, Wifi, WifiOff, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { monitorCellClasses, monitorDotClasses } from "@/Components/admin/status-tones";
import { StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { Badge } from "@/Components/ui/badge";
import { ButtonLink } from "@/Components/ui/button";
import { Input } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import AdminLayout from "@/Layouts/AdminLayout";
import { cn } from "@/lib/cn";
import { ago, count, dateTime } from "@/lib/format";
import { http, HttpError } from "@/lib/http";
import { realtime } from "@/lib/realtime";
import type { SharedProps } from "@/types";
import type { MonitorCell, MonitorDetail, MonitorStatusValue, Option } from "@/types/admin";

interface Props {
  cells: MonitorCell[];
  statuses: Option<MonitorStatusValue>[];
  band: { min: number; max: number };
  staleSeconds: number;
  generatedAt: string;
}

const POLL_WITHOUT_REALTIME_MS = 15_000;
const POLL_WITH_REALTIME_MS = 60_000;

export default function Monitor({ cells: initialCells, statuses, staleSeconds, generatedAt }: Props) {
  const { auth } = usePage<SharedProps>().props;
  const [cells, setCells] = useState(initialCells);
  const [updatedAt, setUpdatedAt] = useState(generatedAt);
  const [hidden, setHidden] = useState<Set<MonitorStatusValue>>(new Set());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const echo = realtime();
    let stopped = false;

    const refresh = async () => {
      try {
        const snapshot = await http.get<{ cells: MonitorCell[]; generated_at: string }>("/admin/monitor/estado");
        if (stopped) return;
        setCells(snapshot.cells);
        setUpdatedAt(snapshot.generated_at);
      } catch {
        // The next tick retries; the grid keeps the last known state meanwhile.
      }
    };

    const timer = window.setInterval(refresh, echo ? POLL_WITH_REALTIME_MS : POLL_WITHOUT_REALTIME_MS);

    if (echo) {
      const channel = echo.private("control.monitor");
      channel.subscribed(() => setConnected(true));
      channel.listen(".MonitorUpdated", (event: { cells: MonitorCell[] }) => {
        const changed = new Map(event.cells.map((cell) => [cell.id, cell]));
        setCells((current) => current.map((cell) => changed.get(cell.id) ?? cell));
        setUpdatedAt(new Date().toISOString());
      });
    }

    return () => {
      stopped = true;
      window.clearInterval(timer);
      echo?.leave("control.monitor");
    };
  }, []);

  const totals = useMemo(() => {
    const result = {} as Record<MonitorStatusValue, number>;
    for (const cell of cells) result[cell.status] = (result[cell.status] ?? 0) + 1;
    return result;
  }, [cells]);

  const needle = query.trim().toLowerCase().replace(",", ".");
  const matches = (cell: MonitorCell) =>
    !hidden.has(cell.status) && (needle === "" || cell.label.startsWith(needle) || Boolean(cell.station?.name.toLowerCase().includes(needle)));
  const visible = cells.filter(matches).length;
  const listeners = cells.reduce((sum, cell) => sum + (cell.station?.listeners ?? 0), 0);

  const toggle = (status: MonitorStatusValue) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });

  return (
    <AdminLayout title="Monitor en vivo">
      <div className="space-y-5">
        <PageHeader
          eyebrow="Operación"
          title="Monitor en vivo"
          description={`Cada casilla es una frecuencia del dial. Una radio al aire sin señal por más de ${staleSeconds} s se marca con un borde punteado.`}
          actions={
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                {connected ? <Wifi className="size-4 text-onair" /> : <WifiOff className="size-4" />}
                {connected ? "En tiempo real" : "Actualización periódica"}
              </span>
              <span>Actualizado {ago(updatedAt)}</span>
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          {statuses.map((status) => (
            <button
              key={status.value}
              type="button"
              aria-pressed={!hidden.has(status.value)}
              onClick={() => toggle(status.value)}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border border-line px-3 text-xs font-medium transition",
                hidden.has(status.value) ? "bg-canvas text-faint line-through" : "bg-surface text-ink hover:bg-raised",
              )}
            >
              <span className={cn("size-2.5 rounded-full", monitorDotClasses[status.value])} />
              {status.label}
              <span className="text-muted tabular">{count(totals[status.value] ?? 0)}</span>
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Frecuencia o nombre" className="pl-9" aria-label="Buscar en el dial" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
          <span className="tabular">
            {count(visible)} de {count(cells.length)} frecuencias
          </span>
          <span className="flex items-center gap-1.5 tabular">
            <Headphones className="size-3.5" />
            {count(listeners)} oyentes en total
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1.5 rounded-2xl border border-line bg-surface p-3">
          {cells.map((cell) => {
            const shown = matches(cell);
            return (
              <button
                key={cell.id}
                type="button"
                onClick={() => setSelected(cell.slug)}
                title={`${cell.label} · ${statuses.find((status) => status.value === cell.status)?.label ?? cell.status}${cell.station ? ` · ${cell.station.name}` : ""}`}
                className={cn(
                  "flex h-11 flex-col items-center justify-center rounded-lg text-[0.7rem] leading-tight ring-1 transition ring-inset hover:scale-105 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ink",
                  monitorCellClasses[cell.status],
                  cell.station?.stale && "outline-2 outline-offset-1 outline-danger outline-dashed",
                  !shown && "opacity-15",
                  selected === cell.slug && "ring-2 ring-ink",
                )}
              >
                <span className="font-semibold tabular">{cell.label}</span>
                {cell.station && cell.station.listeners > 0 && <span className="tabular opacity-80">{count(cell.station.listeners, true)}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {selected && <DetailDrawer slug={selected} onClose={() => setSelected(null)} permissions={auth.user?.permissions ?? []} />}
    </AdminLayout>
  );
}

function DetailDrawer({ slug, onClose, permissions }: { slug: string; onClose: () => void; permissions: string[] }) {
  const [detail, setDetail] = useState<MonitorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError(null);
    http
      .get<MonitorDetail>(`/admin/monitor/frecuencias/${slug}`)
      .then((data) => active && setDetail(data))
      .catch((caught: unknown) => active && setError(caught instanceof HttpError ? caught.firstError() : "No pudimos cargar la frecuencia."));
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const station = detail?.station;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl" aria-label="Detalle de la frecuencia">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-semibold tabular">{detail?.frequency.display ?? slug.replace("-", ".")}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-raised hover:text-ink" aria-label="Cerrar">
          <X className="size-5" />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5 text-sm">
        {error && <p className="text-danger">{error}</p>}
        {!detail && !error && <Loader2 className="mx-auto size-6 animate-spin text-muted" />}

        {detail && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{detail.frequency.status_label}</Badge>
              {detail.frequency.reserved_at && <span className="text-xs text-muted">Reservada {ago(detail.frequency.reserved_at)}</span>}
            </div>

            {station ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <StationLogo station={station} size="md" />
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-semibold text-ink">{station.name}</p>
                    <StreamStatusBadge status={station.stream_status} />
                    {station.status === "suspended" && <Badge tone="danger">{station.status_label}</Badge>}
                  </div>
                </div>

                {station.stale && (
                  <p className="rounded-xl bg-danger-soft px-3 py-2 text-danger">
                    {station.last_heartbeat_at ? `Sin señal desde hace ${count(station.heartbeat_age_seconds ?? 0)} s.` : "Nunca envió señal."}
                  </p>
                )}

                <dl className="grid grid-cols-2 gap-3">
                  <Metric label="Oyentes" value={count(station.listeners)} />
                  <Metric label="Pico" value={count(station.peak_listeners)} />
                  <Metric label="Seguidores" value={count(station.followers)} />
                  <Metric label="Última señal" value={station.last_heartbeat_at ? ago(station.last_heartbeat_at) : "—"} />
                  <Metric label="Latencia" value={station.latency_ms !== null ? `${station.latency_ms} ms` : "—"} />
                  <Metric label="Calidad" value={station.bitrate_kbps !== null ? `${station.bitrate_kbps} kbps` : "—"} />
                </dl>

                {station.topic && (
                  <div className="rounded-xl bg-raised p-3">
                    <p className="text-xs text-muted">Tema actual</p>
                    <p className="font-medium text-ink">{station.topic.title}</p>
                    {station.topic.hashtags.length > 0 && <p className="mt-1 text-xs text-muted">{station.topic.hashtags.map((tag) => `#${tag}`).join(" ")}</p>}
                  </div>
                )}

                {detail.session && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold tracking-wide text-muted uppercase">Última transmisión</p>
                    <p className="text-ink">{detail.session.title ?? "Sin título"}</p>
                    <p className="text-xs text-muted">
                      {detail.session.host ?? "Automático"} · desde {dateTime(detail.session.started_at)}
                      {detail.session.ended_at ? ` hasta ${dateTime(detail.session.ended_at, { timeStyle: "short" })}` : " · en curso"}
                    </p>
                  </div>
                )}

                <div className="space-y-1 text-xs text-muted">
                  <p>
                    Propietario: <span className="text-ink">{station.owner.name}</span> · {station.owner.email}
                  </p>
                  {station.went_live_at && <p>Al aire desde {dateTime(station.went_live_at)}</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  {permissions.includes("stations.view") && (
                    <ButtonLink href={`/admin/radios/${station.id}`} size="sm" variant="secondary">
                      Ver radio
                    </ButtonLink>
                  )}
                  {permissions.includes("studios.enter") && (
                    <ButtonLink href={`/estudio/${detail.frequency.slug}`} size="sm" variant="ghost">
                      Entrar al estudio
                    </ButtonLink>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted">Ninguna radio transmite en esta frecuencia.</p>
            )}

            {permissions.includes("frequencies.view") && (
              <Link href={`/admin/frecuencias/${detail.frequency.slug}`} className="inline-block text-xs font-medium text-muted hover:text-ink">
                Gestionar la frecuencia →
              </Link>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold text-ink tabular">{value}</dd>
    </div>
  );
}
