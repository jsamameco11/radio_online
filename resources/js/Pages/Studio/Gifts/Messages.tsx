import { router, useForm } from "@inertiajs/react";
import { Check, Eye, EyeOff, Flag, Mail, Mic } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Avatar } from "@/Components/ui/avatar";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { EmptyState } from "@/Components/ui/empty-state";
import { Field, Select, Textarea } from "@/Components/ui/field";
import { Modal } from "@/Components/ui/modal";
import { PageHeader } from "@/Components/ui/page-header";
import { Pagination } from "@/Components/ui/pagination";
import { Tabs } from "@/Components/ui/tabs";
import StudioLayout, { useStudioUrl } from "@/Layouts/StudioLayout";
import { ago, duration } from "@/lib/format";
import { http } from "@/lib/http";
import type { Paginated } from "@/types";
import type { Labeled, ReceivedGift } from "@/types/wallet";

type Tab = "pendientes" | "escuchados" | "ocultos" | "todos";

interface Props {
  tab: Tab;
  counts: Record<Tab, number>;
  reasons: Labeled[];
  gifts: Paginated<ReceivedGift>;
}

export default function Messages({ tab, counts, reasons, gifts }: Props) {
  const url = useStudioUrl();
  const [reporting, setReporting] = useState<string | null>(null);

  const markPlayed = (messageId: string) =>
    http.post(url(`/mensajes/${messageId}/reproducido`)).then(() => router.reload({ only: ["gifts", "counts"] }));

  const setVisible = (messageId: string, visible: boolean) =>
    router.patch(url(`/mensajes/${messageId}/visibilidad`), { visible }, { preserveScroll: true });

  return (
    <StudioLayout title="Mensajes">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Audiencia"
          title="Mensajes de los oyentes"
          description="Los textos y notas de voz que llegan con cada regalo. Escúchalos antes de ponerlos al aire."
        />

        <Tabs
          value={tab}
          onChange={(estado) => router.get(url("/mensajes"), { estado }, { preserveState: true, replace: true })}
          items={[
            { value: "pendientes", label: "Por escuchar", count: counts.pendientes },
            { value: "escuchados", label: "Escuchados", count: counts.escuchados },
            { value: "ocultos", label: "Ocultos", count: counts.ocultos },
            { value: "todos", label: "Todos", count: counts.todos },
          ]}
        />

        {gifts.data.length === 0 ? (
          <EmptyState icon={<Mail className="size-6" />} title="No hay mensajes aquí" description="Cuando un oyente acompañe su regalo con un mensaje, lo verás en esta bandeja." />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {gifts.data.map((gift) => {
              const message = gift.message;
              if (!message) return null;
              const visible = message.status.value === "visible";

              return (
                <li key={gift.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
                  <div className="flex items-start gap-3">
                    {gift.sender ? <Avatar name={gift.sender.name} src={gift.sender.avatar_url} size="sm" /> : <Avatar name="?" size="sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">{gift.sender?.name ?? "Oyente anónimo"}</span>
                        <span className="text-muted">
                          {" "}
                          · {gift.gift?.emoji} {gift.gift?.name}
                          {gift.quantity > 1 && ` ×${gift.quantity}`}
                        </span>
                      </p>
                      <p className="text-xs text-faint">{ago(gift.created_at)}</p>
                    </div>
                    {!visible ? (
                      <Badge tone={message.status.value === "reported" ? "danger" : "neutral"}>{message.status.label}</Badge>
                    ) : message.played_at ? (
                      <Badge tone="onair">
                        <Check className="size-3" /> {message.played_by ? `Escuchado por ${message.played_by}` : "Escuchado"}
                      </Badge>
                    ) : (
                      <Badge tone="signal">Nuevo</Badge>
                    )}
                  </div>

                  {message.body && <p className="rounded-xl bg-raised px-4 py-3 text-sm">“{message.body}”</p>}

                  {message.has_voice && (
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.12em] text-signal">
                        <Mic className="size-3.5" /> MENSAJE DE VOZ {message.voice_duration ? `· ${duration(message.voice_duration)}` : ""}
                      </p>
                      <audio
                        controls
                        preload="none"
                        src={url(`/mensajes/${message.id}/audio`)}
                        onPlay={() => !message.played_at && markPlayed(message.id)}
                        className="h-10 w-full"
                      />
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2">
                    {visible && !message.played_at && !message.has_voice && (
                      <Button size="sm" variant="secondary" icon={<Check className="size-3.5" />} onClick={() => markPlayed(message.id)}>
                        Marcar como leído
                      </Button>
                    )}
                    {message.status.value !== "reported" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        onClick={() => setVisible(message.id, !visible)}
                      >
                        {visible ? "Ocultar" : "Mostrar"}
                      </Button>
                    )}
                    {message.status.value !== "reported" && (
                      <Button size="sm" variant="ghost" icon={<Flag className="size-3.5" />} onClick={() => setReporting(message.id)}>
                        Reportar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Pagination page={gifts} />
      </div>

      {reporting && <ReportModal messageId={reporting} reasons={reasons} onClose={() => setReporting(null)} />}
    </StudioLayout>
  );
}

function ReportModal({ messageId, reasons, onClose }: { messageId: string; reasons: Labeled[]; onClose: () => void }) {
  const url = useStudioUrl();
  const form = useForm({ reason: reasons[0]?.value ?? "other", details: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(url(`/mensajes/${messageId}/reportar`), { preserveScroll: true, onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Reportar mensaje"
      description="El mensaje sale de tu bandeja y el equipo de moderación de la plataforma lo revisa."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" type="submit" form="report-message" loading={form.processing}>
            Reportar
          </Button>
        </>
      }
    >
      <form id="report-message" onSubmit={submit} className="space-y-4">
        <Field label="Motivo" error={form.errors.reason}>
          {(id, invalid) => (
            <Select id={id} invalid={invalid} value={form.data.reason} onChange={(event) => form.setData("reason", event.target.value)}>
              {reasons.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Detalle (opcional)" error={form.errors.details}>
          {(id, invalid) => <Textarea id={id} invalid={invalid} maxLength={1000} value={form.data.details} onChange={(event) => form.setData("details", event.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
