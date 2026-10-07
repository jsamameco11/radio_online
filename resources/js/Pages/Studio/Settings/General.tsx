import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Input, Select } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { dateTime } from "@/lib/format";
import type { Option } from "@/types/admin";

interface Props {
  settings: { name: string; visibility: string };
  visibilities: Option[];
  details: { frequency: string; owner: string; status_label: string; created_at: string; listen_url: string };
}

export default function GeneralSettings({ settings, visibilities, details }: Props) {
  const url = useStudioUrl();
  const form = useForm(settings);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/configuracion"), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Configuración">
      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <PageHeader eyebrow="Configuración" title="General" description="El nombre con el que te encuentran y quién puede ver tu radio." />

        <Panel
          title="Identidad"
          footer={
            <Button type="submit" loading={form.processing} disabled={!form.isDirty}>
              Guardar cambios
            </Button>
          }
        >
          <div className="space-y-4">
            <Field label="Nombre público" error={form.errors.name} hint={`Se muestra siempre junto a tu frecuencia: ${details.frequency} · ${form.data.name || "…"}`}>
              {(id, invalid) => <Input id={id} invalid={invalid} maxLength={80} value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} />}
            </Field>
            <Field label="Visibilidad" error={form.errors.visibility} hint="Con «solo con enlace» tu radio no aparece en la búsqueda ni en el dial público.">
              {(id, invalid) => (
                <Select id={id} invalid={invalid} value={form.data.visibility} onChange={(event) => form.setData("visibility", event.target.value)} className="max-w-xs">
                  {visibilities.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Panel>

        <Panel title="Datos de la radio">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Item label="Frecuencia" value={details.frequency} />
            <Item label="Propietario" value={details.owner} />
            <Item label="Estado" value={details.status_label} />
            <Item label="En la plataforma desde" value={dateTime(details.created_at, { dateStyle: "long" })} />
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Enlace público</dt>
              <dd>
                <a href={details.listen_url} target="_blank" rel="noreferrer" className="text-signal hover:underline">
                  {details.listen_url}
                </a>
              </dd>
            </div>
          </dl>
        </Panel>
      </form>
    </StudioLayout>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
