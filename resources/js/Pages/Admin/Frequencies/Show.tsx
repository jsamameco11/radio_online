import { Link, router, useForm } from "@inertiajs/react";
import { ArrowLeft, Lock, Radio, Tag, Unlock, Wrench } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
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
import { cn } from "@/lib/cn";
import { count, dateTime, money, rating } from "@/lib/format";
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
    price_cents: number | null;
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
  onSale: boolean;
  pricing: Pricing;
  can: { assign: boolean; release: boolean; enterStudio: boolean };
}

interface Pricing {
  minPriceCents: number;
  maxPriceCents: number;
  processorFeePercent: number;
}

export default function FrequencyShow({ frequency, station, closedStations, requests, history, categories, maxCategories, onSale, pricing, can }: Props) {
  const appUrl = useAppUrl();
  const [assigning, setAssigning] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
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
              {frequency.price_cents !== null && (
                <Badge tone="gold" className="tabular">
                  <Tag className="size-3" /> Se solicita pagando {money(frequency.price_cents)}
                </Badge>
              )}
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
              {can.assign && free && frequency.status === "reserved" && !onSale && (
                <Button variant="secondary" icon={<Tag className="size-4" />} onClick={() => setPricingOpen(true)}>
                  {frequency.price_cents === null ? "Ponerle precio" : "Cambiar precio"}
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

        {!assigning && !reserving && !pricingOpen && <PageErrors />}

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
                      <span>
                        {count(station.listener_count)} {station.listener_count === 1 ? "persona conectada" : "personas conectadas"}
                      </span>
                      <span>
                        {station.rating_count > 0
                          ? `${rating(station.rating_average)} · ${count(station.rating_count)} ${station.rating_count === 1 ? "calificación" : "calificaciones"}`
                          : "Sin calificaciones"}
                      </span>
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
                      <span className="flex flex-wrap items-center justify-end gap-1.5">
                        {item.payment && (
                          <Badge tone={item.payment.status.value === "paid" ? "onair" : item.payment.needs_attention ? "danger" : "gold"} className="tabular">
                            {item.payment.amount} · {item.payment.status.label}
                          </Badge>
                        )}
                        <Badge tone={item.status === "approved" ? "onair" : item.status === "pending" || item.status === "awaiting_payment" ? "warning" : "neutral"}>{item.status_label}</Badge>
                      </span>
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

      <ReserveModal open={reserving} onClose={() => setReserving(false)} url={`${url}/reservar`} display={frequency.display} pricing={pricing} />
      {pricingOpen && <PriceModal onClose={() => setPricingOpen(false)} url={`${url}/precio`} display={frequency.display} priceCents={frequency.price_cents} pricing={pricing} />}
      <AssignModal open={assigning} onClose={() => setAssigning(false)} url={`${url}/asignar`} display={frequency.display} categories={categories} maxCategories={maxCategories} />
    </AdminLayout>
  );
}

const toCents = (price: string) => (price.trim() === "" ? null : Math.round(Number(price.replace(",", ".")) * 100));

function ReserveModal({ open, onClose, url, display, pricing }: { open: boolean; onClose: () => void; url: string; display: string; pricing: Pricing }) {
  const form = useForm({ note: "", priced: false, price: "" });
  const errors: Partial<Record<string, string>> = form.errors;

  form.transform(({ note, priced, price }) => ({ note: note.trim() || null, price_cents: priced ? toCents(price) : null }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(url, { preserveScroll: true, onSuccess: () => (form.reset(), onClose()) });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reservar ${display}`}
      description={form.data.priced ? "Cualquiera podrá solicitarlo desde “Obtén tu canal”, pagando este precio solo si apruebas su solicitud." : "Nadie podrá pedirlo mientras esté reservado."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="reserve-frequency" loading={form.processing} icon={form.data.priced ? <Tag className="size-4" /> : <Lock className="size-4" />}>
            {form.data.priced ? "Reservar con precio" : "Reservar"}
          </Button>
        </>
      }
    >
      <form id="reserve-frequency" onSubmit={submit} className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de reserva">
          <ReserveOption active={!form.data.priced} onClick={() => form.setData("priced", false)} icon={<Lock className="size-4" />} title="Solo reservar" text="Nadie puede pedirla. Úsala para asignarla tú." />
          <ReserveOption
            active={form.data.priced}
            onClick={() => form.setData("priced", true)}
            icon={<Tag className="size-4" />}
            title="Reservar con precio"
            text="Se solicita con el formulario y se cobra al aprobar."
          />
        </div>
        {form.data.priced && <PriceField value={form.data.price} onChange={(value) => form.setData("price", value)} error={errors.price_cents} pricing={pricing} autoFocus />}
        <Field label="Nota interna" hint="Opcional: para quién o por qué se reserva." error={errors.note}>
          {(id, invalid) => <Textarea id={id} invalid={invalid} rows={3} maxLength={300} value={form.data.note} onChange={(event) => form.setData("note", event.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}

function ReserveOption({ active, onClick, icon, title, text }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; text: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl p-3 text-left ring-1 transition",
        active ? "bg-signal-soft ring-2 ring-signal" : "bg-surface ring-line hover:bg-raised",
      )}
    >
      <span className={cn("flex items-center gap-2 text-sm font-semibold", active ? "text-signal" : "text-ink")}>
        {icon}
        {title}
      </span>
      <span className="text-xs text-muted">{text}</span>
    </button>
  );
}

function PriceField({ value, onChange, error, pricing, autoFocus }: { value: string; onChange: (value: string) => void; error?: string; pricing: Pricing; autoFocus?: boolean }) {
  const cents = toCents(value) ?? 0;
  const fee = Math.round((cents * pricing.processorFeePercent) / 100);

  return (
    <div className="space-y-2">
      <Field label="Precio (USD)" hint={`Entre ${money(pricing.minPriceCents)} y ${money(pricing.maxPriceCents)}`} error={error}>
        {(id, invalid) => (
          <Input
            id={id}
            invalid={invalid}
            type="number"
            inputMode="decimal"
            required
            min={pricing.minPriceCents / 100}
            max={pricing.maxPriceCents / 100}
            step="0.01"
            placeholder={(pricing.minPriceCents / 100).toFixed(2)}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="tabular"
            autoFocus={autoFocus}
          />
        )}
      </Field>
      {cents > 0 && (
        <p className="rounded-xl bg-raised px-3 py-2 text-sm text-muted tabular">
          Pasarela de pago ({pricing.processorFeePercent}%) − {money(fee)} · Para la plataforma <strong className="text-ink">{money(cents - fee)}</strong>
        </p>
      )}
    </div>
  );
}

function PriceModal({ onClose, url, display, priceCents, pricing }: { onClose: () => void; url: string; display: string; priceCents: number | null; pricing: Pricing }) {
  const form = useForm({ price: priceCents === null ? "" : (priceCents / 100).toFixed(2) });
  const errors: Partial<Record<string, string>> = form.errors;

  const save = (price: string) => {
    form.transform(() => ({ price_cents: toCents(price) }));
    form.post(url, { preserveScroll: true, onSuccess: onClose });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save(form.data.price);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={priceCents === null ? `Ponerle precio a ${display}` : `Precio de ${display}`}
      description="Con precio, cualquiera puede solicitarlo desde “Obtén tu canal”: registra su tarjeta y se le cobra solo si apruebas. Las solicitudes ya enviadas conservan el precio que aceptaron."
      footer={
        <>
          {priceCents !== null && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              disabled={form.processing}
              onClick={() => confirm(`¿Quitarle el precio a ${display}? Quedará reservada y nadie podrá solicitarla.`) && save("")}
            >
              Quitar precio
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="frequency-price" loading={form.processing} icon={<Tag className="size-4" />}>
            Guardar precio
          </Button>
        </>
      }
    >
      <form id="frequency-price" onSubmit={submit}>
        <PriceField value={form.data.price} onChange={(value) => form.setData("price", value)} error={errors.price_cents} pricing={pricing} autoFocus />
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
