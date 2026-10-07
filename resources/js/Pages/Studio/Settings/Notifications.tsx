import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { Button } from "@/Components/ui/button";
import { Field, Select, Switch } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import type { Option } from "@/types/admin";

interface Settings {
  recipients: string;
  email_new_follower: boolean;
  email_gift_received: boolean;
  email_report_received: boolean;
  email_stream_problems: boolean;
  email_weekly_summary: boolean;
}

const EMAILS: { key: Exclude<keyof Settings, "recipients">; label: string; description: string }[] = [
  { key: "email_gift_received", label: "Regalos recibidos", description: "Un correo por cada regalo." },
  { key: "email_new_follower", label: "Nuevos seguidores", description: "Un correo cada vez que alguien te sigue." },
  { key: "email_report_received", label: "Reportes", description: "Cuando un oyente reporta contenido de tu radio." },
  { key: "email_stream_problems", label: "Problemas de transmisión", description: "Si tu radio pierde la señal mientras está al aire." },
  { key: "email_weekly_summary", label: "Resumen semanal", description: "Oyentes, horas y regalos de la semana, cada lunes." },
];

export default function NotificationSettings({ settings, recipients }: { settings: Settings; recipients: Option[] }) {
  const url = useStudioUrl();
  const form = useForm(settings);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/configuracion/notificaciones"), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Notificaciones">
      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <PageHeader eyebrow="Configuración" title="Notificaciones" description="Qué avisos por correo envía tu radio y a quién." />
        <Panel
          title="Correos"
          footer={
            <Button type="submit" loading={form.processing} disabled={!form.isDirty}>
              Guardar cambios
            </Button>
          }
        >
          <div className="space-y-5">
            <Field label="¿Quién los recibe?" error={form.errors.recipients}>
              {(id, invalid) => (
                <Select id={id} invalid={invalid} value={form.data.recipients} onChange={(event) => form.setData("recipients", event.target.value)} className="max-w-xs">
                  {recipients.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {EMAILS.map((item) => (
              <Switch key={item.key} checked={form.data[item.key]} onChange={(value) => form.setData(item.key, value)} label={item.label} description={item.description} />
            ))}
          </div>
        </Panel>
      </form>
    </StudioLayout>
  );
}
