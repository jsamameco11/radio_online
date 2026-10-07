import { useForm, usePage } from "@inertiajs/react";
import type { FormEvent } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Input, Switch, Textarea } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import AdminLayout from "@/Layouts/AdminLayout";
import { ago, count, money } from "@/lib/format";
import type { SharedProps } from "@/types";

interface Settings {
  registrations_open: boolean;
  frequency_requests_open: boolean;
  maintenance_banner: string | null;
  max_pending_requests: number;
  stale_heartbeat_seconds: number;
}

interface Props {
  settings: Settings;
  lastChange: { at: string | null; by: string | null } | null;
  fixed: {
    currency: string;
    min_deposit_cents: number;
    max_deposit_cents: number;
    processor_fee_percent: number;
    platform_fee_percent: number;
    min_withdrawal_cents: number;
    dial_size: number;
    max_categories: number;
    max_permanent_hashtags: number;
    max_topic_hashtags: number;
  };
}

export default function PlatformSettings({ settings, lastChange, fixed }: Props) {
  const { app } = usePage<SharedProps>().props;
  const form = useForm({ ...settings, maintenance_banner: settings.maintenance_banner ?? "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put("/admin/configuracion", { preserveScroll: true });
  };

  return (
    <AdminLayout title="Configuración">
      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <PageHeader
          eyebrow="Plataforma"
          title="Configuración"
          description={lastChange?.at ? `Último cambio ${ago(lastChange.at)}${lastChange.by ? ` por ${lastChange.by}` : ""}.` : "Interruptores que se aplican al instante en toda la plataforma."}
        />

        <Panel
          title="Acceso"
          footer={
            <Button type="submit" loading={form.processing} disabled={!form.isDirty}>
              Guardar cambios
            </Button>
          }
        >
          <div className="space-y-5">
            <Switch checked={form.data.registrations_open} onChange={(value) => form.setData("registrations_open", value)} label="Registros abiertos" description="Si lo apagas, nadie nuevo puede crear una cuenta." />
            <Switch
              checked={form.data.frequency_requests_open}
              onChange={(value) => form.setData("frequency_requests_open", value)}
              label="Solicitudes de frecuencia abiertas"
              description="Permite pedir una frecuencia para abrir una radio o mudarse a otra."
            />
            <Field label="Solicitudes pendientes por persona" error={form.errors.max_pending_requests} hint="Cuántas solicitudes puede tener alguien esperando revisión a la vez.">
              {(id, invalid) => (
                <Input id={id} invalid={invalid} type="number" min={1} max={10} value={form.data.max_pending_requests} onChange={(event) => form.setData("max_pending_requests", Number(event.target.value))} className="max-w-32" />
              )}
            </Field>
            <Field label="Alerta de radio sin señal (segundos)" error={form.errors.stale_heartbeat_seconds} hint="Una radio al aire que no envía señal en este tiempo se marca en el monitor.">
              {(id, invalid) => (
                <Input id={id} invalid={invalid} type="number" min={30} max={900} value={form.data.stale_heartbeat_seconds} onChange={(event) => form.setData("stale_heartbeat_seconds", Number(event.target.value))} className="max-w-32" />
              )}
            </Field>
            <Field label="Aviso de mantenimiento" error={form.errors.maintenance_banner} hint="Se muestra arriba en todas las páginas mientras tenga texto. Déjalo vacío para quitarlo.">
              {(id, invalid) => (
                <Textarea id={id} invalid={invalid} rows={2} maxLength={300} value={form.data.maintenance_banner} onChange={(event) => form.setData("maintenance_banner", event.target.value)} />
              )}
            </Field>
          </div>
        </Panel>

        <Panel title="Valores fijos" description="Vienen de la configuración del servidor; se cambian en el entorno y requieren un despliegue.">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Fixed label="Moneda" value={fixed.currency} />
            <Fixed label="Costo del procesador de pagos" value={`${fixed.processor_fee_percent}% de cada regalo o destacado`} />
            <Fixed label="Ganancia de la plataforma" value={`${fixed.platform_fee_percent}% de cada regalo o destacado`} />
            <Fixed label="La radio recibe" value={`${100 - fixed.processor_fee_percent - fixed.platform_fee_percent}%`} />
            <Fixed label="Retiro mínimo de una radio" value={money(fixed.min_withdrawal_cents, app.currency)} />
            <Fixed label="Recarga mínima" value={money(fixed.min_deposit_cents, app.currency)} />
            <Fixed label="Recarga máxima" value={money(fixed.max_deposit_cents, app.currency)} />
            <Fixed label="Tamaño del dial (DIAL_SIZE)" value={count(fixed.dial_size)} />
            <Fixed label="Categorías por radio" value={String(fixed.max_categories)} />
            <Fixed label="Hashtags permanentes" value={String(fixed.max_permanent_hashtags)} />
            <Fixed label="Hashtags por tema" value={String(fixed.max_topic_hashtags)} />
          </dl>
        </Panel>
      </form>
    </AdminLayout>
  );
}

function Fixed({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-xl border border-line px-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink tabular">{value}</dd>
    </div>
  );
}
