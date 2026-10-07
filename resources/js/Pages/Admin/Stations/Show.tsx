import { Link, router, useForm, usePage } from "@inertiajs/react";
import { ArrowLeft, Ban, ExternalLink, Pencil, RotateCcw, ShieldCheck } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { AuditList } from "@/Components/admin/audit-list";
import { ReasonModal } from "@/Components/admin/reason-modal";
import { PageErrors } from "@/Components/forms/page-errors";
import { FrequencyTitle, StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { Avatar } from "@/Components/ui/avatar";
import { Badge } from "@/Components/ui/badge";
import { Button, ButtonLink } from "@/Components/ui/button";
import { Field, Input, Select, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { Panel, Stat } from "@/Components/ui/panel";
import AdminLayout from "@/Layouts/AdminLayout";
import { ago, count, dateTime, money } from "@/lib/format";
import type { SharedProps } from "@/types";
import type { AuditEntry, Broadcast, Option, ReportRow, StationRow } from "@/types/admin";
import type { AudienceSummary, TeamMember } from "@/types/station-admin";

interface StationDetail extends StationRow {
  tagline: string | null;
  description: string | null;
  visibility: string;
  visibility_label: string;
  language: string | null;
  country: string | null;
  categories: string[];
  hashtags: string[];
  current_topic: string | null;
  latency_ms: number | null;
  bitrate_kbps: number | null;
  went_live_at: string | null;
}

interface Props {
  station: StationDetail;
  team: TeamMember[];
  stats: AudienceSummary & { gift_earnings_cents: number; gifts: number };
  settings: { key: string; value: unknown; updated_at: string | null }[];
  reports: ReportRow[];
  broadcasts: Broadcast[];
  audit: AuditEntry[] | null;
  options: { visibility: Option[]; languages: Option[]; countries: Option[] };
  can: { update: boolean; suspend: boolean; enterStudio: boolean };
}

export default function StationShow({ station, team, stats, settings, reports, broadcasts, audit, options, can }: Props) {
  const { app } = usePage<SharedProps>().props;
  const [editing, setEditing] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const closedAt = station.deleted_at;
  const closed = closedAt !== null;
  const suspended = station.status === "suspended";

  return (
    <AdminLayout title={station.display_name}>
      <div className="space-y-6">
        <Link href="/admin/radios" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" />
          Radios
        </Link>

        <header className="flex flex-wrap items-center gap-5">
          <StationLogo station={station} size="lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <FrequencyTitle station={station} size="lg" />
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              <StreamStatusBadge status={station.stream_status.value} />
              {suspended && <Badge tone="danger">Suspendida</Badge>}
              {closedAt && <Badge tone="neutral">Cerrada el {dateTime(closedAt, { dateStyle: "medium" })}</Badge>}
              <Badge>{station.visibility_label}</Badge>
              <span>
                Propietario:{" "}
                <Link href={`/admin/usuarios/${station.owner.id}`} className="text-ink hover:underline">
                  {station.owner.name}
                </Link>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!closed && (
              <a href={`${app.urls.public}/radio/${station.frequency.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-muted hover:bg-raised hover:text-ink">
                <ExternalLink className="size-4" />
                Página pública
              </a>
            )}
            {can.enterStudio && (
              <ButtonLink href={`/estudio/${station.frequency.slug}`} variant="secondary">
                Entrar al estudio
              </ButtonLink>
            )}
            {can.update && (
              <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                Editar
              </Button>
            )}
            {can.suspend &&
              (suspended ? (
                <Button icon={<RotateCcw className="size-4" />} onClick={() => router.post(`/admin/radios/${station.id}/reactivar`, {}, { preserveScroll: true })}>
                  Reactivar
                </Button>
              ) : (
                <Button variant="danger" icon={<Ban className="size-4" />} onClick={() => setSuspending(true)}>
                  Suspender
                </Button>
              ))}
          </div>
        </header>

        {!editing && !suspending && <PageErrors />}

        {suspended && (
          <div className="rounded-2xl border border-danger/30 bg-danger-soft px-5 py-4 text-sm text-danger">
            <p className="font-semibold">Suspendida {station.suspended_at ? `el ${dateTime(station.suspended_at)}` : ""}</p>
            {station.suspension_reason && <p className="mt-1">{station.suspension_reason}</p>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Oyentes ahora" value={count(stats.listeners_now)} hint={`Pico 30 días: ${count(stats.peak_listeners)}`} />
          <Stat label="Horas escuchadas" value={count(stats.hours)} hint={`${count(stats.sessions)} sesiones en 30 días`} />
          <Stat label="Seguidores" value={count(stats.followers)} hint={`+${count(stats.new_followers)} en 30 días`} />
          <Stat label="Regalos recibidos" value={money(stats.gift_earnings_cents, app.currency)} hint={`${count(stats.gifts)} regalos en total`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Panel title="Perfil">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <Detail label="Eslogan" value={station.tagline} />
                <Detail label="Idioma · país" value={[options.languages.find((item) => item.value === station.language)?.label, options.countries.find((item) => item.value === station.country)?.label].filter(Boolean).join(" · ")} />
                <Detail label="Categorías" value={station.categories.join(", ")} />
                <Detail label="Hashtags" value={station.hashtags.map((tag) => `#${tag}`).join(" ")} />
                <Detail label="Tema actual" value={station.current_topic} />
                <Detail label="Señal" value={station.bitrate_kbps ? `${station.bitrate_kbps} kbps · ${station.latency_ms ?? "—"} ms` : null} />
                <div className="sm:col-span-2">
                  <Detail label="Descripción" value={station.description} />
                </div>
              </dl>
            </Panel>

            <Panel title="Transmisiones recientes" padded={broadcasts.length === 0}>
              {broadcasts.length === 0 ? (
                <p className="text-sm text-muted">Todavía no transmitió.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {broadcasts.map((broadcast) => (
                    <li key={broadcast.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{broadcast.title ?? "Sin título"}</span>
                        <span className="text-xs text-muted">
                          {broadcast.host ?? "Automático"} · {dateTime(broadcast.started_at)}
                        </span>
                      </span>
                      <span className="text-right text-xs text-muted tabular">
                        Pico {count(broadcast.peak_listeners)}
                        <span className="block">{broadcast.ended_at ? "Terminada" : "En curso"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Reportes" padded={reports.length === 0} actions={<Link href="/admin/moderacion" className="text-xs font-medium text-muted hover:text-ink">Ir a moderación</Link>}>
              {reports.length === 0 ? (
                <p className="text-sm text-muted">Nadie reportó esta radio.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {reports.map((report) => (
                    <li key={report.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <span className="min-w-0">
                        <span className="block font-medium">{report.reason_label}</span>
                        {report.details && <span className="block text-muted">{report.details}</span>}
                        <span className="text-xs text-faint">
                          {report.reporter?.name ?? "Anónimo"} · {ago(report.created_at)}
                        </span>
                      </span>
                      <Badge tone={report.status === "open" ? "warning" : "neutral"}>{report.status_label}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {settings.length > 0 && (
              <Panel title="Configuración guardada" description="Solo lectura: lo que la radio ajustó en su estudio.">
                <div className="space-y-2">
                  {settings.map((setting) => (
                    <details key={setting.key} className="rounded-xl border border-line px-4 py-2 text-sm">
                      <summary className="cursor-pointer font-medium">
                        {setting.key}
                        {setting.updated_at && <span className="ml-2 text-xs font-normal text-muted">{ago(setting.updated_at)}</span>}
                      </summary>
                      <pre className="mt-2 overflow-x-auto text-xs text-muted">{JSON.stringify(setting.value, null, 2)}</pre>
                    </details>
                  ))}
                </div>
              </Panel>
            )}
          </div>

          <div className="space-y-6">
            <Panel title="Equipo" padded={false}>
              <ul className="divide-y divide-line">
                {team.map((member) => (
                  <li key={member.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <Avatar name={member.user.name} src={member.user.avatar_url} size="sm" />
                    <span className="min-w-0 flex-1">
                      <Link href={`/admin/usuarios/${member.user.id}`} className="block truncate font-medium hover:underline">
                        {member.user.name}
                      </Link>
                      <span className="text-xs text-muted">{member.role_label}</span>
                    </span>
                    {member.user.two_factor_enabled && <ShieldCheck className="size-4 text-onair" aria-label="Verificación en dos pasos activa" />}
                  </li>
                ))}
              </ul>
            </Panel>

            {audit && (
              <Panel title="Auditoría">
                <AuditList entries={audit} showStation={false} />
              </Panel>
            )}
          </div>
        </div>
      </div>

      {editing && <EditModal station={station} options={options} onClose={() => setEditing(false)} />}
      <ReasonModal
        open={suspending}
        onClose={() => setSuspending(false)}
        title={`Suspender ${station.display_name}`}
        description="Saldrá del aire, desaparecerá de la búsqueda y su equipo no podrá transmitir hasta que la reactives."
        url={`/admin/radios/${station.id}/suspender`}
        confirmLabel="Suspender radio"
      />
    </AdminLayout>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="whitespace-pre-line text-ink">{value || <span className="text-faint">—</span>}</dd>
    </div>
  );
}

function EditModal({ station, options, onClose }: { station: StationDetail; options: Props["options"]; onClose: () => void }) {
  const form = useForm({
    name: station.name,
    tagline: station.tagline ?? "",
    description: station.description ?? "",
    visibility: station.visibility,
    accent_color: station.accent_color ?? "",
    language: station.language ?? "es",
    country: station.country ?? "",
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(`/admin/radios/${station.id}`, { preserveScroll: true, onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Editar datos de la radio"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-station" loading={form.processing}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="edit-station" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" error={form.errors.name} className="sm:col-span-2">
          {(id, invalid) => <Input id={id} invalid={invalid} maxLength={80} value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} />}
        </Field>
        <Field label="Eslogan" error={form.errors.tagline} className="sm:col-span-2">
          {(id, invalid) => <Input id={id} invalid={invalid} maxLength={140} value={form.data.tagline} onChange={(event) => form.setData("tagline", event.target.value)} />}
        </Field>
        <Field label="Descripción" error={form.errors.description} className="sm:col-span-2">
          {(id, invalid) => <Textarea id={id} invalid={invalid} rows={4} maxLength={2000} value={form.data.description} onChange={(event) => form.setData("description", event.target.value)} />}
        </Field>
        <Field label="Visibilidad" error={form.errors.visibility}>
          {(id, invalid) => (
            <Select id={id} invalid={invalid} value={form.data.visibility} onChange={(event) => form.setData("visibility", event.target.value)}>
              {options.visibility.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Color de acento" error={form.errors.accent_color}>
          {(id, invalid) => <Input id={id} invalid={invalid} placeholder="#e11d48" value={form.data.accent_color} onChange={(event) => form.setData("accent_color", event.target.value)} />}
        </Field>
        <Field label="Idioma" error={form.errors.language}>
          {(id, invalid) => (
            <Select id={id} invalid={invalid} value={form.data.language} onChange={(event) => form.setData("language", event.target.value)}>
              {options.languages.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="País" error={form.errors.country}>
          {(id, invalid) => (
            <Select id={id} invalid={invalid} value={form.data.country} onChange={(event) => form.setData("country", event.target.value)}>
              <option value="">Sin país</option>
              {options.countries.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Modal>
  );
}
