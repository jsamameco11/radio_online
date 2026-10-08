import { Link, useForm } from "@inertiajs/react";
import { ArrowLeft, Maximize2 } from "lucide-react";
import type { FormEvent } from "react";
import { AuditList } from "@/Components/admin/audit-list";
import { Button } from "@/Components/ui/button";
import { Field, Input } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel, Stat } from "@/Components/ui/panel";
import AdminLayout from "@/Layouts/AdminLayout";
import { count } from "@/lib/format";
import type { AuditEntry } from "@/types/admin";

interface Props {
  current: number;
  configured: number;
  capacity: number;
  band: { min: number; max: number };
  history: AuditEntry[];
}

const PRESETS = [1000, 1500, 2000];

export default function ExpandDial({ current, configured, capacity, band, history }: Props) {
  const form = useForm({ size: String(Math.min(capacity, Math.max(current + 1, Math.ceil((current + 1) / 500) * 500))) });
  const size = Number(form.data.size) || 0;
  const adding = Math.max(0, size - current);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (confirm(`¿Ampliar el dial a ${count(size)} frecuencias? Las radios existentes no se mueven.`)) {
      form.post("/admin/frecuencias/ampliar");
    }
  };

  return (
    <AdminLayout title="Ampliar el dial">
      <div className="max-w-4xl space-y-6">
        <Link href="/admin/frecuencias" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" />
          Frecuencias
        </Link>

        <PageHeader
          eyebrow="Dial"
          title="Ampliar el dial"
          description={`Suma frecuencias nuevas entre ${band.min.toFixed(2)} y ${band.max.toFixed(2)}. Las frecuencias existentes y sus radios nunca cambian de lugar.`}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="En el dial" value={count(current)} />
          <Stat label="Configurado (DIAL_SIZE)" value={count(configured)} hint="Lo que crea el seeder en una instalación nueva" />
          <Stat label="Máximo de la banda" value={count(capacity)} hint="Una frecuencia cada 0.01 MHz" />
        </div>

        {current >= capacity ? (
          <Panel>
            <p className="text-sm text-muted">El dial ya usa todas las frecuencias posibles de la banda.</p>
          </Panel>
        ) : (
          <form onSubmit={submit}>
            <Panel
              title="Nuevo tamaño"
              footer={
                <Button type="submit" icon={<Maximize2 className="size-4" />} loading={form.processing} disabled={adding === 0 || size > capacity}>
                  Ampliar a {count(size)}
                </Button>
              }
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {PRESETS.filter((preset) => preset > current && preset <= capacity).map((preset) => (
                    <Button key={preset} size="sm" variant={size === preset ? "primary" : "secondary"} onClick={() => form.setData("size", String(preset))}>
                      {count(preset)}
                    </Button>
                  ))}
                  <Button size="sm" variant={size === capacity ? "primary" : "secondary"} onClick={() => form.setData("size", String(capacity))}>
                    Todas ({count(capacity)})
                  </Button>
                </div>
                <Field
                  label="Cantidad total de frecuencias"
                  hint={adding > 0 ? `Se crearán ${count(adding)} frecuencias nuevas, todas libres.` : `Debe ser mayor que ${count(current)}.`}
                  error={form.errors.size}
                >
                  {(id, invalid) => (
                    <Input id={id} invalid={invalid} type="number" min={current + 1} max={capacity} value={form.data.size} onChange={(event) => form.setData("size", event.target.value)} className="max-w-48" />
                  )}
                </Field>
                <p className="text-xs text-muted">Para que una instalación nueva tenga el mismo dial, actualiza también DIAL_SIZE en el entorno.</p>
              </div>
            </Panel>
          </form>
        )}

        <Panel title="Ampliaciones anteriores">
          <AuditList entries={history} showStation={false} />
        </Panel>
      </div>
    </AdminLayout>
  );
}
