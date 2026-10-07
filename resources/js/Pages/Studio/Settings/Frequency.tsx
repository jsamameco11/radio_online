import { router, useForm } from "@inertiajs/react";
import { ArrowRight, RadioTower } from "lucide-react";
import type { FormEvent } from "react";
import { PageErrors } from "@/Components/forms/page-errors";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Field, Input, Textarea } from "@/Components/ui/field";
import { PageHeader } from "@/Components/ui/page-header";
import { Panel } from "@/Components/ui/panel";
import StudioLayout, { useStudioCan, useStudioUrl } from "@/Layouts/StudioLayout";
import { dateTime } from "@/lib/format";

interface ChangeRequest {
  id: number;
  frequency: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  status_label: string;
  requested_by: string;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface Props {
  frequency: { label: string; display: string; activated_at: string | null };
  pending: number | null;
  requests: ChangeRequest[];
  history: { from: string | null; to: string | null; at: string }[];
  suggestions: string[];
  open: boolean;
}

const TONES = { pending: "warning", approved: "onair", rejected: "danger", cancelled: "neutral" } as const;

export default function FrequencySettings({ frequency, pending, requests, history, suggestions, open }: Props) {
  const url = useStudioUrl();
  const canEdit = useStudioCan()("station.settings");
  const form = useForm({ frequency: "", reason: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(url("/configuracion/frecuencia"), { preserveScroll: true, onSuccess: () => form.reset() });
  };

  return (
    <StudioLayout title="Frecuencia">
      <div className="max-w-3xl space-y-6">
        <PageHeader eyebrow="Configuración" title="Frecuencia" description="Tu lugar en el dial. Puedes pedir mudarte a otra frecuencia libre; el equipo de la plataforma lo revisa." />

        <Panel>
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-signal-soft text-signal">
              <RadioTower className="size-6" />
            </span>
            <div>
              <p className="font-display text-3xl font-semibold tabular">{frequency.display}</p>
              {frequency.activated_at && <p className="text-xs text-muted">Transmites aquí desde el {dateTime(frequency.activated_at, { dateStyle: "long" })}</p>}
            </div>
          </div>
        </Panel>

        <PageErrors only={["request"]} />

        {pending === null && canEdit && (
          <form onSubmit={submit}>
            <Panel
              title="Pedir un cambio de frecuencia"
              description={open ? "Al aprobarse, tu radio se muda y la frecuencia actual queda libre. Tus suscriptores te siguen encontrando." : "Las solicitudes están cerradas por ahora."}
              footer={
                <Button type="submit" loading={form.processing} disabled={!open || form.data.frequency === "" || form.data.reason.trim().length < 20}>
                  Enviar solicitud
                </Button>
              }
            >
              <div className="space-y-4">
                <Field label="Nueva frecuencia" error={form.errors.frequency} hint="Escribe una frecuencia libre, por ejemplo 95.50, o elige una cercana.">
                  {(id, invalid) => (
                    <div className="space-y-2">
                      <Input id={id} invalid={invalid} value={form.data.frequency} onChange={(event) => form.setData("frequency", event.target.value)} placeholder="95.50" className="max-w-32 tabular" disabled={!open} />
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((label) => (
                          <Button key={label} size="sm" variant={form.data.frequency === label ? "primary" : "secondary"} onClick={() => form.setData("frequency", label)} disabled={!open}>
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </Field>
                <Field label="Motivo" error={form.errors.reason} hint="Al menos 20 caracteres.">
                  {(id, invalid) => <Textarea id={id} invalid={invalid} rows={4} maxLength={1000} value={form.data.reason} onChange={(event) => form.setData("reason", event.target.value)} disabled={!open} />}
                </Field>
              </div>
            </Panel>
          </form>
        )}

        <Panel title="Solicitudes" padded={requests.length === 0}>
          {requests.length === 0 ? (
            <p className="text-sm text-muted">No pediste cambios de frecuencia.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {requests.map((item) => (
                <li key={item.id} className="space-y-1 px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium tabular">{item.frequency}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={TONES[item.status]}>{item.status_label}</Badge>
                      {item.status === "pending" && canEdit && (
                        <Button size="sm" variant="ghost" onClick={() => router.delete(url(`/configuracion/frecuencia/solicitudes/${item.id}`), { preserveScroll: true })}>
                          Retirar
                        </Button>
                      )}
                    </span>
                  </div>
                  {item.reason && <p className="text-muted">{item.reason}</p>}
                  <p className="text-xs text-faint">
                    {item.requested_by} · {dateTime(item.created_at, { dateStyle: "medium" })}
                    {item.review_note && <span className="mt-1 block text-ink">Respuesta: “{item.review_note}”</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {history.length > 0 && (
          <Panel title="Historial en el dial">
            <ul className="space-y-2 text-sm">
              {history.map((move) => (
                <li key={move.at} className="flex items-center gap-2">
                  <span className="tabular">{move.from}</span>
                  <ArrowRight className="size-3.5 text-faint" />
                  <span className="font-medium tabular">{move.to}</span>
                  <span className="text-xs text-muted">· {dateTime(move.at, { dateStyle: "medium" })}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </StudioLayout>
  );
}
