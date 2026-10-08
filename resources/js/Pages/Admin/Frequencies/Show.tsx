import { Link, router, useForm } from "@inertiajs/react";
import { ArrowLeft, Lock, Radio, Unlock, Wrench } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { AuditList } from "@/Components/admin/audit-list";
import { frequencyTones } from "@/Components/admin/status-tones";
import { CategoryPicker } from "@/Components/forms/category-picker";
import { fieldError } from "@/Components/forms/field-error";
import { PageErrors } from "@/Components/forms/page-errors";
import { FrequencyTitle, StationLogo, StreamStatusBadge } from "@/Components/station/station-identity";
import { Badge } from "@/Components/ui/badge";
import { Button, ButtonLink, buttonClasses } from "@/Components/ui/button";
import { Field, Input, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import AdminLayout from "@/Layouts/AdminLayout";
import { useAppUrl } from "@/lib/app-url";
import { count, dateTime } from "@/lib/format";
import type { AuditEntry, FrequencyRequestRow, FrequencyStatusValue, StationRow } from "@/types/admin";
import type { CategoryGroupOption } from "@/types/station-admin";

interface Props {
  frequency: {
    id: number;
    label: string;
    slug: string;
    band: string;
    display: string;
    mhz: number;
    status: FrequencyStatusValue;
    status_label: string;
    reserved_at: string | null;
    activated_at: string | null;
    created_at: string | null;
  };
  station: StationRow | null;
  closedStations: StationRow[];
  requests: FrequencyRequestRow[];
  history: AuditEntry[];
  categories: { id: number; name: string; group: string; group_label: string }[];
  maxCategories: number;
  can: { assign: boolean; release: boolean; enterStudio: boolean };
}

export default function FrequencyShow({ frequency, station, closedStations, requests, history, categories, maxCategories, can }: Props) {
  const appUrl = useAppUrl();
  const [assigning, setAssigning] = useState(false);
  const [reserving, setReserving] = useState(false);
  const free = station === null;
  const url = `/admin/frecuencias/${frequency.slug}`;

  const post = (path: string, data: Record<string, string | boolean> = {}) => router.post(`${url}/${path}`, data, { preserveScroll: true });

  return (
    <AdminLayout title={`Frecuencia ${frequency.display}`}>
      <div className="space-y-6">
        <Link href="/admin/frecuencias" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" />
          Frecuencias
        </Link>

        <PageHeader
          eyebrow="Frecuencia"
          title={<span className="tabular">{frequency.display}</span>}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={frequencyTones[frequency.status]}>{frequency.status_label}</Badge>
              {frequency.reserved_at && <span>Reservada el {dateTime(frequency.reserved_at)}</span>}
              {frequency.activated_at && <span>Activa desde el {dateTime(frequency.activated_at)}</span>}
            </span>
          }
          actions={
            <>
              {can.assign && free && frequency.status === "available" && (
                <Button variant="secondary" icon={<Lock className="size-4" />} onClick={() => setReserving(true)}>
                  Reservar
                </Button>
              )}
              {can.assign && free && ["available", "reserved"].includes(frequency.status) && (
                <Button icon={<Radio className="size-4" />} onClick={() => setAssigning(true)}>
                  Asignar a una radio
                </Button>
              )}
              {can.release && free && frequency.status !== "available" && (
                <Button variant="ghost" icon={<Unlock className="size-4" />} onClick={() => confirm(`¿Liberar ${frequency.display}? Quedará disponible para cualquiera.`) && post("liberar")}>
                  Liberar
                </Button>
              )}
              {can.assign && (
                <Button
                  variant={frequency.status === "maintenance" ? "primary" : "ghost"}
                  icon={<Wrench className="size-4" />}
                  onClick={() => post("mantenimiento", { maintenance: frequency.status !== "maintenance" })}
                >
                  {frequency.status === "maintenance" ? "Terminar mantenimiento" : "Mantenimiento"}
                </Button>
              )}
            </>
          }
        />

        {!assigning && !reserving && <PageErrors />}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Panel title="Radio en esta frecuencia">
              {station ? (
                <div className="flex flex-wrap items-center gap-4">
                  <StationLogo station={station} size="md" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <FrequencyTitle station={station} size="md" />
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      <StreamStatusBadge status={station.stream_status.value} />
                      {station.status === "suspended" && <Badge tone="danger">Suspendida</Badge>}
                      <span>{count(station.listener_count)} oyentes</span>
                      <span>{count(station.follower_count)} suscriptores</span>
                      <span>
                        {station.owner.name} · {station.owner.email}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <ButtonLink href={`/admin/radios/${station.id}`} variant="secondary" size="sm">
                      Ver radio
                    </ButtonLink>
                    {can.enterStudio && (
                      <a href={appUrl("studio", `/${frequency.slug}`)} target="_blank" rel="noreferrer" className={buttonClasses("ghost", "sm")}>
                        Entrar al estudio
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">Nadie transmite en {frequency.display}.</p>
              )}
            </Panel>

            <Panel title="Solicitudes de esta frecuencia" padded={requests.length === 0}>
              {requests.length === 0 ? (
                <p className="text-sm text-muted">Nadie pidió esta frecuencia todavía.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {requests.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <span className="min-w-0">
                        <span className="block font-medium">{item.station_name}</span>
                        <span className="text-xs text-muted">
                          {item.kind_label} · {item.user.name} · {dateTime(item.created_at, { dateStyle: "medium" })}
                        </span>
                      </span>
                      <Badge tone={item.status === "approved" ? "onair" : item.status === "pending" ? "warning" : "neutral"}>{item.status_label}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {closedStations.length > 0 && (
              <Panel title="Radios que estuvieron aquí" padded={false}>
                <ul className="divide-y divide-line">
                  {closedStations.map((closed) => (
                    <li key={closed.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <Link href={`/admin/radios/${closed.id}`} className="font-medium hover:underline">
                        {closed.name}
                      </Link>
                      <span className="text-xs text-muted">Cerrada el {closed.deleted_at ? dateTime(closed.deleted_at, { dateStyle: "medium" }) : "—"}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          <Panel title="Historial">
            <AuditList entries={history} showStation={false} />
          </Panel>
        </div>
      </div>

      <ReserveModal open={reserving} onClose={() => setReserving(false)} url={`${url}/reservar`} display={frequency.display} />
      <AssignModal open={assigning} onClose={() => setAssigning(false)} url={`${url}/asignar`} display={frequency.display} categories={categories} maxCategories={maxCategories} />
    </AdminLayout>
  );
}

function ReserveModal({ open, onClose, url, display }: { open: boolean; onClose: () => void; url: string; display: string }) {
  const form = useForm({ note: "" });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(url, { preserveScroll: true, onSuccess: () => (form.reset(), onClose()) });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reservar ${display}`}
      description="Nadie podrá pedirla mientras esté reservada."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="reserve-frequency" loading={form.processing}>
            Reservar
          </Button>
        </>
      }
    >
      <form id="reserve-frequency" onSubmit={submit}>
        <Field label="Nota interna" hint="Opcional: para quién o por qué se reserva." error={form.errors.note}>
          {(id, invalid) => <Textarea id={id} invalid={invalid} rows={3} maxLength={300} value={form.data.note} onChange={(event) => form.setData("note", event.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}

function AssignModal({
  open,
  onClose,
  url,
  display,
  categories,
  maxCategories,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  display: string;
  categories: Props["categories"];
  maxCategories: number;
}) {
  const form = useForm<{ email: string; name: string; categories: number[] }>({ email: "", name: "", categories: [] });
  const groups: CategoryGroupOption[] = Object.values(
    categories.reduce<Record<string, CategoryGroupOption>>((result, category) => {
      result[category.group] ??= { value: category.group, label: category.group_label, categories: [] };
      result[category.group].categories.push({ id: category.id, name: category.name });
      return result;
    }, {}),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(url, { preserveScroll: true });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Asignar ${display}`}
      description="Crea la radio en esta frecuencia para una cuenta existente. Le avisaremos por correo."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="assign-frequency" loading={form.processing}>
            Crear la radio
          </Button>
        </>
      }
    >
      <form id="assign-frequency" onSubmit={submit} className="space-y-5">
        <Field label="Correo del propietario" error={form.errors.email}>
          {(id, invalid) => <Input id={id} invalid={invalid} type="email" value={form.data.email} onChange={(event) => form.setData("email", event.target.value)} autoComplete="off" />}
        </Field>
        <Field label="Nombre de la radio" error={fieldError(form.errors, "name", "frequency")}>
          {(id, invalid) => <Input id={id} invalid={invalid} maxLength={80} value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} />}
        </Field>
        <Field label="Categorías" error={fieldError(form.errors, "categories")}>
          {() => <CategoryPicker groups={groups} value={form.data.categories} onChange={(value) => form.setData("categories", value)} max={maxCategories} />}
        </Field>
      </form>
    </Modal>
  );
}
