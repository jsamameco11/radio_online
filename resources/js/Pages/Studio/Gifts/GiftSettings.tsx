import { useForm, usePage } from "@inertiajs/react";
import type { FormEvent } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Input, Switch, Textarea } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { money } from "@/lib/format";
import type { SharedProps } from "@/types";

interface Props {
  settings: { enabled: boolean; min_gift_cents: number; thank_you_message: string };
  feePercent: number;
}

export default function GiftSettings({ settings, feePercent }: Props) {
  const { app } = usePage<SharedProps>().props;
  const url = useStudioUrl();
  const canEdit = useStudioCan()("station.settings");
  const form = useForm({ ...settings, min_gift: (settings.min_gift_cents / 100).toFixed(2) });

  form.transform(({ min_gift, ...data }) => ({ ...data, min_gift_cents: Math.round(Number(min_gift) * 100) }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/configuracion/regalos"), { preserveScroll: true });
  };

  const example = Math.max(settings.min_gift_cents, 1000);
  const exampleFee = Math.floor((example * feePercent + 50) / 100);

  return (
    <StudioLayout title="Configuración de regalos">
      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <PageHeader eyebrow="Configuración" title="Regalos" description="Decide si tu radio recibe regalos, desde qué monto y cómo agradeces a quien te apoya." />

        <Panel
          title="Recepción de regalos"
          footer={
            <div className="flex justify-end">
              <Button type="submit" loading={form.processing} disabled={!canEdit || !form.isDirty}>
                Guardar cambios
              </Button>
            </div>
          }
        >
          <div className="space-y-6">
            <Switch
              checked={form.data.enabled}
              onChange={(enabled) => form.setData("enabled", enabled)}
              disabled={!canEdit}
              label="Aceptar regalos"
              description="Si lo apagas, el botón de regalos desaparece de la página de tu radio."
            />

            <Field
              label={`Regalo mínimo (${app.currency})`}
              hint="Los regalos por debajo de este monto se rechazan. Mínimo US$ 1.00."
              error={form.errors.min_gift_cents}
            >
              {(id, invalid) => (
                <Input
                  id={id}
                  invalid={invalid}
                  type="number"
                  min={1}
                  max={1000}
                  step="0.01"
                  inputMode="decimal"
                  value={form.data.min_gift}
                  onChange={(event) => form.setData("min_gift", event.target.value)}
                  disabled={!canEdit}
                  className="max-w-40"
                />
              )}
            </Field>

            <Field label="Mensaje de agradecimiento" hint="Lo ve el oyente justo después de enviar su regalo." error={form.errors.thank_you_message}>
              {(id, invalid) => (
                <Textarea
                  id={id}
                  invalid={invalid}
                  maxLength={200}
                  rows={3}
                  value={form.data.thank_you_message}
                  onChange={(event) => form.setData("thank_you_message", event.target.value)}
                  disabled={!canEdit}
                />
              )}
            </Field>
          </div>
        </Panel>

        <Panel title="Cómo se reparte un regalo">
          <p className="text-sm text-muted">
            La plataforma retiene el {feePercent}% de cada regalo y el resto llega a la billetera de la radio al instante. Por ejemplo, de un regalo de{" "}
            <span className="font-medium text-ink">{money(example, app.currency)}</span>, la radio recibe{" "}
            <span className="font-medium text-onair">{money(example - exampleFee, app.currency)}</span> y la comisión es de{" "}
            <span className="font-medium text-ink">{money(exampleFee, app.currency)}</span>.
          </p>
        </Panel>
      </form>
    </StudioLayout>
  );
}
