import { useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import { Button } from "@/Components/ui/button";
import { Switch } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";

interface Settings {
  show_listener_count: boolean;
  show_follower_count: boolean;
  show_top_supporters: boolean;
  allow_anonymous_gifts: boolean;
  show_team: boolean;
}

const OPTIONS: { key: keyof Settings; label: string; description: string }[] = [
  { key: "show_listener_count", label: "Mostrar oyentes en vivo", description: "El contador de personas escuchando ahora." },
  { key: "show_follower_count", label: "Mostrar seguidores", description: "La cantidad de seguidores en tu página." },
  { key: "show_top_supporters", label: "Mostrar a quienes más te apoyan", description: "El ranking de regalos en tu página." },
  { key: "allow_anonymous_gifts", label: "Permitir regalos anónimos", description: "El oyente puede ocultar su nombre al enviar un regalo." },
  { key: "show_team", label: "Mostrar el equipo", description: "Los nombres y roles de tu equipo en la página pública." },
];

export default function PrivacySettings({ settings }: { settings: Settings }) {
  const url = useStudioUrl();
  const form = useForm(settings);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.put(url("/configuracion/privacidad"), { preserveScroll: true });
  };

  return (
    <StudioLayout title="Privacidad">
      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <PageHeader eyebrow="Configuración" title="Privacidad" description="Qué datos de tu radio ven los oyentes." />
        <Panel
          title="Página pública"
          footer={
            <Button type="submit" loading={form.processing} disabled={!form.isDirty}>
              Guardar cambios
            </Button>
          }
        >
          <div className="space-y-5">
            {OPTIONS.map((item) => (
              <Switch key={item.key} checked={form.data[item.key]} onChange={(value) => form.setData(item.key, value)} label={item.label} description={item.description} />
            ))}
          </div>
        </Panel>
      </form>
    </StudioLayout>
  );
}
